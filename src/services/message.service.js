const { Message, Simulation } = require("../models");
const {
  app: { isTest },
} = require("../config/env"); // Optional: check if test env
const { enqueueAgentJob } = require("./queue.service");
const { AppError } = require("../utils/errors");
const { emitToSimulation } = require("../socket");
const logger = require("../config/logger");

/**
 * Create a new message with atomic sequence generation
 */
async function createMessage(
  simulationId,
  sender,
  content,
  contentType = "text",
  attachments = [],
  clientMessageId = null,
  metadata = {},
  messageType = null
) {
  logger.info(`messageService.createMessage called`, {
    simulationId,
    senderType: sender?.type,
    contentLength: content?.length,
    messageType,
  });

  // Check if simulation exists
  const simulation = await Simulation.findById(simulationId);
  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  // Block user messages when project is considered completed (>= 80%), but allow system messages
  /* try {
    if (sender?.type === "user") {
      const completion = Number(simulation.meta?.completionPercentage || 0);
      if (completion >= 80 || simulation.state === "completed") {
        throw new AppError(
          "Project is 80%+ complete and considered completed. Messaging is disabled.",
          403
        );
      }
    }
  } catch (e) {
    // Re-throw for controller error handling
    throw e;
  } */

  // Deduplicate GitHub feedback messages - check if similar message exists in last 30 seconds
  if (sender.type === "agent" && sender.agentName === "GitHub Analyzer") {
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const recentFeedback = await Message.findOne({
      simulationId,
      "sender.type": "agent",
      "sender.agentName": "GitHub Analyzer",
      createdAt: { $gte: thirtySecondsAgo },
    }).sort({ createdAt: -1 });

    if (recentFeedback) {
      logger.warn(
        `Skipping duplicate GitHub feedback message for simulation ${simulationId}`
      );
      return recentFeedback.toObject(); // Return existing message instead of creating duplicate
    }
  }

  // Auto-transition to in_progress if first user message after requirements_sent
  if (sender.type === "user" && simulation.state === "requirements_sent") {
    await simulation.transitionState("in_progress", sender.id);
    logger.info(`Auto-transitioned simulation ${simulationId} to in_progress`);
  }

  // Check for duplicate client message ID
  if (clientMessageId) {
    const exists = await Message.existsByClientId(
      simulationId,
      clientMessageId
    );
    if (exists) {
      throw new AppError("Duplicate message", 409);
    }
  }

  // Get next sequence number (atomic)
  const sequence = await Message.getNextSequence(simulationId);

  // Create message
  const message = await Message.create({
    simulationId,
    sequence,
    clientMessageId,
    sender,
    content,
    contentType,
    attachments,
    metadata, // Save metadata
    type: messageType || "text", // Store message type (system, text, etc.)
  });

  logger.info("✅ MESSAGE SAVED IN DB", {
    messageId: message._id,
    simulationId,
  });

  // Only update message count and trigger agent jobs for non-system messages
  if (sender?.type !== "system") {
    // Update simulation message count
    await simulation.incrementMessageCount();

    // Update simulation completion percentage if present in metadata
    if (
      metadata?.rawAgentResponse?.message?.completion_percentage !== undefined
    ) {
      const completionPercentage =
        metadata.rawAgentResponse.message.completion_percentage;
      try {
        await Simulation.findByIdAndUpdate(simulationId, {
          "meta.completionPercentage": completionPercentage,
        });
        logger.info(
          `Updated simulation ${simulationId} completion percentage to ${completionPercentage}%`
        );

        // Auto-complete project when >= 80%
        if (Number(completionPercentage) >= 80) {
          try {
            const sim = await Simulation.findById(simulationId);
            if (sim) {
              if (sim.state === "requirements_sent") {
                await sim.transitionState("in_progress");
              }
              if (sim.state !== "completed") {
                await sim.transitionState("completed");
                logger.info(
                  `Simulation ${simulationId} auto-transitioned to completed`
                );
              }
            }
          } catch (e) {
            logger.warn(
              `Failed to auto-complete simulation ${simulationId}: ${e.message}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `Failed to update completion percentage: ${error.message}`
        );
      }
    }
  }

  // Emit Socket.IO event
  try {
    emitToSimulation(simulationId, "message:created", message.toObject());
  } catch (error) {
    logger.error("Failed to emit message:created event:", error);
  }

  logger.info(
    `Message created: ${message._id} (sequence: ${sequence}) in simulation: ${simulationId}`
  );

  // Enqueue agent response if user message and simulation in active states
  const activeStates = ["requirements_sent", "in_progress"];
  if (sender.type === "user" && activeStates.includes(simulation.state)) {
    // Emit typing indicator
    try {
      emitToSimulation(simulationId, "agent:typing", {
        agentName: "Agent2",
        isTyping: true,
      });
    } catch (error) {
      logger.error("Failed to emit agent:typing event:", error);
    }

    await enqueueAgentJob("chat", {
      simulationId: simulationId.toString(),
      userMessage: content,
      userId: sender.id.toString(),
      sequence,
    });

    logger.info(`Enqueued Agent2 chat job for simulation: ${simulationId}`);
  }

  return message.toObject();
}

/**
 * List messages for a simulation with cursor pagination
 */
async function listMessages(simulationId, cursor = null, limit = 50) {
  // Validate simulation exists
  const simulation = await Simulation.findById(simulationId);
  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  const messages = await Message.findBySimulation(simulationId, {
    cursor,
    limit: Math.min(limit, 500), // Max 500 messages per request
    direction: "asc",
  });

  const nextCursor =
    messages.length === limit ? messages[messages.length - 1].sequence : null;

  return {
    items: messages,
    nextCursor,
    hasMore: messages.length === limit,
  };
}

/**
 * Get a single message by ID
 */
async function getMessageById(messageId) {
  const message = await Message.findById(messageId).lean();

  if (!message) {
    throw new AppError("Message not found", 404);
  }

  return message;
}

/**
 * Edit a message
 */
async function editMessage(messageId, newContent, userId) {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new AppError("Message not found", 404);
  }

  // Only allow user who sent the message to edit it
  if (message.sender.id.toString() !== userId.toString()) {
    throw new AppError("Not authorized to edit this message", 403);
  }

  await message.edit(newContent, userId);

  // Emit Socket.IO event
  try {
    emitToSimulation(
      message.simulationId,
      "message:edited",
      message.toObject()
    );
  } catch (error) {
    logger.error("Failed to emit message:edited event:", error);
  }

  logger.info(`Message edited: ${messageId}`);

  return message.toObject();
}

/**
 * Flag a message
 */
async function flagMessage(messageId) {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new AppError("Message not found", 404);
  }

  await message.flag();

  logger.info(`Message flagged: ${messageId}`);

  return message.toObject();
}

module.exports = {
  createMessage,
  listMessages,
  getMessageById,
  editMessage,
  flagMessage,
};
