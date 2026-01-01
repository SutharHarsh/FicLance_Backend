const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createMessageSchema } = require('../validation/message.validation');

// All message routes require authentication
router.use(authenticate);

/**
 * GET /messages?conversationId=xxx
 * List messages for a conversation (simulation)
 */
router.get('/', async (req, res, next) => {
  try {
    const { conversationId, cursor, limit } = req.query;
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId query parameter is required'
      });
    }

    // Reuse the existing listMessages controller but adapt the params
    req.params.simulationId = conversationId;
    return messageController.listMessages(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /messages
 * Create a message in a conversation
 * Body: { conversationId, content, type, userId, role, skipAI, metadata }
 */
router.post('/', async (req, res, next) => {
  try {
    const { conversationId, content, type, userId, role, skipAI, metadata } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required in request body'
      });
    }

    // Adapt the request to match the existing controller expectations
    req.params.simulationId = conversationId;
    
    // Determine sender type and format
    let senderType = 'system';
    let senderId = undefined;
    let agentName = undefined;

    if (role === 'user') {
      senderType = 'user';
      senderId = req.user.userId; // Use authenticated user's ID
    } else if (role === 'assistant') {
      senderType = 'agent';
      agentName = userId === 'github-feedback' ? 'GitHub Analyzer' : 'AI Assistant';
      senderId = undefined; // Agents don't have user IDs
    }

    // Map contentType - ensure it's a valid enum value
    let contentType = 'text';
    if (type === 'github_feedback' || type === 'markdown') {
      contentType = 'markdown'; // GitHub feedback is markdown formatted
    } else if (type === 'code') {
      contentType = 'code';
    } else if (type === 'file') {
      contentType = 'file';
    }

    // Map the flat structure to the expected format
    req.body = {
      content,
      contentType,
      sender: {
        type: senderType,
        ...(senderId && { id: senderId }),
        ...(agentName && { agentName }),
      },
      metadata: metadata || {},
      attachments: []
    };

    return messageController.createMessage(req, res, next);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
