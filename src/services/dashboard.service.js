const { User, Simulation, Portfolio, Badge } = require("../models");

/**
 * Get dashboard statistics for a user
 */
async function getUserStats(userId) {
  // Get all potentially active simulations
  const potentiallyActive = await Simulation.find({
    userId,
    state: { $in: ["created", "requirements_sent", "in_progress"] },
    $or: [
      { "meta.completionPercentage": { $exists: false } },
      { "meta.completionPercentage": { $lt: 80 } },
    ],
  }).lean();

  // Filter out projects that have passed their deadline
  // Filter out projects that have passed their deadline
  const now = new Date();
  const activeSimulations = potentiallyActive.filter((sim) => {
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
  }).length;

  const [completedSimulations, totalSimulations, portfolioItems] =
    await Promise.all([
      Simulation.countDocuments({
        userId,
        $or: [
          { state: "completed" },
          { "meta.completionPercentage": { $gte: 80 } },
        ],
      }),
      Simulation.countDocuments({ userId }),
      Portfolio.countDocuments({ userId, status: "done" }),
    ]);

  return {
    activeSimulations,
    completedSimulations,
    totalSimulations,
    portfolioItems,
  };
}

/**
 * Get recent activity
 */
async function getRecentActivity(userId, limit = 5) {
  // Fetch recent simulations
  const simulations = await Simulation.find({ userId })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .populate("projectTemplateId", "name")
    .select("projectName state lastMessageAt createdAt settings meta")
    .lean();

  return simulations.map((sim) => {
    const computedState =
      (sim.meta?.completionPercentage || 0) >= 80 ? "completed" : sim.state;
    return {
      id: sim._id,
      type: "simulation",
      title: sim.projectName,
      subtitle: computedState.replace("_", " "),
      date: sim.lastMessageAt || sim.createdAt,
      meta: sim.meta,
      status: computedState,
      deadlineTimestamp: calculateDeadlineTimestamp(sim),
    };
  });
}

function calculateDeadlineTimestamp(sim) {
  let deadlineTimestamp = null;
  if (sim.filters && sim.filters.durationDays) {
    const startDate = sim.startedAt || sim.createdAt;
    deadlineTimestamp =
      new Date(startDate).getTime() +
      sim.filters.durationDays * 24 * 60 * 60 * 1000;
  } else if (
    sim.templateSnapshot &&
    sim.templateSnapshot.durationEstimateDays
  ) {
    const startDate = sim.startedAt || sim.createdAt;
    deadlineTimestamp =
      new Date(startDate).getTime() +
      sim.templateSnapshot.durationEstimateDays * 24 * 60 * 60 * 1000;
  }
  return deadlineTimestamp;
}

/**
 * Get suggested templates based on user skills (simple logic for now)
 */
async function getSuggestedTemplates(userId) {
  // In a real app, we'd match user skills to template requirements
  // For now, return random active templates
  const { ProjectTemplate } = require("../models");

  return await ProjectTemplate.find({ isActive: true })
    .sort({ popularity: -1 })
    .limit(3)
    .select(
      "name shortDescription expertiseLevel durationEstimateDays requiredSkills"
    )
    .lean();
}

/**
 * Get projects by type
 * type: 'recent' | 'in-progress' | 'completed' | 'deadlines'
 */
