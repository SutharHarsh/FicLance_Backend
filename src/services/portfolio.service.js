const crypto = require("crypto");
const { Portfolio, Feedback, Simulation } = require("../models");
const { enqueueRepoAnalysis } = require("./queue.service");
const { AppError } = require("../utils/errors");
const logger = require("../config/logger");
const agentService = require("./agent.service");
const redisConfig = require("../config/redis");

/**
 * Analyze a repository
 */
async function analyzeRepository(
  userId,
  repoUrl,
  branch = "main",
  commitHash = null,
  simulationId = null
) {
  // Normalize repository URL
  const normalizedRepo = normalizeRepoUrl(repoUrl);
  if (!normalizedRepo) {
    throw new AppError("Invalid repository URL", 400);
  }

  // Derive owner and repo from normalized form: github.com/<owner>/<repo>
  const parts = normalizedRepo.split("/");
  const repoOwner = parts[1] || null;
  const repoName = parts[2] || null;
  if (!repoOwner || !repoName) {
    throw new AppError("Invalid repository URL format", 400);
  }

  // Compute analysis request hash to prevent duplicates
  const analysisRequestHash = crypto
    .createHash("sha256")
    .update(`${normalizedRepo}::${branch}::${userId}`)
    .digest("hex");

  // Atomic upsert to avoid duplicate key race conditions
  const now = new Date();
  const upsertResult = await Portfolio.findOneAndUpdate(
    { analysisRequestHash },
    {
      $setOnInsert: {
        userId,
        simulationId,
        repoUrl,
        repoOwner,
        repoName,
        normalizedRepo,
        branch,
        commitHash,
        analysisRequestHash,
        status: "queued",
        analysisRequestedAt: now,
        requestedBy: userId,
      },
    },
    { upsert: true, new: true, rawResult: true }
  );

  const portfolio = upsertResult.value;
  const wasInserted = !!upsertResult.lastErrorObject?.upserted;

  // If existing analysis found
  if (!wasInserted) {
    // Always re-run analysis when user submits again if last analysis is done
    if (portfolio.status === "done") {
      await Portfolio.findByIdAndUpdate(portfolio._id, {
        status: "queued",
        analysisRequestedAt: now,
        analysisError: undefined,
        ...(simulationId ? { simulationId } : {}),
      });

      await enqueueRepoAnalysis({
        portfolioId: portfolio._id.toString(),
        repoUrl: portfolio.repoUrl,
        userId: userId.toString(),
        simulationId: (simulationId || portfolio.simulationId)?.toString(),
      });

      logger.info(`Re-enqueued portfolio analysis for: ${portfolio._id}`);
      return { ...portfolio.toObject(), status: "queued" };
    }

    if (portfolio.status === "running" || portfolio.status === "queued") {
      logger.info(`Analysis already in progress: ${portfolio._id}`);
      return portfolio;
    }

    if (portfolio.status === "error" || portfolio.status === "cancelled") {
      await Portfolio.findByIdAndUpdate(portfolio._id, {
        status: "queued",
        analysisRequestedAt: now,
        analysisError: undefined,
        ...(simulationId ? { simulationId } : {}),
      });

      await enqueueRepoAnalysis({
        portfolioId: portfolio._id.toString(),
        repoUrl: portfolio.repoUrl,
        userId: userId.toString(),
        simulationId: (simulationId || portfolio.simulationId)?.toString(),
      });

      return { ...portfolio.toObject(), status: "queued" };
    }
  }

  // New insert: enqueue analysis job
  await enqueueRepoAnalysis({
    portfolioId: portfolio._id.toString(),
    repoUrl,
    userId: userId.toString(),
    simulationId: simulationId ? simulationId.toString() : undefined,
  });

  logger.info(`Portfolio analysis enqueued: ${portfolio._id}`);
  return portfolio;
}

/**
 * Get portfolio by ID
 */
async function getPortfolioById(portfolioId) {
  const portfolio = await Portfolio.findById(portfolioId)
    .populate("userId", "name email")
    .populate("simulationId", "projectName")
    .lean();

  if (!portfolio) {
    throw new AppError("Portfolio not found", 404);
  }

  // Attach latest feedback
  const feedback = await Feedback.findOne({ portfolioId })
    .sort({ createdAt: -1 })
    .lean();

  return { ...portfolio, feedback };
}

