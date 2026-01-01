const rateLimit = require("express-rate-limit");
const {
  RateLimiterMemory,
  RateLimiterRedis,
} = require("rate-limiter-flexible");
const redisClient = require("../config/redis");
const { RateLimitError } = require("../utils/errors");
const config = require("../config/env");
const logger = require("../config/logger");

/**
 * Rate limiter middleware factory
 */
class RateLimiter {
  /**
   * Create Redis-based rate limiter (production)
   */
  static createRedisLimiter(options = {}) {
    const {
      points = 100,
      duration = 60,
      keyPrefix = "rl",
      blockDuration = 0,
    } = options;

    try {
      const limiter = new RateLimiterRedis({
        storeClient: redisClient.getClient(),
        points,
        duration,
        keyPrefix,
        blockDuration,
      });

      return async (req, res, next) => {
        const key = req.userId || req.ip;

        try {
          if (limiter instanceof RateLimiterRedis) {
            await limiter.consume(key);
          } else {
            // Memory limiter consume
            await limiter.consume(key);
          }
          next();
        } catch (rejRes) {
          if (rejRes instanceof Error) {
            // Redis connection or quota error
            logger.error("Redis limiter error, bypassing", rejRes);
            return next();
          }

          const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);
          // ...

          res.set("Retry-After", retryAfter);
          res.set("X-RateLimit-Limit", points);
          res.set("X-RateLimit-Remaining", rejRes.remainingPoints);
          res.set(
            "X-RateLimit-Reset",
            new Date(Date.now() + rejRes.msBeforeNext).toISOString()
          );

          logger.warn("Rate limit exceeded", {
            key,
            ip: req.ip,
            url: req.originalUrl,
          });

          next(new RateLimitError("Too many requests, please try again later"));
        }
      };
    } catch (error) {
      logger.error(
        "Failed to create Redis limiter, falling back to memory",
        error
      );
      return this.createMemoryLimiter(options);
    }
  }

  /**
   * Create memory-based rate limiter (development/fallback)
   */
  static createMemoryLimiter(options = {}) {
    const {
      points = 100,
      duration = 60,
      keyPrefix = "rl",
      blockDuration = 0,
    } = options;

    const limiter = new RateLimiterMemory({
      points,
      duration,
      keyPrefix,
      blockDuration,
    });

    return async (req, res, next) => {
      const key = req.userId || req.ip;

      try {
        await limiter.consume(key);
        next();
      } catch (rejRes) {
        const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);

        res.set("Retry-After", retryAfter);
        res.set("X-RateLimit-Limit", points);
        res.set("X-RateLimit-Remaining", rejRes.remainingPoints);

        next(new RateLimitError("Too many requests, please try again later"));
      }
    };
  }

  /**
   * General API rate limiter
   */
  static apiLimiter() {
    if (config.app.isProduction) {
      return this.createRedisLimiter({
        points: config.rateLimit.maxRequests,
        duration: Math.floor(config.rateLimit.windowMs / 1000),
        keyPrefix: "rl:api",
      });
    }
    return this.createMemoryLimiter({
      points: config.rateLimit.maxRequests,
      duration: Math.floor(config.rateLimit.windowMs / 1000),
    });
  }

  /**
   * Strict rate limiter for auth endpoints
   */
  static authLimiter() {
    if (config.app.isProduction) {
      return this.createRedisLimiter({
        points: config.rateLimit.authMax,
        duration: 60, // 1 minute
        keyPrefix: "rl:auth",
        blockDuration: 300, // Block for 5 minutes after limit
      });
    }
    return this.createMemoryLimiter({
      points: config.rateLimit.authMax,
      duration: 60,
      blockDuration: 300,
    });
  }

  /**
   * Custom rate limiter
   */
  static custom(options) {
    if (config.app.isProduction) {
      return this.createRedisLimiter(options);
    }
    return this.createMemoryLimiter(options);
  }

  /**
   * File upload rate limiter
   */
  static uploadLimiter() {
    return this.custom({
      points: 10,
      duration: 3600, // 1 hour
      keyPrefix: "rl:upload",
    });
  }

  /**
   * Portfolio analysis rate limiter
   */
  static analysisLimiter() {
    return this.custom({
      points: 5,
      duration: 3600, // 1 hour
      keyPrefix: "rl:analysis",
      blockDuration: 1800, // Block for 30 minutes
    });
  }
}

// Export both the class and commonly used limiters
module.exports = RateLimiter;
module.exports.apiRateLimiter = RateLimiter.apiLimiter();
module.exports.authRateLimiter = RateLimiter.authLimiter();
module.exports.uploadRateLimiter = RateLimiter.uploadLimiter();
module.exports.analysisRateLimiter = RateLimiter.analysisLimiter();
