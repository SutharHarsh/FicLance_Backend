const simulationService = require("../services/simulation.service");
const limitsService = require("../services/limits.service");
const Project = require("../../models/Project");
const { successResponse, errorResponse } = require("../utils/response");
const mongoose = require("mongoose");

/**
 * Create a new simulation
 * POST /simulations
 */
async function createSimulation(req, res, next) {
  try {
    const userId = req.user.userId;
    const data = req.body;

    // Check project creation limit
    const canCreate = await limitsService.canCreateProject(userId);
    if (!canCreate.allowed) {
      return res.status(403).json(errorResponse(canCreate.reason));
    }

    // Determine expertise level for validation
    let expertiseLevel = data.filters?.expertise || "intermediate";
    
    // Check expertise level if template provided (optional)
    if (data.projectTemplateId) {
      // Validate MongoDB ObjectId format
      if (mongoose.Types.ObjectId.isValid(data.projectTemplateId)) {
        try {
          const template = await Project.findById(data.projectTemplateId);
          if (template && template.expertiseLevel) {
            expertiseLevel = template.expertiseLevel;
          }
        } catch (err) {
          // Template not found - continue with filters.expertise
          console.log(`[Simulation] Template ${data.projectTemplateId} not found, using filters.expertise`);
        }
      } else {
        console.log(`[Simulation] Invalid ObjectId format: ${data.projectTemplateId}, using filters.expertise`);
      }
    }

    // Validate expertise level access
    const canUse = await limitsService.canUseExpertise(userId, expertiseLevel);
    if (!canUse.allowed) {
      return res.status(403).json(errorResponse(canUse.reason));
    }

    // Create simulation
    const simulation = await simulationService.createSimulation(userId, data);

    return res.status(202).json(
      successResponse(
        {
          simulationId: simulation._id,
          simulation,
        },
        "Simulation created and agent job enqueued"
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Get simulation by ID
 * GET /simulations/:id
 */
async function getSimulation(req, res, next) {
  try {
    const { id } = req.params;

    const simulation = await simulationService.getSimulationById(id);
    console.log("data" + simulation);
    return res.json(successResponse(simulation));
  } catch (error) {
    next(error);
  }
}

/**
 * List user's simulations
 * GET /simulations
 */
async function listUserSimulations(req, res, next) {
  try {
    // Get userId from authenticated user, not from params or query
    const userId = req.user.userId.toString();
    const { state, limit, skip } = req.query;

    const filters = state ? { state } : {};
    const pagination = {
      limit: parseInt(limit) || 20,
      skip: parseInt(skip) || 0,
    };

    const result = await simulationService.listUserSimulations(
      userId,
      filters,
      pagination
    );

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Start a simulation
 * POST /simulations/:id/start
 */
async function startSimulation(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const simulation = await simulationService.startSimulation(id, userId);

    return res.json(successResponse(simulation, "Simulation started"));
  } catch (error) {
    next(error);
  }
}

/**
 * Update simulation state
 * PATCH /simulations/:id/state
 */
async function updateSimulationState(req, res, next) {
  try {
    const { id } = req.params;
    const { state } = req.body;
    const userId = req.user.userId;

    const simulation = await simulationService.updateSimulationState(
      id,
      state,
      userId
    );

    return res.json(successResponse(simulation, "State updated"));
  } catch (error) {
    next(error);
  }
}

/**
 * Add participant to simulation
 * POST /simulations/:id/participants
 */
async function addParticipant(req, res, next) {
  try {
    const { id } = req.params;
    const participantData = req.body;

    const simulation = await simulationService.addParticipant(
      id,
      participantData
    );

    return res.json(successResponse(simulation, "Participant added"));
  } catch (error) {
    next(error);
  }
}

/**
 * Archive simulation
 * DELETE /simulations/:id
 */
async function archiveSimulation(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const simulation = await simulationService.archiveSimulation(id, userId);

    return res.json(successResponse(simulation, "Simulation archived"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSimulation,
  getSimulation,
  listUserSimulations,
  startSimulation,
  updateSimulationState,
  addParticipant,
  archiveSimulation,
};
