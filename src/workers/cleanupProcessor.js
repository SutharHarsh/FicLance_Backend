const { File, AuthSession } = require('../models');
const { deleteFileFromS3 } = require('../services/file.service');
const logger = require('../config/logger');

/**
 * Process cleanup jobs
 * @param {Object} job - BullMQ job
 * @returns {Promise<any>} Job result
 */
async function processCleanupJob(job) {
  const { type } = job.data;
  
  logger.info(`Processing cleanup job: ${job.id}`, { type });

  try {
    let result;

    switch (type) {
      case 'file':
        result = await cleanupFile(job.data);
        break;
      case 'session':
        result = await cleanupExpiredSessions(job.data);
        break;
      case 'simulation':
        result = await cleanupSimulation(job.data);
        break;
      default:
        throw new Error(`Unknown cleanup job type: ${type}`);
    }

    logger.info(`Cleanup job completed: ${job.id}`, { type });
    
    return result;
  } catch (error) {
    logger.error(`Cleanup job failed: ${job.id}`, {
      type,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Cleanup deleted file from S3
 */
async function cleanupFile(data) {
  const { fileId, bucket, key } = data;

  // Verify file is marked as deleted
  const file = await File.findById(fileId);
  if (!file || !file.deleted) {
    logger.warn(`File ${fileId} not marked as deleted, skipping S3 cleanup`);
    return { skipped: true };
  }

  // Delete from S3
  await deleteFileFromS3(bucket, key);

  logger.info(`File cleaned up from S3: ${fileId}`);

  return { fileId, deleted: true };
}

/**
 * Cleanup expired auth sessions
 */
async function cleanupExpiredSessions(data) {
  const result = await AuthSession.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { revoked: true, updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // 30 days old
    ],
  });

  logger.info(`Expired sessions cleaned up: ${result.deletedCount}`);

  return { deletedCount: result.deletedCount };
}

/**
 * Cleanup simulation data (placeholder)
 */
async function cleanupSimulation(data) {
  const { simulationId } = data;

  // Placeholder for simulation cleanup logic
  // Could include archiving old messages, clearing cache, etc.

  logger.info(`Simulation cleanup completed: ${simulationId}`);

  return { simulationId, cleaned: true };
}

module.exports = {
  processCleanupJob,
  cleanupFile,
  cleanupExpiredSessions,
  cleanupSimulation,
};
