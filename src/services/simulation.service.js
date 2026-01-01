const { Simulation, User } = require("../models");
const Project = require("../../models/Project");
const { enqueueAgentJob } = require("./queue.service");
const { AppError } = require("../utils/errors");
const { emitToSimulation } = require("../socket");
const logger = require("../config/logger");

/**
 * Helper to parse duration strings (e.g., "1-2 Hours", "3-5 days") into hours
 */
function parseDurationToHours(durationStr) {
  if (!durationStr) return null;

  const str = durationStr.toLowerCase().trim();
  const numericMatch = str.match(/(\d+)(?:-(\d+))?/);
  if (!numericMatch) return null;

  const min = parseInt(numericMatch[1]);
  const max = numericMatch[2] ? parseInt(numericMatch[2]) : min;

  // Default to the max value of the range
  let value = max;

  if (str.includes("hour")) return value;
  if (str.includes("day")) return value * 24;
  if (str.includes("week")) return value * 168;
  if (str.includes("month")) return value * 720;

  // Fallback to days if no unit found but it's a number
  return value * 24;
}

/**
 * Create a new simulation
 */
async function createSimulation(userId, data) {
  const { projectTemplateId, projectName, projectDescription, filters } = data;

  // Idempotency guard: return a recent matching simulation to avoid duplicates
  // This protects against React StrictMode double-invocation and fast double clicks.
  const recentWindowMs = 30000; // 30s window
  const recentExisting = await Simulation.findOne({
    userId,
    projectName,
    projectTemplateId: projectTemplateId || null,
    createdAt: { $gte: new Date(Date.now() - recentWindowMs) },
  }).lean();
  if (recentExisting) {
    logger.warn(
      `Duplicate simulation attempt prevented; reusing ${recentExisting._id} for user ${userId}`
    );
    return recentExisting;
  }

  // Get template if ID provided (optional)
  let templateSnapshot = null;
  if (projectTemplateId) {
    try {
      const template = await Project.findById(projectTemplateId);
      if (template) {
        // Combine requiredSkills and technologies (supporting legacy structure)
        const combinedSkills = Array.from(
          new Set([
            ...(Array.isArray(template.requiredSkills)
              ? template.requiredSkills
              : []),
            ...(Array.isArray(template.technologies) ? template.technologies : []),
          ])
        );

        // Parse duration to hours for more precision
        const estimatedHours = template.duration
          ? parseDurationToHours(template.duration)
          : template.durationEstimateDays
          ? parseDurationToHours(template.durationEstimateDays)
          : null;

        templateSnapshot = {
          name: template.name || template.title,
          shortDescription: template.shortDescription || template.description,
          requiredSkills: combinedSkills,
          expertiseLevel: template.expertiseLevel || template.difficulty,
          durationEstimateDays: estimatedHours ? estimatedHours / 24 : null,
          complexityScore: template.complexityScore || template.difficultyLevel,
          version: template.version,
        };
      }
    } catch (err) {
      // Template not found - continue without template snapshot
      logger.warn(`[SimService] Template ${projectTemplateId} not found, continuing without snapshot`);
    }
  }

  // Get user info for participants
  const user = await User.findById(userId);

  // Create simulation
  const simulation = await Simulation.create({
    userId,
    projectTemplateId,
    templateSnapshot,
    projectName,
    projectDescription,
    filters,
    state: "created",
    participants: [
      {
        id: userId,
        type: "user",
        role: "Freelancer",
        displayName: user.name,
        avatarUrl: user.avatarUrl,
      },
    ],
  });

  // Process Agent 1 immediately (synchronous fallback when Redis/worker not available)
  // TODO: Re-enable queue when Redis is configured
  try {
    const agentService = require("./agent.service");
    const { Message } = require("../models");
    const { emitToSimulation } = require("../socket");

    logger.info(
      `Processing Agent 1 synchronously for simulation: ${simulation._id}`
    );

    const getAgentDuration = () => {
      if (filters?.durationDays) return `${filters.durationDays} days`;
      if (simulation.templateSnapshot?.durationEstimateDays) {
        const days = simulation.templateSnapshot.durationEstimateDays;
        if (days < 1) return `${Math.round(days * 24)} hours`;
        return `${Math.round(days)} days`;
      }
      return undefined;
    };

    const agentPayload = {
      simulationId: simulation._id.toString(),
      projectName,
      description: projectDescription,
      expertise:
        filters?.expertise || simulation.templateSnapshot?.expertiseLevel,
      techStack: simulation.templateSnapshot?.requiredSkills || filters?.skills,
      duration: getAgentDuration(),
    };

    const agentResponse = await agentService.generateRequirements(agentPayload);
    const reqData = agentResponse.message || agentResponse;

    // Update simulation
    if (!simulation.templateSnapshot) simulation.templateSnapshot = {};
    simulation.templateSnapshot.requirements = reqData;
    simulation.currentAgent = "Agent1";
    await simulation.save();
    await simulation.transitionState("requirements_sent", userId);

    // Create clean message with document attachment (NO content duplication)
    const message = await Message.create({
      simulationId: simulation._id,
      sequence: 1,
      sender: { type: "agent", agentName: reqData.client_name || "Client" },
      content: `Hey, my name is ${
        reqData.client_name || "the client"
      } and I am giving you a project **${
        reqData.project_name || projectName
      }**. In the attached document you can find all the requirements regarding the project.`,
      contentType: "text",
      metadata: {
        hasDocument: true,
        fileName: `${projectName}_Requirements.docx`,
        fileSize: "245 KB • Word Document",
        // Store ALL requirements data in metadata for document generation
        clientName: reqData.client_name,
        client_name: reqData.client_name,
        duration: reqData.duration,
        techStack: reqData.tech_stack,
        tech_stack: reqData.tech_stack,
        projectDescription: reqData.description,
        description: reqData.description,
        expertise: filters?.expertise || reqData.expertise,
        acceptance_criteria: reqData.acceptance_criteria, // CRITICAL: Include acceptance criteria
        project_name: reqData.project_name || projectName,
      },
    });

    // Emit socket event
    try {
      emitToSimulation(
        simulation._id.toString(),
        "message:created",
        message.toObject()
      );
    } catch (sockErr) {
      logger.error("Socket emit failed:", sockErr);
    }

    logger.info(
      `Agent 1 completed synchronously for simulation: ${simulation._id}`
    );
  } catch (agentErr) {
    logger.error(`Synchronous Agent 1 failed: ${agentErr.message}`, agentErr);
    // Continue anyway - user can still use the chat
  }

  // Save simulation with templateSnapshot before transitioning
  await simulation.save();

  // Update user usage stats
  user.usage.simulationsCount += 1;
  user.usage.lastSimulationAt = new Date();
  await user.save();

  logger.info(`Simulation created: ${simulation._id} for user: ${userId}`);

  return simulation.toObject();
}

