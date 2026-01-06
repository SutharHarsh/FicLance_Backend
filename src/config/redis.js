const Redis = require("ioredis");
const config = require("./env");
const logger = require("./logger");

class RedisClient {
  constructor() {
    this.client = null;
  }

  connect() {
    try {
      if (this.client) {
        return this.client;
      }

      if (!config.redisUrl) {
        logger.warn("REDIS_URL is missing - running without Redis");
        return null;
      }

      // Check if Redis URL is local or remote
      const isLocal =
        config.redisUrl.includes("localhost") ||
        config.redisUrl.includes("127.0.0.1");
      const isTLS = config.redisUrl.startsWith("rediss://");

      logger.info(
        `Attempting Redis connection to: ${
          isLocal ? "Local Instance" : "Remote Instance"
        } (${isTLS ? "TLS enabled" : "Plaintext"})`
      );

      // Create Redis client (Upstash / TLS safe)
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false, // Disable to reduce requests
        enableOfflineQueue: true,
        connectTimeout: isLocal ? 3000 : 10000,
        maxLoadingRetryTime: isLocal ? 2000 : 5000,
        lazyConnect: false,
        tls: isTLS
          ? {
              rejectUnauthorized: false, // Often needed for Upstash
            }
          : undefined,
        retryStrategy: (times) => {
          if (times > 5) {
            logger.error(
              `Redis connection failed after ${times} attempts. Check your REDIS_URL environment variable.`
            );
            return null; // Stop retrying
          }
          const delay = Math.min(times * 500, 3000);
          return delay;
        },
      });

      // Attach listeners ONLY after client exists
      this.client.on("connect", () => {
        logger.info("Redis connected successfully");
      });

      this.client.on("ready", () => {
        logger.info("Redis ready");
      });

      this.client.on("error", (err) => {
        logger.error("Redis connection error", err);
      });

      this.client.on("close", () => {
        logger.warn("Redis connection closed");
      });

      this.client.on("reconnecting", () => {
        logger.info("Redis reconnecting...");
      });

      // Graceful shutdown
      process.on("SIGINT", async () => {
        await this.disconnect();
        process.exit(0);
      });

      return this.client;
    } catch (error) {
      logger.error("Redis initialization failed", error);
      this.client = null;
      if (config.app.isProduction) {
        throw error;
      }
      logger.warn("Continuing without Redis (Development Mode)");
      return null;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info("Redis connection closed");
    }
  }

  getClient() {
    if (!this.client || this.client.status !== "ready") {
      return null;
    }
    return this.client;
  }

  async ping() {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error("Redis ping failed", error);
      return false;
    }
  }

  // Utility methods
  async set(key, value, expirySeconds = null) {
    if (!this.client) throw new Error("Redis not connected");
    if (expirySeconds) {
      return this.client.set(key, value, "EX", expirySeconds);
    }
    return this.client.set(key, value);
  }

  async get(key) {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.get(key);
  }

  async del(key) {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.del(key);
  }

  async incr(key) {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.incr(key);
  }

  async expire(key, seconds) {
    if (!this.client) throw new Error("Redis not connected");
    return this.client.expire(key, seconds);
  }
}

const redisClient = new RedisClient();

// Async wrapper that properly handles connection failures
async function connectRedis() {
  try {
    const client = redisClient.connect();
    if (!client) {
      throw new Error("Redis client could not be initialized");
    }
    // Wait a moment for connection to establish
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
      }, 5000);

      if (client.status === "ready") {
        clearTimeout(timeout);
        resolve();
      } else {
        client.once("ready", () => {
          clearTimeout(timeout);
          resolve();
        });
        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });
    return client;
  } catch (error) {
    logger.error("Failed to connect to Redis:", error.message);
    throw error; // Re-throw to let caller handle
  }
}

module.exports = {
  connectRedis,
  disconnectRedis: () => redisClient.disconnect(),
  getRedisConnection: () => redisClient.getClient(),
  redisClient,
};
