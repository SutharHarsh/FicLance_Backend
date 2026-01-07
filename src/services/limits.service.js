const { User, Simulation } = require("../models");
const { getPlan } = require("../config/plans");
const { AppError } = require("../utils/errors");
const { isBetaMode } = require("../utils/betaMode");

/**
 * Check if user can create a new project
 * @param {string} userId - User ID
 * @returns {object} { allowed: boolean, reason?: string, remaining?: number }
 */
async function canCreateProject(userId) {
  // 1. Determine Max Projects Limit
  const config = require("../config/env");
  let maxProjects = config.maxActiveProjects;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  console.log(`[LimitCheck] Config Value: ${maxProjects}`);

  // Only check plan limit if ENV limit not set
  if (maxProjects === undefined || maxProjects === null) {
    const plan = getPlan(user.subscription.plan);
    maxProjects = plan.maxProjects;
    console.log(`[LimitCheck] Used Plan Limit: ${maxProjects}`);
  }

  // Only allow unlimited if both ENV and plan limits are not set AND beta mode is on
  if (maxProjects === undefined || maxProjects === null) {
    if (isBetaMode()) {
      maxProjects = null; // Unlimited
      console.log(`[LimitCheck] Used Beta Unlimited`);
    }
  }

  // 2. Get potentially active simulations
  // A project is potentially active if it's in an active state and not 100% complete
  const potentiallyActive = await Simulation.find({
    userId,
    state: { $in: ["created", "requirements_sent", "in_progress"] },
    $or: [
      { "meta.completionPercentage": { $exists: false } },
      { "meta.completionPercentage": { $lt: 100 } },
    ],
  }).lean();

  // 3. Filter out projects that have passed their deadline
  const now = new Date();
  const activeSims = potentiallyActive.filter((sim) => {
    const startDate = sim.startedAt || sim.createdAt;
    const durationDays =
      sim.templateSnapshot?.durationEstimateDays || sim.filters?.durationDays;

    if (startDate && durationDays) {
      const deadline = new Date(startDate);
      deadline.setDate(deadline.getDate() + durationDays);

      // Only count if deadline hasn't passed
      return now <= deadline;
    }

    // If no deadline info, count it as active
    return true;
  });

  const activeCount = activeSims.length;

  // Logging
  console.log(
    `[LimitCheck] User: ${user.email} | Potentially Active: ${
      potentiallyActive.length
    } | Active (after deadline filter): ${activeCount} | Limit: ${
      maxProjects !== null ? maxProjects : "Unlimited"
    }`
  );

  if (maxProjects !== null && activeCount >= maxProjects) {
    return {
      allowed: false,
      reason: `You have ${activeCount} active projects. Limit is ${maxProjects}. Complete an existing project before creating a new one.`,
    };
  }

  return {
    allowed: true,
    remaining: maxProjects === null ? null : maxProjects - activeCount,
  };
}

/**
 * Check if user can access a template with given expertise level
 * @param {string} userId - User ID
 * @param {string} expertiseLevel - Template expertise level
 * @returns {object} { allowed: boolean, reason?: string }
 */
async function canUseExpertise(userId, expertiseLevel) {
  // Beta mode: Allow all expertise levels
  if (isBetaMode()) {
    return { allowed: true, beta: true };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const plan = getPlan(user.subscription.plan);

  if (!plan.allowedExpertise.includes(expertiseLevel)) {
    return {
      allowed: false,
      reason: `Your ${plan.displayName} plan does not include ${expertiseLevel} templates. Please upgrade to access this template.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can make portfolio public
 * @param {string} userId - User ID
 * @returns {object} { allowed: boolean, reason?: string }
 */
async function canMakePublic(userId) {
  // Beta mode: Allow public portfolios
  if (isBetaMode()) {
    return { allowed: true, beta: true };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const plan = getPlan(user.subscription.plan);

  if (!plan.canMakePublic) {
    return {
      allowed: false,
      reason: `Your ${plan.displayName} plan does not support public portfolios. Please upgrade to Premium or Pro.`,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can use a specific theme
 * @param {string} userId - User ID
 * @param {number} themeId - Theme ID
 * @returns {object} { allowed: boolean, reason?: string }
 */
async function canUseTheme(userId, themeId) {
  // Beta mode: Allow all themes
  if (isBetaMode()) {
    return { allowed: true, beta: true };
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const plan = getPlan(user.subscription.plan);

  // Pro plan has access to all themes
  if (plan.allowedThemes === "all") {
    return { allowed: true };
  }

  if (!plan.allowedThemes.includes(themeId)) {
    return {
      allowed: false,
      reason: `Your ${plan.displayName} plan includes ${plan.allowedThemes.length} theme(s). Please upgrade to access more themes.`,
    };
  }

  return { allowed: true };
}

/**
 * Get user's plan limits and current usage
 * @param {string} userId - User ID
 * @returns {object} Limits and usage information
 */
async function getUserLimits(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Beta mode: Return unlimited limits (unless MAX_ACTIVE_PROJECTS set)
  if (isBetaMode()) {
    const config = require("../config/env");
    const maxActive = config.maxActiveProjects;

    // Use the same active counting logic
    const canCreate = await canCreateProject(userId);

    const simulationCount = await Simulation.countDocuments({
      userId,
      state: { $nin: ["archived", "canceled"] },
    });

    return {
      plan: {
        name: "beta",
        displayName: "Beta",
      },
      limits: {
        maxProjects: maxActive || null,
        allowedExpertise: ["beginner", "intermediate", "advanced"],
        allowedThemes: "all",
        canMakePublic: true,
      },
      usage: {
        projectsUsed: simulationCount,
        projectsRemaining: maxActive
          ? maxActive - canCreate.activeCount || 0
          : null,
      },
      capabilities: {
        canCreateProject: canCreate.allowed,
        canAccessIntermediate: true,
        canAccessAdvanced: true,
        canMakePublic: true,
      },
      reason: canCreate.allowed ? null : canCreate.reason,
      beta: true,
    };
  }

  const plan = getPlan(user.subscription.plan);

  // Get current project count
  const simulationCount = await Simulation.countDocuments({
    userId,
    state: { $nin: ["archived", "canceled"] },
  });

  return {
    plan: {
      name: plan.name,
      displayName: plan.displayName,
    },
    limits: {
      maxProjects: plan.maxProjects,
      allowedExpertise: plan.allowedExpertise,
      allowedThemes: plan.allowedThemes,
      canMakePublic: plan.canMakePublic,
    },
    usage: {
      projectsUsed: simulationCount,
      projectsRemaining:
        plan.maxProjects === null ? null : plan.maxProjects - simulationCount,
    },
    capabilities: {
      canCreateProject:
        plan.maxProjects === null || simulationCount < plan.maxProjects,
      canAccessIntermediate: plan.allowedExpertise.includes("intermediate"),
      canAccessAdvanced: plan.allowedExpertise.includes("advanced"),
      canMakePublic: plan.canMakePublic,
    },
  };
}

module.exports = {
  canCreateProject,
  canUseExpertise,
  canMakePublic,
  canUseTheme,
  getUserLimits,
};