async function getProjects(userId, type) {
  let query = { userId };
  let sort = { lastMessageAt: -1 };
  let limit = 20;

  if (type === "in-progress") {
    query = {
      userId,
      state: { $in: ["created", "requirements_sent", "in_progress"] },
      $or: [
        { "meta.completionPercentage": { $exists: false } },
        { "meta.completionPercentage": { $lt: 80 } },
      ],
    };
  } else if (type === "completed") {
    query = {
      userId,
      $or: [
        { state: "completed" },
        { "meta.completionPercentage": { $gte: 80 } },
      ],
    };
    sort = { endedAt: -1 };
  } else if (type === "deadlines") {
    query = {
      userId,
      state: { $in: ["created", "requirements_sent", "in_progress"] },
      $or: [
        { "meta.completionPercentage": { $exists: false } },
        { "meta.completionPercentage": { $lt: 80 } },
      ],
    };
    // We'll filter and sort by deadline in memory since it's dynamic
  } else if (type === "deadline-passed") {
    query = {
      userId,
      state: { $in: ["created", "requirements_sent", "in_progress"] },
      $or: [
        { "meta.completionPercentage": { $exists: false } },
        { "meta.completionPercentage": { $lt: 80 } },
      ],
    };
  }

  const simulations = await Simulation.find(query)
    .sort(sort)
    .limit(limit)
    .populate("projectTemplateId", "name")
    .lean();

  let projects = simulations.map((sim) => {
    // Calculate deadline
    let deadlineTimestamp = calculateDeadlineTimestamp(sim);

    // Calculate progress - try multiple sources
    let progress = 0;
    if (
      sim.meta?.completionPercentage !== undefined &&
      sim.meta.completionPercentage !== null
    ) {
      progress = sim.meta.completionPercentage;
    } else if (sim.meta?.score !== undefined && sim.meta.score !== null) {
      progress = sim.meta.score;
    } else if (sim.state === "completed") {
      progress = 100;
    }

    return {
      id: sim._id,
      title: sim.projectName,
      description: sim.projectDescription,
      state: sim.state,
      progress: progress,
      date: sim.endedAt
        ? new Date(sim.endedAt).toLocaleDateString()
        : new Date(sim.createdAt).toLocaleDateString(),
      deadlineTimestamp,
      month: deadlineTimestamp
        ? new Date(deadlineTimestamp).toLocaleString("default", {
            month: "short",
          })
        : "",
      dateStr: deadlineTimestamp ? new Date(deadlineTimestamp).getDate() : "", // Renamed to avoid conflict with 'date' field
      priority: "Medium", // Default, could be derived from complexity
    };
  });

  // Filter projects based on type and deadline status
  if (type === "in-progress") {
    // Only show projects with future deadlines (or no deadline info)
    projects = projects.filter((p) => {
      // If no deadline timestamp, include it (conservative approach)
      if (!p.deadlineTimestamp) return true;
      // Only include if deadline hasn't passed
      return p.deadlineTimestamp > Date.now();
    });
  } else if (type === "deadlines") {
    projects = projects
      .filter((p) => p.deadlineTimestamp && p.deadlineTimestamp > Date.now()) // Only those with future deadlines
      .sort((a, b) => a.deadlineTimestamp - b.deadlineTimestamp); // Earliest deadline first
  } else if (type === "deadline-passed") {
    projects = projects
      .filter((p) => p.deadlineTimestamp && p.deadlineTimestamp <= Date.now()) // Only those with past deadlines
      .sort((a, b) => b.deadlineTimestamp - a.deadlineTimestamp); // Most recent deadline first
  }

  return projects;
}

/**
 * Get aggregated skills mastery for a user
 */
async function getUserSkills(userId) {
  const [portfolios, simulations] = await Promise.all([
    Portfolio.find({ userId, status: "done" }).select("analysisMeta").lean(),
    Simulation.find({
      userId,
      $or: [
        { state: "completed" },
        { "meta.completionPercentage": { $gte: 80 } },
      ],
    })
      .select("templateSnapshot meta filters projectTemplateId")
      .lean(),
  ]);

  const skillMetrics = {};

  // Preload template skills if needed
  const simsNeedingTemplate = simulations.filter(
    (s) =>
      (!s.templateSnapshot?.requiredSkills ||
        s.templateSnapshot.requiredSkills.length === 0) &&
      (!s.filters?.skills || s.filters.skills.length === 0) &&
      s.projectTemplateId
  );

  let templateSkillsMap = {};
  if (simsNeedingTemplate.length > 0) {
    const { ProjectTemplate } = require("../models");
    const ids = Array.from(
      new Set(simsNeedingTemplate.map((s) => String(s.projectTemplateId)))
    );
    const templates = await ProjectTemplate.find({ _id: { $in: ids } })
      .select("requiredSkills")
      .lean();
    templateSkillsMap = templates.reduce((acc, t) => {
      acc[String(t._id)] = t.requiredSkills || [];
      return acc;
    }, {});
  }

  // Process Portfolio Languages
  portfolios.forEach((p) => {
    const languages = p.analysisMeta?.languageBreakdown || [];
    languages.forEach((lang) => {
      if (!skillMetrics[lang.language]) {
        skillMetrics[lang.language] = { weight: 0, frequency: 0 };
      }
      // Weight by percentage in repo
      skillMetrics[lang.language].weight += (lang.percentage || 0) * 1.2;
      skillMetrics[lang.language].frequency += 1;
    });
  });

  // Process Completed Simulations
  simulations.forEach((sim) => {
    const skillsFromTemplate = sim.templateSnapshot?.requiredSkills || [];
    const skillsFromFilters = sim.filters?.skills || [];
    const skillsFromProjectTemplate =
      templateSkillsMap[String(sim.projectTemplateId)] || [];
    const mergedSkills = Array.from(
      new Set([
        ...(skillsFromTemplate || []),
        ...(skillsFromFilters || []),
        ...(skillsFromProjectTemplate || []),
      ])
    );

    const weightBase =
      (sim.meta?.score ?? sim.meta?.completionPercentage ?? 100) / 100;

    mergedSkills.forEach((skillName) => {
      if (!skillName) return;
      if (!skillMetrics[skillName]) {
        skillMetrics[skillName] = { weight: 0, frequency: 0 };
      }
      // Each completion counts as 50 points, weighted by score/completion
      skillMetrics[skillName].weight += weightBase * 50;
      skillMetrics[skillName].frequency += 1;
    });
  });

  // Convert to array and calculate final percentage
  const skillsArray = Object.keys(skillMetrics).map((name) => {
    const data = skillMetrics[name];
    // Formula: (Total Weight / Frequency) + (Bonus for repetition)
    // Max capped at 100
    let percent = Math.min(
      Math.round(data.weight / (data.frequency || 1) + data.frequency * 5),
      100
    );

    return {
      name,
      percent,
      rawWeight: data.weight, // for sorting
    };
  });

  // Sort by weight/frequency and take top 6
  return skillsArray
    .sort((a, b) => b.rawWeight - a.rawWeight)
    .slice(0, 6)
    .map(({ name, percent }) => ({ name, percent }));
}

