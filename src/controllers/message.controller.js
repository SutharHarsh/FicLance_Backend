const messageService = require("../services/message.service");
const { successResponse, errorResponse } = require("../utils/response");
const logger = require("../config/logger");

/**
 * List messages for a simulation
 * GET /simulations/:simulationId/messages
 */
async function listMessages(req, res, next) {
  try {
    const { simulationId } = req.params;
    const { cursor, limit } = req.query;

    const result = await messageService.listMessages(
      simulationId,
      cursor ? parseInt(cursor) : null,
      parseInt(limit) || 200
    );

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new message
 * POST /simulations/:simulationId/messages
 */
async function createMessage(req, res, next) {
  try {
    const { simulationId } = req.params;
    const {
      content,
      contentType,
      sender,
      attachments,
      clientMessageId,
      metadata,
    } = req.body;

    // System messages (type="system") bypass user requirement
    const isSystemMessage = req.body.type === "system";

    // Default to user sender if not specified (backend trusted override)
    let senderData = sender;

    if (!senderData) {
      if (isSystemMessage) {
        senderData = { type: "system", name: "System" };
      } else {
        senderData = {
          type: "user",
          id: req.user.userId,
          displayName: req.user.displayName || req.user.name,
        };
      }
    }

    logger.info(`Creating message for sim: ${simulationId}`, {
      sender: senderData,
      contentPreview: content?.substring(0, 50),
      type: req.body.type || "text",
    });

    const message = await messageService.createMessage(
      simulationId,
      senderData,
      content,
      contentType || "text",
      attachments || [],
      clientMessageId,
      metadata, // Pass metadata to service
      req.body.type // Pass message type
    );

    return res.status(201).json(successResponse(message, "Message created"));
  } catch (error) {
    next(error);
  }
}

/**
 * Edit a message
 * PATCH /simulations/:simulationId/messages/:messageId
 */
async function editMessage(req, res, next) {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    const message = await messageService.editMessage(
      messageId,
      content,
      userId
    );

    return res.json(successResponse(message, "Message updated"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMessages,
  createMessage,
  editMessage,
};
