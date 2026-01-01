require("dotenv").config(); // 👈 MUST be line 1

const { Worker } = require("bullmq");
const config = require("./config/env");
const logger = require("./config/logger");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { getRedisConnection, disconnectRedis } = require("./config/redis");

// Import job processors
const { processAgentJob } = require("./workers/agentProcessor");
const { processRepoAnalysisJob } = require("./workers/repoAnalysisProcessor");
const { processCleanupJob } = require("./workers/cleanupProcessor");

let workers = [];

/**
 * Create and configure a BullMQ worker
 */
function createWorker(queueName, processor, options = {}) {
  const worker = new Worker(queueName, processor, {
    connection: getRedisConnection(),
    concurrency: options.concurrency || (config.worker && config.worker.concurrency) || 5,
    lockDuration: 30000, // 30 seconds lock duration
    stalledInterval: 60000, // Check for stalled jobs every 60s (reduced from default 30s)
    maxStalledCount: 2, // Max times a job can be recovered from stalled state
    ...options,
  });

  // Worker event handlers
  worker.on("completed", (job) => {
    logger.info(`Job ${job.id} in queue ${queueName} completed`, {
      jobId: job.id,
      queue: queueName,
      duration: job.finishedOn - job.processedOn,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(`Job ${job?.id} in queue ${queueName} failed`, {
      jobId: job?.id,
      queue: queueName,
      error: error.message,
      stack: error.stack,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on("error", (error) => {
    logger.error(`Worker error in queue ${queueName}:`, error);
  });

  worker.on("stalled", (jobId) => {
    logger.warn(`Job ${jobId} in queue ${queueName} stalled`);
  });

  logger.info(`Worker started for queue: ${queueName}`);

  return worker;
}

/**
 * Start all workers
 */
async function startWorkers() {
  try {
    // Connect to database
    logger.info("Worker: Connecting to MongoDB...");
    await connectDatabase();
    logger.info("Worker: MongoDB connected");

    // Connect to Redis explicitly
    logger.info("Worker: Connecting to Redis...");
    const { connectRedis } = require("./config/redis");
    await connectRedis();
    logger.info("Worker: Redis connection established");

    // Create workers for each queue
    workers.push(
      createWorker("agentQueue", processAgentJob, {
        concurrency: 3, // Process up to 3 jobs concurrently (with deduplication protection)
      })
    );

    workers.push(
      createWorker("repoAnalysisQueue", processRepoAnalysisJob, {
        concurrency: 2,
      })
    );

    workers.push(
      createWorker("cleanupQueue", processCleanupJob, {
        concurrency: 5,
      })
    );

    logger.info(
      `All workers started. Processing jobs from ${workers.length} queues.`
    );
  } catch (error) {
    logger.error("Failed to start workers:", error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down workers...`);

  // Close all workers
  const closePromises = workers.map((worker) =>
    worker.close().catch((err) => {
      logger.error("Error closing worker:", err);
    })
  );

  await Promise.all(closePromises);
  logger.info("All workers closed");

  // Disconnect from databases
  try {
    await disconnectRedis();
    logger.info("Redis disconnected");

    await disconnectDatabase();
    logger.info("MongoDB disconnected");

    logger.info("Worker shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during worker shutdown:", error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Worker: Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Worker: Unhandled Rejection:", reason);
  gracefulShutdown("unhandledRejection");
});

// Start workers if run directly
if (require.main === module) {
  startWorkers();
}

module.exports = { startWorkers };
