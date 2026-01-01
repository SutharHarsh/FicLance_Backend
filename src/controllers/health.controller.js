const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');
const { getQueueStats } = require('../services/queue.service');

/**
 * Health check endpoint
 * GET /health
 */
async function healthCheck(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      s3: 'unknown',
    },
  };

  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      health.services.database = 'connected';
    } else {
      health.services.database = 'disconnected';
      health.status = 'unhealthy';
    }

    // Check Redis
    try {
      const pong = await redisClient.ping();
      health.services.redis = pong ? 'connected' : 'disconnected';
      if (!pong) health.status = 'unhealthy';
    } catch (error) {
      health.services.redis = 'error';
      health.status = 'unhealthy';
      logger.error('Redis health check failed:', error);
    }

    // Check S3 (basic check - just verify config exists)
    const config = require('../config/env');
    if (config.s3Endpoint && config.s3Bucket) {
      health.services.s3 = 'configured';
    } else {
      health.services.s3 = 'not configured';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    return res.status(statusCode).json(successResponse(health));
  } catch (error) {
    logger.error('Health check error:', error);
    health.status = 'error';
    health.error = error.message;
    return res.status(500).json(errorResponse('Health check failed', health));
  }
}

module.exports = {
  healthCheck,
};

/**
 * Queue stats endpoint
 * GET /health/queues
 */
async function queueHealth(req, res) {
  try {
    const agent = await getQueueStats('agentQueue');
    const repo = await getQueueStats('repoAnalysisQueue');
    const cleanup = await getQueueStats('cleanupQueue');

    return res.json(successResponse({ agent, repo, cleanup }));
  } catch (error) {
    logger.error('Queue health error:', error);
    return res.status(500).json(errorResponse('Queue health failed'));
  }
}

module.exports.queueHealth = queueHealth;
