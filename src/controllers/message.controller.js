const messageService = require("../services/message.service");
const { successResponse, errorResponse } = require("../utils/response");
const logger = require("../config/logger");
const { User } = require("../models");
const { AppError } = require("../utils/errors");

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
        // Ensure req.user exists
        if (!req.user || !req.user.userId) {
          logger.error("Missing user authentication data in createMessage", {
            hasUser: !!req.user,
            user: req.user,
          });
          throw new AppError("User authentication required", 401);
        }
        
        // Fetch user data to get display name
        let user;
        try {
          // Ensure userId is a valid MongoDB ObjectId
          const mongoose = require('mongoose');
          const userId = mongoose.Types.ObjectId.isValid(req.user.userId) 
            ? req.user.userId 
            : null;
          
          if (!userId) {
            throw new Error(`Invalid user ID format: ${req.user.userId}`);
          }
          
          user = await User.findById(userId);
        } catch (dbError) {
          logger.error("Database error fetching user in createMessage", {
            userId: req.user.userId,
            error: dbError.message,
            stack: dbError.stack
          });
          throw new AppError("Failed to fetch user data", 500);
        }
        
        if (!user) {
          logger.error("User not found in createMessage", {
            userId: req.user.userId
          });
          throw new AppError("User not found", 404);
        }
        
        senderData = {
          type: "user",
          id: req.user.userId,
          displayName: user.name || user.email || "User",
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
