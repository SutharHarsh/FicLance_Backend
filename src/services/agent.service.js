const axios = require("axios");
const config = require("../config/env");
const logger = require("../config/logger");
const { AppError } = require("../utils/errors");

/**
 * Service to interact with the Python Agent Service
 */
class AgentService {
  constructor() {
    // Prefer configured URL; default is 127.0.0.1 from env schema
    const agentUrl = config.agentServiceUrl || "http://127.0.0.1:8000";

    this.client = axios.create({
      baseURL: agentUrl,
      timeout: 300000, // 5 minutes timeout for long agent tasks
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Log requests
    this.client.interceptors.request.use((request) => {
      logger.info(
        `Agent Service Request: ${request.method.toUpperCase()} ${request.baseURL}${request.url}`
      );
      return request;
    });
  }

  /**
   * Run Agent 1: Generate Requirements
   * @param {Object} data - Project details
   * @returns {Object} Requirements and client persona
   */
  async generateRequirements(data) {
    try {
      // Map backend data format to Agent1 expected format
      // Agent1 expects: Expertise, TechStack, Duration, ProjectName, Description
      const payload = {
        SimulationId: data.simulationId,
        ProjectName: data.projectName,
        Description: data.description,
        Expertise: data.expertise || "Intermediate",
        TechStack: data.techStack || [],
        Duration: data.duration || "1 week",
      };

      logger.info("Sending payload to Agent 1:", payload);

      const response = await this.client.post("/requirements", payload);
      return response.data;
    } catch (error) {
      this.handleError(error, "Agent 1 (Requirements)");
    }
  }

  /**
   * Run Agent 2: Simulation Chat
   * @param {Object} data - Chat context and user message
   * @returns {Object} Agent response
   */
  async sendMessage(data) {
    try {
      // Agent2 expects: Question
      const payload = {
        SimulationId: data.simulationId,
        Question: data.message,
      };

      const response = await this.client.post("/messages", payload);
      return response.data;
    } catch (error) {
      this.handleError(error, "Agent 2 (Chat)");
    }
  }

  /**
   * Run Agent 3: Feedback & Portfolio Analysis
   * @param {Object} data - Repo details
   * @returns {Object} Feedback and analysis
   */
  async analyzeRepo(data) {
    try {
      // Agent3 expects: RepoURL
      const payload = {
        RepoURL: data.repoUrl,
        SimulationId: data.simulationId,
      };

      const response = await this.client.post("/feedback", payload);
      return response.data;
    } catch (error) {
      // Fallback: return minimal feedback instead of throwing,
      // so the job can complete gracefully and update portfolio.
      const errorMsg = error.response?.data?.error || error.message;
      const statusCode = error.response?.status || 500;
      logger.warn("Agent 3 fallback due to error", {
        message: errorMsg,
        status: statusCode,
      });
      return {
        score: 0,
        breakdown: {},
        strengths: [],
        improvements: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Handle Axios errors
   */
  handleError(error, context) {
    const errorMsg = error.response?.data?.error || error.message;
    const statusCode = error.response?.status || 500;

    logger.error(`${context} Failed:`, {
      message: errorMsg,
      status: statusCode,
      data: error.response?.data,
    });

    throw new AppError(`AI Agent Service failed: ${errorMsg}`, 503);
  }
}

module.exports = new AgentService();
