const badgeService = require("../services/badge.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get user badges
 * GET /users/me/badges
 */
async function getMyBadges(req, res, next) {
  try {
    const userId = req.user.userId;
    const badges = await badgeService.getUserBadges(userId);
    return res.json(successResponse(badges));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyBadges,
};
