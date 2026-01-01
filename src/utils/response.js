/**
 * Standard API response wrapper
 */
class ApiResponse {
  /**
   * Success response
   * @param {*} data - Response data
   * @param {String} message - Success message
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Formatted response
   */
  static success(data = null, message = "Success", metadata = {}) {
    return {
      success: true,
      message,
      data,
      error: null,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Error response
   * @param {String} message - Error message
   * @param {Number} statusCode - HTTP status code
   * @param {Array} errors - Validation errors
   * @param {Object} metadata - Additional metadata
   * @param {String} userMessage - User-friendly error message
   * @returns {Object} Formatted response
   */
  static error(
    message = "Error",
    statusCode = 500,
    errors = [],
    metadata = {},
    userMessage = null
  ) {
    return {
      success: false,
      message: null,
      data: null,
      error: {
        message,
        userMessage: userMessage || message, // Fallback to technical message if not provided
        statusCode,
        errors,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Paginated response
   * @param {Array} items - Array of items
   * @param {Number} page - Current page
   * @param {Number} limit - Items per page
   * @param {Number} total - Total items
   * @param {Object} extra - Extra data
   * @returns {Object} Formatted response
   */
  static paginated(items, page, limit, total, extra = {}) {
    const totalPages = Math.ceil(total / limit);

    return this.success(items, "Success", {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      ...extra,
    });
  }

  /**
   * Cursor-based paginated response
   * @param {Array} items - Array of items
   * @param {String} nextCursor - Next cursor
   * @param {String} prevCursor - Previous cursor
   * @param {Object} extra - Extra data
   * @returns {Object} Formatted response
   */
  static cursorPaginated(
    items,
    nextCursor = null,
    prevCursor = null,
    extra = {}
  ) {
    return this.success(items, "Success", {
      pagination: {
        nextCursor,
        prevCursor,
        hasNext: !!nextCursor,
        hasPrev: !!prevCursor,
      },
      ...extra,
    });
  }
}

const successResponse = ApiResponse.success;
const errorResponse = ApiResponse.error;

module.exports = {
  ApiResponse,
  successResponse,
  errorResponse,
};