/**
 * Synchronize and get achievement badges for a user
 */
async function syncAndGetBadges(userId) {
  const [earnedBadges, simulations, portfolios] = await Promise.all([
    Badge.find({ userId }).lean(),
    Simulation.find({ userId })
      .select("state meta createdAt updatedAt")
      .sort({ createdAt: 1 })
      .lean(),
    Portfolio.find({ userId, status: "done" }).select("analysisMeta").lean(),
  ]);

  const earnedTypes = new Set(earnedBadges.map((b) => b.type));
  const newBadges = [];

  const checkAndAdd = (type, name, description, icon, criteria) => {
    if (!earnedTypes.has(type) && criteria) {
      newBadges.push({
        userId,
        type,
        name,
        description,
        icon,
      });
    }
  };

  // 1. First Simulation
  checkAndAdd(
    "first_simulation",
    "Trailblazer",
    "Started your very first project simulation.",
    "RiSettings4Line",
    simulations.length > 0
  );

  // 2. Simulation Master (5+ completed)
  const completedCount = simulations.filter(
    (s) => s.state === "completed"
  ).length;
  checkAndAdd(
    "simulation_master",
    "Project Pro",
    "Completed 5 project simulations with excellence.",
    "RiVipDiamondLine",
    completedCount >= 5
  );

  // 3. Portfolio Builder (3+ repos)
  checkAndAdd(
    "portfolio_builder",
    "Curated Portfolio",
    "Analyzed and added 3+ repositories to your professional portfolio.",
    "RiFolderOpenLine",
    portfolios.length >= 3
  );

  // 4. Bug Hunter (Done status, 0 security findings)
  const zeroSecurityProjects = portfolios.filter(
    (p) => p.analysisMeta?.securityFindings?.length === 0
  );
  checkAndAdd(
    "bug_hunter",
    "Sentinel",
    "Shipped a repository with zero security vulnerabilities detected.",
    "RiShieldCheckLine",
    zeroSecurityProjects.length > 0
  );

  // 5. Perfect Score (100/100)
  const hasPerfectScore = simulations.some((s) => s.meta?.score === 100);
  checkAndAdd(
    "perfect_score",
    "Mastermind",
    "Achieved a perfect performance score of 100 in a simulation.",
    "RiStarFill",
    hasPerfectScore
  );

  // 6. Velocity (Fast Learner) - Completed in < 30 mins with score > 80
  const fastCompletion = simulations.some((s) => {
    if (s.state !== "completed" || !s.createdAt || !s.updatedAt) return false;
    const durationMins =
      (new Date(s.updatedAt) - new Date(s.createdAt)) / (1000 * 60);
    return durationMins < 30 && (s.meta?.score || 0) > 80;
  });
  checkAndAdd(
    "fast_learner",
    "Velocity",
    "Completed a full simulation in under 30 minutes with high precision.",
    "RiTimeLine",
    fastCompletion
  );

  // 7. Team Player (Synergist) - Average communication rating > 4
  const teamPlayerCriteria =
    simulations.length >= 3 &&
    simulations.reduce((acc, s) => acc + (s.meta?.communicationScore || 0), 0) /
      simulations.length >=
      4;
  checkAndAdd(
    "team_player",
    "Synergist",
    "Demonstrated exceptional communication and collaboration skills.",
    "RiTeamLine",
    teamPlayerCriteria
  );

  // 8. Rising Star (Supernova) - Improvement streak
  const risingStarCriteria =
    simulations.length >= 3 &&
    (simulations[simulations.length - 1].meta?.score || 0) >
      (simulations[0].meta?.score || 0);
  // Simplified logic for "improvement" over first vs last
  checkAndAdd(
    "rising_star",
    "Supernova",
    "Showcased remarkable growth and momentum across projects.",
    "RiFlashlightLine",
    risingStarCriteria
  );

  // Save new badges if any
  if (newBadges.length > 0) {
    await Badge.insertMany(newBadges);
    // Refresh earned list
    const updatedEarned = await Badge.find({ userId }).lean();
    return updatedEarned;
  }

  return earnedBadges;
}

module.exports = {
  getUserStats,
  getRecentActivity,
  getSuggestedTemplates,
  getProjects,
  getUserSkills,
  syncAndGetBadges,
};
