const limitsService = require("../services/limits.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get user's plan limits and usage
 * GET /limits/check
 */
async function checkLimits(req, res, next) {
  try {
    const userId = req.user.userId;

    const limits = await limitsService.getUserLimits(userId);

    return res.json(successResponse(limits));
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user can create a new project
 * GET /limits/can-create-project
 */
async function canCreateProject(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await limitsService.canCreateProject(userId);

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkLimits,
  canCreateProject,
};
