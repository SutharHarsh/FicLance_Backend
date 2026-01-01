const dashboardService = require("../services/dashboard.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get dashboard data
 * GET /dashboard
 */
async function getDashboard(req, res, next) {
  try {
    const userId = req.user.userId;

    const [stats, activity, suggestions, skills, badges] = await Promise.all([
      dashboardService.getUserStats(userId),
      dashboardService.getRecentActivity(userId),
      dashboardService.getSuggestedTemplates(userId),
      dashboardService.getUserSkills(userId),
      dashboardService.syncAndGetBadges(userId),
    ]);

    return res.json(
      successResponse({
        stats,
        activity,
        suggestions,
        skills,
        badges,
        user: {
          name: req.user.name,
          email: req.user.email,
        },
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get only stats
 * GET /dashboard/stats
 */
async function getStats(req, res, next) {
  try {
    const userId = req.user.userId;
    const stats = await dashboardService.getUserStats(userId);
    return res.json(successResponse(stats));
  } catch (error) {
    next(error);
  }
}

/**
 * Get projects
 * GET /projects?type=recent|in-progress|completed|deadlines
 */
async function getProjects(req, res, next) {
  try {
    const userId = req.user.userId;
    const type = req.query.type || "recent";
    const projects = await dashboardService.getProjects(userId, type);
    return res.json(successResponse(projects));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  getStats,
  getProjects,
};
