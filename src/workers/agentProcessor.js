const { Worker } = require("bullmq");
const config = require("../config/env");
const logger = require("../config/logger");
const redisConfig = require("../config/redis");
const agentService = require("../services/agent.service");
const {
  Simulation,
  Message,
  ProjectTemplate,
  Portfolio,
  Feedback,
  Job,
} = require("../models");

/**
 * Process Agent 1 Job: Generate Requirements
 */
async function processAgent1(job) {
  const { simulationId, userId, projectName, projectDescription, filters } =
    job.data;

  try {
    logger.info(
      `Processing Agent 1 (Requirements) for simulation: ${simulationId}`
    );

    // 1. Call Agent Service
    // Map data to structure expected by agentService
    const agentPayload = {
      simulationId,
      projectName,
      description: projectDescription,
      expertise: filters?.expertise,
      techStack: filters?.skills,
      duration: filters?.durationDays
        ? `${filters.durationDays} days`
        : undefined,
    };

    const agentResponse = await agentService.generateRequirements(agentPayload);

    // Extract agent response data (unwrap if needed)
    const reqData = agentResponse.message || agentResponse;

    // 2. Update Simulation
    const simulation = await Simulation.findById(simulationId);
    if (!simulation) throw new Error("Simulation not found");

    // Store requirements data in simulation
    if (!simulation.templateSnapshot) simulation.templateSnapshot = {};
    simulation.templateSnapshot.requirements = reqData;
    simulation.currentAgent = "Agent1";

    // Transition state
    await simulation.transitionState("requirements_sent", userId);

    // Create clean message with document attachment (NO content duplication)
    const message = await Message.create({
      simulationId,
      sequence: await Message.getNextSequence(simulationId),
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

    // Socket events will be emitted by the main server when it detects the state change
    logger.info(`Agent 1 completed for simulation: ${simulationId}`);

    return { 
      success: true, 
      requirements: reqData, 
      messageId: message._id,
      simulationId,
      message: message.toObject()
    };
  } catch (error) {
    logger.error(`Agent 1 Job Failed: ${error.message}`, error);
    throw error;
  }
}

/**
 * Process Agent 2 Job: Chat Response
 */
async function processAgent2(job) {
  const { simulationId, userMessage, context } = job.data;

  try {
    logger.info(`Processing Agent 2 (Chat) for simulation: ${simulationId}`);

    // Call Agent Service
    const agentResponse = await agentService.sendMessage({
      simulationId,
      message: userMessage,
      context,
    });

    // Create Agent Message
    const message = await Message.create({
      simulationId,
      sequence: await Message.getNextSequence(simulationId),
      sender: { type: "agent", agentName: "Agent2" },
      content:
        agentResponse.response ||
        agentResponse.message ||
        JSON.stringify(agentResponse),
      contentType: "markdown",
    });

    // Update Simulation state
    const simulation = await Simulation.findById(simulationId);
    if (simulation) {
      await simulation.incrementMessageCount();
    }

    logger.info(`Agent 2 completed for simulation: ${simulationId}`);

    // Return the message so the queue service can emit Socket.IO event
    return { 
      success: true, 
      messageId: message._id,
      message: message.toObject(),
      simulationId 
    };
  } catch (error) {
    logger.error(`Agent 2 Job Failed: ${error.message}`, error);

    throw error;
  }
}

/**
 * Process Agent 3 Job: Feedback & Portfolio
 */
function normalizeAgent3Response(analysis = {}) {
  const source = analysis.message || analysis;
  let summary =
    source.feedback_summary ||
    source.summary ||
    source.feedback ||
    source.overview ||
    "Feedback generated.";

  if (Array.isArray(summary)) {
    summary = summary.join("\n");
  }

  const strengths =
    source.strengths || source.positives || source.highlights || [];
  const improvements =
    source.improvements || source.recommendations || source.suggestions || [];
  const missingRequirements =
    source.missing_requirements || source.missingRequirements || [];
  const score = source.score || source.overallScore || null;
  const breakdown = source.breakdown || source.scoreBreakdown || [];

  return {
    summary,
    strengths,
    improvements,
    missingRequirements,
    overallScore: score,
    scoreBreakdown: breakdown,
    raw: analysis,
  };
}

async function processAgent3(job) {
  const { portfolioId, repoUrl, userId, simulationId } = job.data;

  try {
    console.log(
      `[Processor] STARTING Agent 3 (Feedback) for portfolio: ${portfolioId}`
    );
    logger.info(`Processing Agent 3 (Feedback) for portfolio: ${portfolioId}`);

    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) throw new Error("Portfolio not found");

    // Align status with Portfolio schema enum
    portfolio.status = "running";
    await portfolio.save();

    // Call Agent Service (Long running)
    let effectiveSimulationId = simulationId;

    // WORKAROUND: If no simulationId (Standalone Analysis), create a temporary context in Redis
    // The Python Agent strictl requires 'agent1_context:{SimulationId}' to exist.
    if (!effectiveSimulationId) {
      effectiveSimulationId = `temp_sim_${userId}_${Date.now()}`;
      logger.info(
        `Creating temporary simulation context for standalone analysis: ${effectiveSimulationId}`
      );

      const genericContext = {
        key_requirements: [
          "Code quality and best practices",
          "Architecture and design patterns",
          "Error handling and edge cases",
          "Test coverage and documentation",
        ],
        raw_acceptance_criteria:
          "- Code quality\n- Architecture\n- Error handling\n- Documentation",
        project_name: "Standalone Analysis",
        client_name: "General",
        description:
          "A generic analysis of the codebase structure and quality.",
      };

      try {
        // Use the redisClient exported from config/redis
        // Note: redisConfig is require('../config/redis'), verify export
        await redisConfig.redisClient.set(
          `agent1_context:${effectiveSimulationId}`,
          JSON.stringify(genericContext),
          600 // 10 minutes expiry
        );
      } catch (redisError) {
        logger.warn(
          `Failed to set redis context for standalone analysis: ${redisError.message}`
        );
        // We proceed anyway, but agent might fail
      }
    }

    console.log(
      `[Processor] Calling Agent Service at ${config.agentServiceUrl} with SimulationId: ${effectiveSimulationId}`
    );
    const analysis = await agentService.analyzeRepo({
      repoUrl,
      simulationId: effectiveSimulationId,
    });
    console.log(
      `[Processor] Agent Service returned analysis with score:`,
      analysis.score || analysis.overallScore
    );
    const normalized = normalizeAgent3Response(analysis);

    // Save Feedback
    const feedback = await Feedback.create({
      simulationId,
      portfolioId,
      summary: normalized.summary,
      overallScore: normalized.overallScore,
      scoreBreakdown: normalized.scoreBreakdown,
      strengths: normalized.strengths,
      improvements: normalized.improvements,
      missingRequirements: normalized.missingRequirements,
      suggestions: normalized.improvements,
      rawAgentResponse: normalized.raw,
    });

    // Update Portfolio
    portfolio.status = "done";
    portfolio.feedbackId = feedback._id;
    portfolio.analysisMeta = {
      ...(portfolio.analysisMeta || {}),
      analyzedAt: new Date(),
      agentVersion: "1.0",
      missingRequirements: normalized.missingRequirements,
    };
    portfolio.analysisError = undefined;
    await portfolio.save();

    // Socket events will be emitted by the main server through database change listeners or polling
    logger.info(`Agent 3 analysis complete for portfolio: ${portfolioId}`);

    // Check for badges
    const badgeService = require("../services/badge.service");
    badgeService
      .checkBadges(userId, "portfolio_analyzed")
      .catch((err) => logger.error("Badge check failed:", err));

    return { success: true, feedbackId: feedback._id };
  } catch (error) {
    logger.error(`Agent 3 Job Failed: ${error.message}`);

    // Update portfolio status to error (schema-aligned)
    await Portfolio.findByIdAndUpdate(portfolioId, {
      status: "error",
      analysisError: {
        code: "AGENT3_FAILED",
        message: error.message,
        details: error.stack,
      },
    });

    throw error;
  }
}

/**
 * Main Processor
 */
const processAgentJob = async (job) => {
  switch (job.name) {
    case "requirements":
    case "agent1:requirements":
      return processAgent1(job);
    case "chat":
    case "agent2:chat":
      return processAgent2(job);
    case "feedback":
    case "agent3:feedback":
      return processAgent3(job);
    default:
      throw new Error(`Unknown job name: ${job.name}`);
  }
};

module.exports = { processAgentJob };
