const { Feedback } = require("../models");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Create feedback (called by agent/worker)
 * POST /feedback
 */
async function createFeedback(req, res, next) {
  try {
    const data = req.body;

    const feedback = await Feedback.create(data);

    return res.status(201).json(successResponse(feedback, "Feedback created"));
  } catch (error) {
    next(error);
  }
}

/**
 * Get feedback for a simulation
 * GET /simulations/:simulationId/feedback
 */
async function getSimulationFeedback(req, res, next) {
  try {
    const { simulationId } = req.params;

    const feedback = await Feedback.findOne({ simulationId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(successResponse(feedback));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createFeedback,
  getSimulationFeedback,
};