/**
 * List user's portfolio
 */
async function listUserPortfolio(userId, filters = {}, pagination = {}) {
  const { status } = filters;
  const { limit = 20, skip = 0 } = pagination;

  const query = { userId, deleted: false };
  if (status) query.status = status;

  const portfolios = await Portfolio.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .skip(skip)
    .lean();

  const total = await Portfolio.countDocuments(query);

  return {
    items: portfolios,
    total,
    limit,
    skip,
  };
}

/**
 * Retry failed analysis
 */
async function retryAnalysis(portfolioId, userId) {
  const portfolio = await Portfolio.findById(portfolioId);

  if (!portfolio) {
    throw new AppError("Portfolio not found", 404);
  }

  if (portfolio.userId.toString() !== userId.toString()) {
    throw new AppError("Not authorized", 403);
  }

  if (portfolio.status !== "error" && portfolio.status !== "cancelled") {
    throw new AppError("Can only retry failed or cancelled analyses", 400);
  }

  portfolio.status = "queued";
  portfolio.analysisRequestedAt = new Date();
  portfolio.analysisError = undefined;
  await portfolio.save();

  await enqueueRepoAnalysis({
    portfolioId: portfolioId.toString(),
    repoUrl: portfolio.repoUrl,
    userId: portfolio.userId.toString(),
    simulationId: portfolio.simulationId
      ? portfolio.simulationId.toString()
      : undefined,
  });

  logger.info(`Portfolio analysis retry enqueued: ${portfolioId}`);

  return portfolio.toObject();
}

/**
 * Update analysis results (called by worker)
 */
async function updateAnalysisResults(portfolioId, results) {
  const portfolio = await Portfolio.findById(portfolioId);

  if (!portfolio) {
    throw new AppError("Portfolio not found", 404);
  }

  await portfolio.updateAnalysis(results);

  logger.info(`Portfolio analysis results updated: ${portfolioId}`);

  return portfolio.toObject();
}

/**
 * Normalize Agent 3 Response (Copied from agentProcessor to ensure consistency)
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

/**
 * Synchronous Analysis (Bypassing Queue/Worker)
 */
