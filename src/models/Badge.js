const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "first_simulation",
        "simulation_master",
        "portfolio_builder",
        "bug_hunter",
        "perfect_score",
        "fast_learner",
        "team_player",
        "rising_star",
      ],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    icon: {
      type: String, // Icon name or URL
      required: true,
    },
    awardedAt: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      simulationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Simulation",
      },
      triggerValue: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// User can only earn each badge type once
badgeSchema.index({ userId: 1, type: 1 }, { unique: true });

const Badge = mongoose.model("Badge", badgeSchema);

module.exports = Badge;