/**
 * Get simulation by ID
 */
async function getSimulationById(simulationId) {
  const simulation = await Simulation.findById(simulationId)
    .populate("userId", "name email avatarUrl")
    .populate("projectTemplateId", "name shortDescription")
    .lean();

  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  return simulation;
}

/**
 * List simulations for a user
 */
async function listUserSimulations(userId, filters = {}, pagination = {}) {
  const { state } = filters;
  const { limit = 20, skip = 0 } = pagination;

  const query = { userId };
  if (state) query.state = state;

  const simulations = await Simulation.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(skip)
    .lean();

  const total = await Simulation.countDocuments(query);

  return {
    items: simulations,
    total,
    limit,
    skip,
  };
}

/**
 * Start a simulation (transition to in_progress)
 */
async function startSimulation(simulationId, userId) {
  const simulation = await Simulation.findById(simulationId);

  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  if (simulation.userId.toString() !== userId.toString()) {
    throw new AppError("Not authorized", 403);
  }

  await simulation.transitionState("in_progress", userId);

  // Emit state change event
  try {
    emitToSimulation(simulationId, "simulation:stateChanged", {
      simulationId,
      state: "in_progress",
    });
  } catch (error) {
    logger.error("Failed to emit simulation:stateChanged event:", error);
  }

  logger.info(`Simulation started: ${simulationId}`);

  return simulation.toObject();
}

/**
 * Update simulation state
 */
async function updateSimulationState(simulationId, newState, userId) {
  const simulation = await Simulation.findById(simulationId);

  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  if (simulation.userId.toString() !== userId.toString()) {
    throw new AppError("Not authorized", 403);
  }

  await simulation.transitionState(newState, userId);

  // Emit state change event
  try {
    emitToSimulation(simulationId, "simulation:stateChanged", {
      simulationId,
      state: newState,
    });
  } catch (error) {
    logger.error("Failed to emit simulation:stateChanged event:", error);
  }

  logger.info(`Simulation state updated: ${simulationId} -> ${newState}`);

  return simulation.toObject();
}

/**
 * Add participant to simulation
 */
async function addParticipant(simulationId, participantData) {
  const simulation = await Simulation.findById(simulationId);

  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  await simulation.addParticipant(participantData);

  logger.info(`Participant added to simulation: ${simulationId}`);

  return simulation.toObject();
}

/**
 * Archive simulation
 */
async function archiveSimulation(simulationId, userId) {
  const simulation = await Simulation.findById(simulationId);

  if (!simulation) {
    throw new AppError("Simulation not found", 404);
  }

  if (simulation.userId.toString() !== userId.toString()) {
    throw new AppError("Not authorized", 403);
  }

  await simulation.transitionState("archived", userId);

  logger.info(`Simulation archived: ${simulationId}`);

  return simulation.toObject();
}

module.exports = {
  createSimulation,
  getSimulationById,
  listUserSimulations,
  startSimulation,
  updateSimulationState,
  addParticipant,
  archiveSimulation,
};
