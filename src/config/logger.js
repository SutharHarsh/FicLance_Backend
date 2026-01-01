const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./env');

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for development
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// JSON format for production
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.app.isProduction ? prodFormat : devFormat,
  defaultMeta: {
    service: 'ficlance-backend',
    env: config.app.env,
  },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: config.app.isProduction ? prodFormat : devFormat,
    }),
    
    // Write all logs to file
    new winston.transports.File({
      filename: config.logging.file,
      format: prodFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // Write error logs to separate file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: prodFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: prodFormat,
    }),
  ],
});

// Add request logging helper
logger.logRequest = (req, message = 'HTTP Request') => {
  logger.info(message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    correlationId: req.correlationId,
  });
};

// Add error logging helper
logger.logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

module.exports = logger;
