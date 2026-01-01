const Joi = require("joi");

const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  about: Joi.string().max(500).allow("").optional(),
  description: Joi.string().max(2000).allow("").optional(),
  avatarUrl: Joi.string().allow("").optional(),
  profile: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .optional(),
    bio: Joi.string().max(250).allow("").optional(),
    skills: Joi.array().items(Joi.string()).max(20).optional(),
    experienceLevel: Joi.string()
      .valid("beginner", "intermediate", "advanced")
      .optional(),
    preferredTechStack: Joi.array().items(Joi.string()).max(15).optional(),
    careerGoal: Joi.string()
      .valid("learning", "freelancing", "job", "other")
      .optional(),
    availability: Joi.object({
      hoursPerWeek: Joi.number().min(0).max(168).optional(),
    }).optional(),
    phone: Joi.string().allow("").optional(), // <--- Added Phone
    portfolioLinks: Joi.object({
      github: Joi.string().uri().allow("").optional(),
      website: Joi.string().uri().allow("").optional(),
      linkedin: Joi.string().uri().allow("").optional(),
    }).optional(),
    portfolio: Joi.object().unknown(true).optional(), // <--- Added Portfolio (Flexible)
  }).optional(),
  preferences: Joi.object({
    theme: Joi.string().valid("light", "dark", "system").optional(),
    language: Joi.string().optional(),
    notifications: Joi.object({
      deadlines: Joi.boolean().optional(),
      messages: Joi.boolean().optional(),
      projectUpdates: Joi.boolean().optional(),
    }).optional(),
    darkMode: Joi.boolean().optional(),
    notificationPreferences: Joi.object({
      email: Joi.boolean().optional(),
      inApp: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
});

const presignAvatarSchema = Joi.object({
  filename: Joi.string().max(255).required(),
  contentType: Joi.string()
    .valid("image/jpeg", "image/png", "image/jpg", "image/webp")
    .required(),
  sizeBytes: Joi.number()
    .max(5 * 1024 * 1024)
    .required(), // Max 5MB
});

const completeAvatarSchema = Joi.object({
  fileId: Joi.string().required(),
  url: Joi.string().uri().required(),
});

module.exports = {
  updateUserSchema,
  presignAvatarSchema,
  completeAvatarSchema,
};
