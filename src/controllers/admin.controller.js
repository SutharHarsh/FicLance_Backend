const { getQueueStats } = require("../services/queue.service");
const { Job } = require("../models");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * List jobs and queue statistics (admin only)
 * GET /admin/jobs
 */
async function listJobs(req, res, next) {
  try {
    const { queue, status, limit, skip } = req.query;

    // Get queue stats
    const queueNames = ["agentQueue", "repoAnalysisQueue", "cleanupQueue"];
    const stats = {};

    for (const queueName of queueNames) {
      stats[queueName] = await getQueueStats(queueName);
    }

    // Get recent jobs from database
    const query = {};
    if (queue) query.type = queue;
    if (status) query.status = status;

    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const skipNum = parseInt(skip) || 0;

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip(skipNum)
      .lean();

    const total = await Job.countDocuments(query);

    return res.json(
      successResponse({
        queueStats: stats,
        jobs: {
          items: jobs,
          total,
          limit: limitNum,
          skip: skipNum,
        },
      })
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listJobs,
};
