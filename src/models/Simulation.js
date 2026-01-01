const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: ["user", "agent", "system"],
      required: true,
    },
    role: {
      type: String,
      maxlength: 100,
    },
    displayName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    avatarUrl: {
      type: String,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    leftAt: {
      type: Date,
    },
  },
  { _id: false }
);

const stateHistorySchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false }
);

const simulationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectTemplateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectTemplate",
      index: true,
    },
    templateSnapshot: {
      name: String,
      shortDescription: String,
      requiredSkills: [String],
      expertiseLevel: String,
      durationEstimateDays: Number,
      complexityScore: Number,
      version: Number,
      requirements: mongoose.Schema.Types.Mixed,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    projectDescription: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    filters: {
      skills: [String],
      expertise: String,
      durationDays: Number,
    },
    state: {
      type: String,
      enum: [
        "created",
        "requirements_sent",
        "in_progress",
        "completed",
        "archived",
        "cancelled",
      ],
      default: "created",
      index: true,
    },
    stateHistory: [stateHistorySchema],
    currentAgent: {
      type: String,
      maxlength: 100,
    },
    participants: [participantSchema],
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    lastMessageAt: {
      type: Date,
      index: true,
    },
    meta: {
      score: {
        type: Number,
        min: 0,
        max: 100,
      },
      totalMessages: {
        type: Number,
        default: 0,
      },
      durationSeconds: {
        type: Number,
        default: 0,
      },
      completionPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
    },
    transcriptStorage: {
      type: {
        type: String,
        enum: ["s3", "database"],
        default: "database",
      },
      ref: String,
    },
    settings: {
      privacy: {
        type: String,
        enum: ["public", "private"],
        default: "private",
      },
      transcriptPublic: {
        type: Boolean,
        default: false,
      },
    },
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
    version: {
      type: Number,
      default: 0, // For optimistic locking
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
simulationSchema.index({ userId: 1, createdAt: -1 });
simulationSchema.index({ state: 1, lastMessageAt: -1 });
simulationSchema.index({ projectTemplateId: 1 });

// Pre-save middleware to track state changes
simulationSchema.pre("save", function (next) {
  if (this.isModified("state") && !this.isNew) {
    this.stateHistory.push({
      state: this.state,
      at: new Date(),
    });
  }
  next();
});

// Method to transition state
simulationSchema.methods.transitionState = function (newState, userId = null) {
  const validTransitions = {
    created: ["requirements_sent", "cancelled"],
    requirements_sent: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled", "archived"],
    completed: ["archived"],
    archived: [],
    cancelled: [],
  };

  if (!validTransitions[this.state]?.includes(newState)) {
    throw new Error(
      `Invalid state transition from ${this.state} to ${newState}`
    );
  }

  this.state = newState;
  this.stateHistory.push({
    state: newState,
    at: new Date(),
    by: userId,
  });

  if (newState === "in_progress" && !this.startedAt) {
    this.startedAt = new Date();
  }

  if (
    ["completed", "cancelled", "archived"].includes(newState) &&
    !this.endedAt
  ) {
    this.endedAt = new Date();
    if (this.startedAt) {
      this.meta.durationSeconds = Math.floor(
        (this.endedAt - this.startedAt) / 1000
      );
    }
  }

  return this.save();
};

// Method to add participant
simulationSchema.methods.addParticipant = function (participantData) {
  this.participants.push(participantData);
  return this.save();
};

// Method to update message count
simulationSchema.methods.incrementMessageCount = function () {
  this.meta.totalMessages += 1;
  this.lastMessageAt = new Date();
  return this.save();
};

// Static method to find active simulations
simulationSchema.statics.findActive = function (userId) {
  return this.find({
    userId,
    state: { $in: ["created", "requirements_sent", "in_progress"] },
  }).sort({ lastMessageAt: -1 });
};

// Static method to find by state
simulationSchema.statics.findByState = function (state, userId = null) {
  const query = { state };
  if (userId) query.userId = userId;
  return this.find(query).sort({ lastMessageAt: -1 });
};

const Simulation = mongoose.model("Simulation", simulationSchema);

module.exports = Simulation;
