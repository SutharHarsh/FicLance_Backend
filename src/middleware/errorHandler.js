const { AppError } = require("../utils/errors");
const { errorResponse } = require("../utils/response");
const logger = require("../config/logger");
const config = require("../config/env");

/**
 * Global error handler middleware
 */
class ErrorHandler {
  /**
   * Main error handler
   */
  static handle(err, req, res, next) {
    // Log error
    if (err.isOperational) {
      logger.warn("Operational error", {
        message: err.message,
        statusCode: err.statusCode,
        url: req.originalUrl,
        method: req.method,
        userId: req.userId,
        correlationId: req.correlationId,
      });
    } else {
      logger.error("Non-operational error", {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.userId,
        correlationId: req.correlationId,
      });
    }

    // Helper to get user-friendly message
    const getUserMessage = (err) => {
      // Validation errors
      if (err.name === "ValidationError")
        return "Please check the information you provided.";

      // Duplicate key
      if (err.code === 11000) {
        if (err.message.includes("email"))
          return "This email address is already registered.";
        return "This record already exists.";
      }

      // Auth errors
      if (err.name === "JsonWebTokenError")
        return "Your session is invalid. Please log in again.";
      if (err.name === "TokenExpiredError")
        return "Your session has expired. Please log in again.";
      if (err.statusCode === 401) return "Please log in to continue.";
      if (err.statusCode === 403)
        return "You do not have permission to perform this action.";

      // Not Found
      if (err.statusCode === 404)
        return "The requested resource could not be found.";

      // Rate limit
      if (err.statusCode === 429)
        return "You are making too many requests. Please try again later.";

      // Operational errors (manual throw)
      if (err.isOperational) return err.message;

      // Default fallback
      return "Something went wrong on our end. Please try again later.";
    };

    const userMessage = getUserMessage(err);

    // Mongoose validation error
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));

      console.error("[Mongoose Validation Error]:", JSON.stringify(errors, null, 2));

      return res.status(422).json(
        errorResponse(
          "Validation failed",
          422,
          errors,
          {
            correlationId: req.correlationId,
          },
          userMessage
        )
      );
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(409).json(
        errorResponse(
          `Duplicate value for ${field}`,
          409,
          [],
          {
            correlationId: req.correlationId,
          },
          userMessage
        )
      );
    }

    // Mongoose cast error
    if (err.name === "CastError") {
      return res.status(400).json(
        errorResponse(
          `Invalid ${err.path}: ${err.value}`,
          400,
          [],
          {
            correlationId: req.correlationId,
          },
          "Invalid ID format provided."
        )
      );
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json(
        errorResponse(
          "Invalid token",
          401,
          [],
          {
            correlationId: req.correlationId,
          },
          userMessage
        )
      );
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json(
        errorResponse(
          "Token expired",
          401,
          [],
          {
            correlationId: req.correlationId,
          },
          userMessage
        )
      );
    }

    // AppError (custom errors)
    if (err instanceof AppError) {
      return res.status(err.statusCode).json(
        errorResponse(
          err.message,
          err.statusCode,
          err.errors || [],
          {
            correlationId: req.correlationId,
          },
          userMessage
        )
      );
    }

    // Default error
    const statusCode = err.statusCode || 500;
    const message = config.app.isProduction
      ? "Internal server error"
      : err.message;

    res.status(statusCode).json(
      errorResponse(
        message,
        statusCode,
        [],
        {
          correlationId: req.correlationId,
          ...(config.app.isDevelopment && { stack: err.stack }),
        },
        userMessage
      )
    );
  }

  /**
   * Handle 404 not found
   */
  static notFound(req, res, next) {
    res.status(404).json(
      errorResponse(
        `Route ${req.method} ${req.originalUrl} not found`,
        404,
        [],
        {
          correlationId: req.correlationId,
        },
        "The page or resource you are looking for does not exist."
      )
    );
  }

  /**
   * Async error wrapper
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = {
  ErrorHandler,
  errorHandler: ErrorHandler.handle,
  notFoundHandler: ErrorHandler.notFound,
  asyncHandler: ErrorHandler.asyncHandler,
};
