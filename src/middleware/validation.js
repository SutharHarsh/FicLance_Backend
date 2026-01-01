const { ValidationError } = require("../utils/errors");

/**
 * Middleware factory for request validation using Joi schemas
 */
class ValidationMiddleware {
  /**
   * Validate request body
   * @param {Joi.Schema} schema - Joi schema
   */
  static validateBody(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        console.error(
          "[Validation Error]:",
          error.details
            .map((d) => `${d.path.join(".")}: ${d.message}`)
            .join(", ")
        );
        const errors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          type: detail.type,
        }));

        return next(new ValidationError("Validation failed", errors));
      }

      // Replace body with validated & sanitized data
      req.body = value;
      next();
    };
  }

  /**
   * Validate request query parameters
   * @param {Joi.Schema} schema - Joi schema
   */
  static validateQuery(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          type: detail.type,
        }));

        return next(new ValidationError("Query validation failed", errors));
      }

      req.query = value;
      next();
    };
  }

  /**
   * Validate request params
   * @param {Joi.Schema} schema - Joi schema
   */
  static validateParams(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: false, // Don't strip params
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          type: detail.type,
        }));

        return next(new ValidationError("Parameter validation failed", errors));
      }

      req.params = value;
      next();
    };
  }

  /**
   * Validate ObjectId parameter
   */
  static validateObjectId(paramName = "id") {
    return (req, res, next) => {
      const mongoose = require("mongoose");
      const id = req.params[paramName];

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ValidationError(`Invalid ${paramName} format`));
      }

      next();
    };
  }

  /**
   * Sanitize user input to prevent XSS
   */
  static sanitize(req, res, next) {
    const sanitizeString = (str) => {
      if (typeof str !== "string") return str;

      // Remove HTML tags
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
    };

    const sanitizeObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }

      if (obj !== null && typeof obj === "object") {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }

      return sanitizeString(obj);
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  }
}

// Alias for backward compatibility with route definitions
const validate = (schema) => ValidationMiddleware.validateBody(schema);

module.exports = ValidationMiddleware;
module.exports.validate = validate;
