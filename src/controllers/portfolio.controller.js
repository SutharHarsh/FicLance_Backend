const portfolioService = require("../services/portfolio.service");
const userService = require("../services/user.service");
const dashboardService = require("../services/dashboard.service");
const { User } = require("../models");
const { successResponse, errorResponse } = require("../utils/response");
const { AppError } = require("../utils/errors");

/**
 * Get public portfolio data by username
 * GET /portfolio/:username
 */
async function getPublicPortfolio(req, res, next) {
  try {
    const { username } = req.params;

    // Find user by username
    const user = await User.findOne({
      "profile.username": username,
      deleted: false,
    });

    if (!user) {
      throw new AppError("Portfolio not found", 404);
    }

    // Check if portfolio is public
    if (!user.profile?.portfolio?.isPublic) {
      throw new AppError("This portfolio is private", 403);
    }

    const userId = user._id;

    // Fetch all necessary data for portfolio
    const [stats, projects, skills, badges] = await Promise.all([
      dashboardService.getUserStats(userId),
      dashboardService.getProjects(userId, "completed"),
      dashboardService.getUserSkills(userId),
      dashboardService.syncAndGetBadges(userId),
    ]);

    // Return combined data
    return res.json(
      successResponse({
        user: {
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          about: user.about,
          description: user.description,
          profile: user.profile,
        },
        stats,
        projects,
        skills,
        badges,
      })
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Analyze repository (Async)
 */
async function analyzeRepository(req, res, next) {
  try {
    const userId = req.user.userId;
    const { repoUrl, branch, simulationId } = req.body;

    const result = await portfolioService.analyzeRepository(
      userId,
      repoUrl,
      branch,
      null,
      simulationId
    );

    return res.json(successResponse(result, "Analysis enqueued"));
  } catch (error) {
    next(error);
  }
}

/**
 * Analyze repository (Sync)
 */
async function analyzeRepositorySync(req, res, next) {
  try {
    const userId = req.user.userId;
    const { repoUrl, branch, simulationId } = req.body;

    const result = await portfolioService.analyzeRepositorySync(
      userId,
      repoUrl,
      branch,
      null,
      simulationId
    );

    return res.json(successResponse(result, "Analysis completed"));
  } catch (error) {
    next(error);
  }
}

/**
 * List user portfolios
 */
async function listUserPortfolio(req, res, next) {
  try {
    const userId = req.user.userId;
    const { status, limit, skip } = req.query;

    const result = await portfolioService.listUserPortfolio(
      userId,
      { status },
      { limit: parseInt(limit), skip: parseInt(skip) }
    );

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Get specific portfolio
 */
async function getPortfolio(req, res, next) {
  try {
    const { id } = req.params;
    const portfolio = await portfolioService.getPortfolioById(id);

    return res.json(successResponse(portfolio));
  } catch (error) {
    next(error);
  }
}

/**
 * Retry failed analysis
 */
async function retryAnalysis(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await portfolioService.retryAnalysis(id, userId);

    return res.json(successResponse(result, "Analysis retry enqueued"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicPortfolio,
  analyzeRepository,
  analyzeRepositorySync,
  listUserPortfolio,
  getPortfolio,
  retryAnalysis,
};
