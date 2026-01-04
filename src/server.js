require("dotenv").config(); // 👈 MUST be line 1
const http = require("http");
const app = require("./app");
const config = require("./config/env");
const logger = require("./config/logger");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { initializeSocketIO } = require("./socket");

let server;
let io;

/**
 * Start the HTTP server
 */
async function startServer() {
  try {
    // Connect to database
    logger.info("Connecting to MongoDB...");
    await connectDatabase();
    logger.info("MongoDB connected successfully");

    // Connect to Redis (track connection status)
    let redisConnected = false;
    try {
      logger.info("Connecting to Redis...");
      await connectRedis();
      logger.info("Redis connected successfully");
      redisConnected = true;
    } catch (redisError) {
      logger.warn("⚠️  Redis connection failed - Running WITHOUT Redis");
      logger.warn("   → Workers and background jobs DISABLED");
      logger.error("Redis error:", redisError.message);
      redisConnected = false;
    }

    // Create HTTP server
    server = http.createServer(app);

    // Initialize Socket.IO
    logger.info("Initializing Socket.IO...");
    io = initializeSocketIO(server);
    logger.info("Socket.IO initialized successfully");

    // Set up job completion listener to emit Socket.IO events from worker jobs
    if (redisConnected) {
      try {
        const { setupJobCompletionListener } = require("./services/queue.service");
        await setupJobCompletionListener();
        logger.info("Job completion listener initialized");
      } catch (listenerError) {
        logger.warn("Failed to initialize job completion listener:", listenerError.message);
      }
    }

    // Optionally start workers in development when ENABLE_WORKERS=true
    if (config.env === "development" && !config.enableWorkers) {
      logger.warn("⚠️  Development mode: Workers DISABLED (set ENABLE_WORKERS=true to enable)");
      logger.warn("   → Agent processing will not work in dev mode unless enabled");
    }

    // Start workers when Redis is connected (Always in dev/prod unless explicitly disabled)
    // We defaults ENABLE_WORKERS to true now, but this double check ensures it runs.
    if (redisConnected && (config.enableWorkers || config.env === "development")) {
      try {
        logger.info("Starting background workers...");
        const { startWorkers } = require("./worker");
        await startWorkers();
      } catch (workerError) {
        logger.error(
          "Failed to start workers:",
          workerError
        );
      }
    }

    // Start listening
    server.listen(config.port, () => {
      logger.info(
        `Server running on port ${config.port} in ${config.env} mode`
      );
      logger.info(
        `API available at http://localhost:${config.port}${config.apiPrefix}`
      );
    });

    // Handle server errors
    server.on("error", (error) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          logger.error(`Port ${config.port} requires elevated privileges`);
          process.exit(1);
        case "EADDRINUSE":
          logger.error(`Port ${config.port} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });
  } catch (error) {
    console.error("CRITICAL: Failed to start server:");
    console.error(error);
    if (logger) {
      logger.error("Failed to start server:", error);
    }
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
    });
  }

  // Close Socket.IO connections
  if (io) {
    io.close(() => {
      logger.info("Socket.IO closed");
    });
  }

  // Close database connections
  try {
    // Close queue events listener
    const { closeQueueEventsListener } = require("./services/queue.service");
    await closeQueueEventsListener();
    logger.info("Queue events listener closed");

    await disconnectRedis();
    logger.info("Redis disconnected");

    await disconnectDatabase();
    logger.info("MongoDB disconnected");

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});

// Start the server
try {
  startServer();
} catch (error) {
  console.error("FATAL STARTUP ERROR:");
  console.error(error);
  process.exit(1);
}
