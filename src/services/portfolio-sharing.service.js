const crypto = require("crypto");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { getPlan } = require("../config/plans");
const logger = require("../config/logger");

/**
 * Generate a unique share token for user's portfolio
 * Requires Premium or Pro subscription
 * @param {string} userId - User ID
 * @param {object} settings - Share settings (theme, expiresAt)
 * @returns {object} Share token and link
 */
async function generateShareToken(userId, settings = {}) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Check subscription plan
  const plan = getPlan(user.subscription.plan);
  if (!plan.features.portfolioSharing) {
    throw new AppError(
      "Portfolio sharing requires Premium or Pro subscription",
      403
    );
  }

  // Generate unique token
  const shareToken = crypto.randomUUID();

  // Update user with share settings
  user.portfolioShareToken = shareToken;
  user.portfolioShareSettings = {
    enabled: true,
    theme: settings.theme || "detailed",
    expiresAt: settings.expiresAt || null,
    customSlug: settings.customSlug || null,
  };

  await user.save();

  logger.info(`Portfolio share token generated for user ${userId}`);

  return {
    shareToken,
    shareLink: `${process.env.FRONTEND_URL}/portfolio/share/${shareToken}`,
    settings: user.portfolioShareSettings,
  };
}

/**
 * Get public portfolio by share token
 * No authentication required
 * @param {string} shareToken - Unique share token
 * @returns {object} Public portfolio data
 */
async function getPublicPortfolio(shareToken) {
  const user = await User.findOne({
    portfolioShareToken: shareToken,
    "portfolioShareSettings.enabled": true,
  });

  if (!user) {
    throw new AppError("Portfolio not found or sharing disabled", 404);
  }

  // Check if token is expired
  if (
    user.portfolioShareSettings.expiresAt &&
    new Date(user.portfolioShareSettings.expiresAt) < new Date()
  ) {
    throw new AppError("Share link has expired", 410);
  }

  // Return only public data
  return {
    name: user.name,
    username: user.username,
    bio: user.bio,
    skills: user.skills,
    preferredTechStack: user.preferredTechStack,
    careerGoal: user.careerGoal,
    experienceLevel: user.experienceLevel,
    portfolioLinks: user.portfolioLinks,
    customAvatar: user.customAvatar,
    image: user.image,
    theme: user.portfolioShareSettings.theme,
    // Do NOT include: email, private settings, subscription info
  };
}

/**
 * Update portfolio share settings
 * @param {string} userId - User ID
 * @param {object} settings - Updated settings
 * @returns {object} Updated settings
 */
async function updateShareSettings(userId, settings) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Merge with existing settings
  user.portfolioShareSettings = {
    ...user.portfolioShareSettings,
    ...settings,
  };

  await user.save();

  logger.info(`Portfolio share settings updated for user ${userId}`);

  return user.portfolioShareSettings;
}

/**
 * Disable portfolio sharing
 * @param {string} userId - User ID
 * @returns {object} Success message
 */
async function disableSharing(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.portfolioShareSettings.enabled = false;
  await user.save();

  logger.info(`Portfolio sharing disabled for user ${userId}`);

  return { message: "Portfolio sharing disabled successfully" };
}

/**
 * Get user's share settings and link
 * @param {string} userId - User ID
 * @returns {object} Share settings and link
 */
async function getShareInfo(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const plan = getPlan(user.subscription.plan);

  return {
    canShare: plan.features.portfolioSharing,
    planName: user.subscription.plan,
    shareToken: user.portfolioShareToken || null,
    shareLink: user.portfolioShareToken
      ? `${process.env.FRONTEND_URL}/portfolio/share/${user.portfolioShareToken}`
      : null,
    settings: user.portfolioShareSettings || null,
  };
}

module.exports = {
  generateShareToken,
  getPublicPortfolio,
  updateShareSettings,
  disableSharing,
  getShareInfo,
};
