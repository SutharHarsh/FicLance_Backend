const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Request logging middleware
 */
class LoggerMiddleware {
  /**
   * Add correlation ID to request
   */
  static correlationId(req, res, next) {
    req.correlationId = req.headers['x-correlation-id'] || uuidv4();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  }

  /**
   * Log HTTP requests
   */
  static logRequest(req, res, next) {
    const start = Date.now();

    // Log request
    logger.info('Incoming request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      correlationId: req.correlationId,
      userId: req.userId,
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId: req.correlationId,
        userId: req.userId,
      };

      if (res.statusCode >= 400) {
        logger.warn('Request completed with error', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });

    next();
  }

  /**
   * Log errors
   */
  static logError(err, req, res, next) {
    logger.error('Request error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      correlationId: req.correlationId,
      userId: req.userId,
    });

    next(err);
  }
}

module.exports = {
  LoggerMiddleware,
  requestLogger: LoggerMiddleware.logRequest,
  correlationId: LoggerMiddleware.correlationId,
  errorLogger: LoggerMiddleware.logError,
};
