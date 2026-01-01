const mongoose = require("mongoose");
const validator = require("validator");

console.log("LOADING USER SCHEMA - WITH EXPERIENCES SUPPORT");

const providerSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["local", "google", "github"],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    profile: {
      type: mongoose.Schema.Types.Mixed,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true, // Allows null for OAuth-only users initially
      unique: true,
      validate: {
        validator: (v) => !v || validator.isEmail(v),
        message: "Invalid email format",
      },
    },
    passwordHash: {
      type: String,
      select: false, // Don't include in queries by default
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      validate: {
        validator: (v) => !v || validator.isURL(v) || validator.isDataURI(v),
        message: "Invalid avatar URL format",
      },
    },
    about: {
      type: String,
      maxlength: 500,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    profile: {
      username: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        minlength: 3,
        maxlength: 30,
        validate: {
          validator: (v) => !v || /^[a-zA-Z0-9_-]+$/.test(v),
          message:
            "Username can only contain letters, numbers, underscores, and hyphens",
        },
      },
      bio: {
        type: String,
        maxlength: 250,
        default: "",
      },
      skills: {
        type: [String],
        default: [],
        validate: {
          validator: (v) => v.length <= 20,
          message: "Maximum 20 skills allowed",
        },
      },
      experienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner",
      },
      preferredTechStack: {
        type: [String],
        default: [],
        validate: {
          validator: (v) => v.length <= 15,
          message: "Maximum 15 tech stack items allowed",
        },
      },
      careerGoal: {
        type: String,
        enum: ["learning", "freelancing", "job", "other"],
        default: "learning",
      },
      availability: {
        hoursPerWeek: {
          type: Number,
          default: 10,
          min: 0,
          max: 168,
        },
      },
      portfolioLinks: {
        github: {
          type: String,
          default: "",
          validate: {
            validator: (v) => !v || validator.isURL(v),
            message: "Invalid GitHub URL",
          },
        },
        website: {
          type: String,
          default: "",
          validate: {
            validator: (v) => !v || validator.isURL(v),
            message: "Invalid website URL",
          },
        },
        linkedin: {
          type: String,
          default: "",
          validate: {
            validator: (v) => !v || validator.isURL(v),
            message: "Invalid LinkedIn URL",
          },
        },
      },
      portfolio: {
        type: mongoose.Schema.Types.Mixed,
        default: {
          themeId: "executive-professional",
          isPublic: false,
          activeSections: ["About", "Experience", "Projects", "Skills", "Contact"],
          featuredProjects: [],
          customSections: [],
          experiences: [],
          manualProjects: [],
          customLinks: [],
        },
      },
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        deadlines: {
          type: Boolean,
          default: true,
        },
        messages: {
          type: Boolean,
          default: true,
        },
        projectUpdates: {
          type: Boolean,
          default: true,
        },
      },
      darkMode: {
        type: Boolean,
        default: false,
      },
      notificationPreferences: {
        email: {
          type: Boolean,
          default: true,
        },
        inApp: {
          type: Boolean,
          default: true,
        },
      },
    },
    providers: [providerSchema],
    subscription: {
      plan: {
        type: String,
        enum: ["free", "premium", "pro"],
        default: "free",
      },
      status: {
        type: String,
        enum: ["inactive", "active", "past_due", "canceled"],
        default: "inactive",
      },
      stripeCustomerId: {
        type: String,
        sparse: true,
      },
      stripeSubscriptionId: {
        type: String,
        sparse: true,
      },
      currentPeriodEnd: {
        type: Date,
      },
    },
    paymentHistory: [
      {
        event: {
          type: String,
          required: true,
        },
        data: {
          type: mongoose.Schema.Types.Mixed,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    usage: {
      simulationsCount: {
        type: Number,
        default: 0,
      },
      lastSimulationAt: {
        type: Date,
      },
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ deleted: 1, createdAt: -1 });
userSchema.index({ lastActiveAt: -1 });
userSchema.index({ "providers.provider": 1, "providers.providerId": 1 });
userSchema.index({ "profile.username": 1 }, { unique: true, sparse: true });

// Virtual for full provider check
userSchema.virtual("hasLocalProvider").get(function () {
  return this.providers.some((p) => p.provider === "local");
});

// Pre-save middleware to update lastActiveAt
userSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastActiveAt = new Date();
  }
  next();
});

// Method to safely return user object
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

// Static method to find active users
userSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, deleted: false });
};

// Static method to find by provider
userSchema.statics.findByProvider = function (provider, providerId) {
  return this.findOne({
    "providers.provider": provider,
    "providers.providerId": providerId,
    deleted: false,
  });
};

const User = mongoose.model("User", userSchema);

module.exports = User;
