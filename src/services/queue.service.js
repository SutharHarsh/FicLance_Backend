const { Queue } = require("bullmq");
const { getRedisConnection } = require("../config/redis");
const config = require("../config/env");
const logger = require("../config/logger");

// Queue instances
let agentQueue;
let repoAnalysisQueue;
let cleanupQueue;

/**
 * Initialize BullMQ queues
 */
function initializeQueues() {
  const connection = getRedisConnection();

  if (!connection) {
    logger.warn(
      "BullMQ initialization skipped: Redis connection not available"
    );
    return;
  }

  const defaultJobOptions = {
    attempts: (config.worker && config.worker.attempts) || 3,
    backoff: {
      type: "exponential",
      delay: (config.worker && config.worker.backoffDelay) || 5000,
    },
    // IMMEDIATELY remove completed jobs to save Redis space (no hash storage)
    removeOnComplete: true, // Delete immediately after completion
    // Keep only last 5 failed jobs for debugging (minimal storage)
    removeOnFail: {
      count: 5,
      age: 300, // 5 minutes only
    },
  };

  agentQueue = new Queue("agentQueue", {
    connection,
    defaultJobOptions,
    settings: {
      stalledInterval: 60000, // Check for stalled jobs every 60s (reduced frequency)
      maxStalledCount: 2, // Max times a job can be stalled
    },
  });

  repoAnalysisQueue = new Queue("repoAnalysisQueue", {
    connection,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1, // Only 1 attempt for expensive operations (reduces storage)
      removeOnComplete: true, // Delete immediately
      removeOnFail: true, // Delete failed jobs too (no storage)
    },
    settings: {
      stalledInterval: 60000, // Check for stalled jobs every 60s
      maxStalledCount: 1,
    },
  });

  cleanupQueue = new Queue("cleanupQueue", {
    connection,
    defaultJobOptions: {
      ...defaultJobOptions,
      attempts: 1, // Single attempt only (reduced from 3)
      removeOnComplete: true, // Delete immediately
      removeOnFail: true, // Delete failed jobs too
    },
    settings: {
      stalledInterval: 60000, // Check for stalled jobs every 60s
      maxStalledCount: 2,
    },
  });

  logger.info("BullMQ queues initialized");
}

/**
 * Get agent queue instance
 */
function getAgentQueue() {
  if (!agentQueue) {
    initializeQueues();
  }
  return agentQueue;
}

/**
 * Get repo analysis queue instance
 */
function getRepoAnalysisQueue() {
  if (!repoAnalysisQueue) {
    initializeQueues();
  }
  return repoAnalysisQueue;
}

/**
 * Get cleanup queue instance
 */
function getCleanupQueue() {
  if (!cleanupQueue) {
    initializeQueues();
  }
  return cleanupQueue;
}

/**
 * Check if the queue system is active and connected
 */
function isQueueActive() {
  return !!getRedisConnection() && !!agentQueue;
}

/**
 * Enqueue an agent job
 * @param {string} type - Job type ('requirements', 'message', 'feedback')
 * @param {object} payload - Job payload
 * @param {object} options - Additional job options
 * @returns {Promise<Job>} BullMQ job instance
 */
async function enqueueAgentJob(type, payload, options = {}) {
  const queue = getAgentQueue();

  // Deduplication: Check for existing pending/active jobs for the same simulation
  if (type === "chat" && payload.simulationId) {
    const waitingJobs = await queue.getJobs(["waiting", "active"]);
    const duplicateJob = waitingJobs.find(
      (job) =>
        job.data.type === "chat" &&
        job.data.simulationId === payload.simulationId &&
        job.data.sequence === payload.sequence
    );

    if (duplicateJob) {
      logger.warn(
        `Skipping duplicate chat job for simulation ${payload.simulationId}, sequence ${payload.sequence}`
      );
      return duplicateJob;
    }
  }

  const job = await queue.add(
    type,
    {
      type,
      ...payload,
      enqueuedAt: new Date().toISOString(),
    },
    {
      ...options,
      jobId:
        options.jobId ||
        `${type}-${payload.simulationId || payload.userId}-${Date.now()}`,
    }
  );

  logger.info(`Enqueued agent job: ${job.id}`, { type, payload });

  return job;
}

/**
 * Enqueue a repository analysis job
 * @param {object} payload - Job payload { portfolioId, repoUrl, userId }
 * @param {object} options - Additional job options
 * @returns {Promise<Job>} BullMQ job instance
 */
async function enqueueRepoAnalysis(payload, options = {}) {
  // Use agentQueue because agentProcessor listens to it and handles 'feedback' jobs
  // FORCE getAgentQueue() to ensure we use the queue that agentProcessor is consuming
  if (!agentQueue) initializeQueues();
  const queue = agentQueue;

  // Deduplication: Check for existing pending/active jobs for the same portfolio
  if (payload.portfolioId) {
    const waitingJobs = await queue.getJobs(["waiting", "active"]);
    const duplicateJob = waitingJobs.find(
      (job) =>
        job.data.type === "feedback" &&
        job.data.portfolioId === payload.portfolioId
    );

    if (duplicateJob) {
      logger.warn(
        `Skipping duplicate feedback job for portfolio ${payload.portfolioId}`
      );
      return duplicateJob;
    }
  }

  const job = await queue.add(
    "feedback",
    {
      // Job name matches processAgent3 switch case
      type: "feedback",
      ...payload,
      enqueuedAt: new Date().toISOString(),
    },
    {
      ...options,
      jobId: options.jobId || `feedback-${payload.portfolioId}-${Date.now()}`,
    }
  );

  logger.info(`Enqueued repo analysis (feedback) job: ${job.id}`, {
    portfolioId: payload.portfolioId,
  });
  console.log(
    `[Queue] Enqueued repo analysis job: ${job.id} for portfolio: ${payload.portfolioId}`
  );

  return job;
}