async function analyzeRepositorySync(
  userId,
  repoUrl,
  branch = "main",
  commitHash = null,
  simulationId = null
) {
  // 1. Create/Get Portfolio Record WITHOUT enqueueing (different from async flow)
  const normalizedRepo = normalizeRepoUrl(repoUrl);
  if (!normalizedRepo) {
    throw new AppError("Invalid GitHub repository URL", 400);
  }

  const analysisRequestHash = crypto
    .createHash("sha256")
    .update(`${userId}-${normalizedRepo}-${branch || "main"}`)
    .digest("hex");

  const now = new Date();

  // Upsert portfolio record WITHOUT enqueueing a job
  const upsertResult = await Portfolio.findOneAndUpdate(
    { userId, repoUrl: normalizedRepo, analysisRequestHash },
    {
      $setOnInsert: {
        userId,
        repoUrl: normalizedRepo,
        normalizedRepo,
        branch,
        commitHash,
        analysisRequestHash,
        status: "running", // Set to running immediately for sync
        analysisRequestedAt: now,
        requestedBy: userId,
        simulationId: simulationId || null,
      },
    },
    { upsert: true, new: true }
  );

  const portfolio = upsertResult;

  const portfolioId = portfolio._id;

  try {
    logger.info(
      `[Sync] Starting Sync Analysis for ${portfolioId} / ${repoUrl}`
    );

    // Update status
    await Portfolio.findByIdAndUpdate(portfolioId, { status: "running" });

    // 2. FORCE CONTEXT WORKAROUND (Critical for Agent)
    let effectiveSimulationId = simulationId;
    if (!effectiveSimulationId) {
      effectiveSimulationId = `temp_sim_${userId}_${Date.now()}`;
      logger.info(
        `[Sync] Creating temporary context: ${effectiveSimulationId}`
      );

      const genericContext = {
        key_requirements: [
          "Code quality",
          "Architecture",
          "Error handling",
          "Documentation",
        ],
        raw_acceptance_criteria: "- Code quality\n- Architecture",
        project_name: "Standalone Sync Analysis",
        client_name: "System",
        description: "Generic analysis.",
      };

      try {
        await redisConfig.redisClient.set(
          `agent1_context:${effectiveSimulationId}`,
          JSON.stringify(genericContext),
          600
        );
      } catch (e) {
        logger.warn(`[Sync] Redis set failed: ${e.message}`);
      }
    }

    // 3. Call Agent
    logger.info(`[Sync] Calling Agent Service...`);
    const analysis = await agentService.analyzeRepo({
      repoUrl,
      simulationId: effectiveSimulationId,
    });
    logger.info(
      `[Sync] Agent returned score: ${analysis.score || analysis.overallScore}`
    );

    // 4. Save Results
    const normalized = normalizeAgent3Response(analysis);

    // EXPLICIT DEBUG LOG
    console.log(`[Sync] Normalized Summary Type: ${typeof normalized.summary}`);
    if (Array.isArray(normalized.summary)) {
      console.log(`[Sync] Summary is still an array! Joining now.`);
      normalized.summary = normalized.summary.join("\n");
    }

    // Force string conversion
    const finalSummary = String(normalized.summary || "No feedback generated.");

    const feedback = await Feedback.create({
      simulationId: effectiveSimulationId,
      portfolioId,
      summary: finalSummary,
      overallScore: normalized.overallScore,
      scoreBreakdown: normalized.scoreBreakdown,
      strengths: normalized.strengths,
      improvements: normalized.improvements,
      missingRequirements: normalized.missingRequirements,
      suggestions: normalized.improvements,
      rawAgentResponse: normalized.raw,
    });

    const updatedPortfolio = await Portfolio.findByIdAndUpdate(
      portfolioId,
      {
        status: "done",
        feedbackId: feedback._id,
        analysisMeta: {
          analyzedAt: new Date(),
          agentVersion: "1.0-sync",
          missingRequirements: normalized.missingRequirements,
        },
        analysisError: undefined,
      },
      { new: true }
    );

    // 5. Update Simulation Meta (Completion Percentage)
    if (effectiveSimulationId && !effectiveSimulationId.startsWith("temp_")) {
      try {
        const completionPercentage =
          normalized.raw?.message?.completion_percentage || 0;

        await Simulation.findByIdAndUpdate(effectiveSimulationId, {
          "meta.completionPercentage": completionPercentage,
          "meta.score": normalized.overallScore || 0,
        });
        // Auto-complete when >= 80%
        try {
          if (Number(completionPercentage) >= 80) {
            const sim = await Simulation.findById(effectiveSimulationId);
            if (sim) {
              if (sim.state === "requirements_sent") {
                await sim.transitionState("in_progress");
              }
              if (sim.state !== "completed") {
                await sim.transitionState("completed");
                logger.info(`Simulation ${effectiveSimulationId} auto-transitioned to completed`);
              }
            }
          }
        } catch (e) {
          logger.warn(`[Sync] Auto-complete transition failed: ${e.message}`);
        }
        logger.info(
          `[Sync] Updated simulation ${effectiveSimulationId} meta: ${completionPercentage}%`
        );
      } catch (simError) {
        logger.error(
          `[Sync] Failed to update simulation meta: ${simError.message}`
        );
      }
    }

    return { portfolio: updatedPortfolio, feedback };
  } catch (error) {
    logger.error(`[Sync] Analysis Failed: ${error.message}`);
    await Portfolio.findByIdAndUpdate(portfolioId, {
      status: "error",
      analysisError: {
        code: "SYNC_AGENT_FAILED",
        message: error.message,
      },
    });
    throw error;
  }
}

/**
 * Normalize repository URL
 */
function normalizeRepoUrl(repoUrl) {
  try {
    // Extract owner/repo from various GitHub URL formats
    const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+)/);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, "");
      return `github.com/${owner}/${repo}`;
    }
    return null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  analyzeRepository,
  analyzeRepositorySync,
  getPortfolioById,
  listUserPortfolio,
  retryAnalysis,
  updateAnalysisResults,
};
