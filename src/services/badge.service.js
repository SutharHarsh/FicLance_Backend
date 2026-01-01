const { Badge, Simulation, User } = require("../models");
const { getIO } = require("../socket");
const logger = require("../config/logger");

class BadgeService {
  constructor() {
    this.badges = {
      first_simulation: {
        name: "First Steps",
        description: "Completed your first simulation",
        icon: "footsteps",
      },
      simulation_master: {
        name: "Simulation Master",
        description: "Completed 5 simulations",
        icon: "trophy",
      },
      portfolio_builder: {
        name: "Portfolio Builder",
        description: "Analyzed 3 GitHub repositories",
        icon: "github",
      },
      perfect_score: {
        name: "Perfectionist",
        description: "Achieved a score of 100 in a simulation",
        icon: "star",
      },
    };
  }

  /**
   * Check and award badges based on triggers
   */
  async checkBadges(userId, trigger, data = {}) {
    try {
      const awarded = [];

      switch (trigger) {
        case "simulation_completed":
          awarded.push(...(await this.checkSimulationBadges(userId, data)));
          break;
        case "portfolio_analyzed":
          awarded.push(...(await this.checkPortfolioBadges(userId)));
          break;
      }

      // Notify user of new badges
      if (awarded.length > 0) {
        const io = getIO();
        if (io) {
          awarded.forEach((badge) => {
            io.to(`user:${userId}`).emit("badge:awarded", badge);
          });
        }
      }

      return awarded;
    } catch (error) {
      logger.error(`Error checking badges for user ${userId}:`, error);
      return [];
    }
  }

  async checkSimulationBadges(userId, data) {
    const awarded = [];
    const count = await Simulation.countDocuments({
      userId,
      state: "completed",
    });

    // First Simulation
    if (count === 1) {
      const badge = await this.awardBadge(userId, "first_simulation", {
        simulationId: data.simulationId,
      });
      if (badge) awarded.push(badge);
    }

    // Simulation Master (5)
    if (count === 5) {
      const badge = await this.awardBadge(userId, "simulation_master");
      if (badge) awarded.push(badge);
    }

    // Perfect Score
    if (data.score === 100) {
      const badge = await this.awardBadge(userId, "perfect_score", {
        simulationId: data.simulationId,
      });
      if (badge) awarded.push(badge);
    }

    return awarded;
  }

  async checkPortfolioBadges(userId) {
    const { Portfolio } = require("../models");
    const awarded = [];

    const count = await Portfolio.countDocuments({ userId, status: "done" });

    if (count === 3) {
      const badge = await this.awardBadge(userId, "portfolio_builder");
      if (badge) awarded.push(badge);
    }

    return awarded;
  }

  async awardBadge(userId, type, metadata = {}) {
    // Check if already awarded
    const exists = await Badge.findOne({ userId, type });
    if (exists) return null;

    const def = this.badges[type];
    if (!def) return null;

    const badge = await Badge.create({
      userId,
      type,
      name: def.name,
      description: def.description,
      icon: def.icon,
      metadata,
    });

    logger.info(`Badge awarded to ${userId}: ${type}`);
    return badge;
  }

  async getUserBadges(userId) {
    return await Badge.find({ userId }).sort({ awardedAt: -1 });
  }
}

module.exports = new BadgeService();