/**
 * Enqueue a cleanup job
 * @param {string} type - Cleanup type ('file', 'session', 'simulation')
 * @param {object} payload - Cleanup payload
 * @param {object} options - Additional job options
 * @returns {Promise<Job>} BullMQ job instance
 */
async function enqueueCleanup(type, payload, options = {}) {
  const queue = getCleanupQueue();

  const job = await queue.add(
    type,
    {
      type,
      ...payload,
      enqueuedAt: new Date().toISOString(),
    },
    {
      ...options,
      delay: options.delay || 0, // Can delay cleanup jobs
      jobId: options.jobId || `cleanup-${type}-${Date.now()}`,
    }
  );

  logger.info(`Enqueued cleanup job: ${job.id}`, { type, payload });

  return job;
}

/**
 * Get job counts for a queue
 * @param {string} queueName - Queue name
 * @returns {Promise<object>} Job counts
 */
async function getQueueStats(queueName) {
  let queue;
  switch (queueName) {
    case "agentQueue":
      queue = getAgentQueue();
      break;
    case "repoAnalysisQueue":
      queue = getRepoAnalysisQueue();
      break;
    case "cleanupQueue":
      queue = getCleanupQueue();
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Close all queues
 */
async function closeQueues() {
  const queues = [agentQueue, repoAnalysisQueue, cleanupQueue].filter(Boolean);
  await Promise.all(queues.map((q) => q.close()));
  logger.info("All queues closed");
}

/**
 * Set up job completion listener to emit Socket.IO events
 * This allows the main server to emit events when worker jobs complete
 */
let queueEventsInstance = null; // Singleton to prevent duplicate listeners

async function setupJobCompletionListener() {
  const { QueueEvents } = require("bullmq");
  const { emitToSimulation } = require("../socket");
  const { Message } = require("../models");

  const connection = getRedisConnection();
  if (!connection) {
    logger.warn("Cannot setup job completion listener: Redis not connected");
    return;
  }

  // Close existing listener if it exists
  if (queueEventsInstance) {
    try {
      await queueEventsInstance.close();
      logger.info("Closed existing job completion listener");
    } catch (error) {
      logger.warn("Failed to close existing listener:", error.message);
    }
  }

  queueEventsInstance = new QueueEvents("agentQueue", { connection });

  queueEventsInstance.on("completed", async ({ jobId, returnvalue }) => {
    try {
      // Parse return value
      const result =
        typeof returnvalue === "string" ? JSON.parse(returnvalue) : returnvalue;

      if (!result || !result.success) {
        return;
      }

      // Get the simulation ID from the result
      const simulationId = result.simulationId;
      if (!simulationId) {
        return;
      }

      // Emit typing stopped
      emitToSimulation(simulationId, "agent:typing", {
        agentName: "Agent2",
        isTyping: false,
      });

      // If there's a message, emit it
      if (result.messageId) {
        // Fetch the complete message from database
        const message = await Message.findById(result.messageId);
        if (message) {
          emitToSimulation(simulationId, "message:created", message.toObject());
          logger.info(`Emitted message:created for job ${jobId}`);
        }
      }
    } catch (error) {
      logger.error(
        `Error in job completion listener for ${jobId}:`,
        error.message
      );
    }
  });

  queueEventsInstance.on("failed", async ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} failed:`, failedReason);

    try {
      // Get the job to access its data (simulationId)
      const queue = getAgentQueue();
      const job = await queue.getJob(jobId);

      if (job && job.data && job.data.simulationId) {
        const { simulationId } = job.data;
        const { emitToSimulation } = require("../socket");

        // Stop typing indicator
        emitToSimulation(simulationId, "agent:typing", {
          agentName: "Agent2",
          isTyping: false,
        });

        // Emit error event to frontend
        emitToSimulation(simulationId, "agent:error", {
          message: "Agent failed to respond. Please try again.",
          details: failedReason,
          jobId,
        });

        logger.info(
          `Emitted agent:error for failed job ${jobId} in simulation ${simulationId}`
        );
      }
    } catch (error) {
      logger.error(`Error handling failed job ${jobId}:`, error.message);
    }
  });

  logger.info("Job completion listener set up successfully");
  return queueEventsInstance;
}

/**
 * Close queue events listener
 */
async function closeQueueEventsListener() {
  if (queueEventsInstance) {
    try {
      await queueEventsInstance.close();
      queueEventsInstance = null;
      logger.info("Queue events listener closed");
    } catch (error) {
      logger.error("Failed to close queue events listener:", error.message);
    }
  }
}

module.exports = {
  initializeQueues,
  getAgentQueue,
  getRepoAnalysisQueue,
  getCleanupQueue,
  enqueueAgentJob,
  enqueueRepoAnalysis,
  enqueueCleanup,
  getQueueStats,
  closeQueues,
  setupJobCompletionListener,
  closeQueueEventsListener,
};
