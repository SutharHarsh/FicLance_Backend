const Joi = require('joi');

/**
 * User registration schema
 */
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    }),
});

/**
 * User login schema
 */
const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
  deviceName: Joi.string().max(100).optional(),
});

/**
 * Password reset request schema
 */
const requestPasswordResetSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

/**
 * Password reset schema
 */
const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required(),
});

/**
 * User profile update schema
 */
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  about: Joi.string().max(500).trim().optional(),
  description: Joi.string().max(2000).trim().optional(),
  preferences: Joi.object({
    darkMode: Joi.boolean().optional(),
    notificationPreferences: Joi.object({
      email: Joi.boolean().optional(),
      inApp: Joi.boolean().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Simulation creation schema
 */
const createSimulationSchema = Joi.object({
  projectTemplateId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  projectName: Joi.string().min(3).max(200).trim().required(),
  projectDescription: Joi.string().min(10).max(2000).trim().required(),
  filters: Joi.object({
    skills: Joi.array().items(Joi.string()).optional(),
    expertise: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
    durationDays: Joi.number().min(1).max(365).optional(),
  }).optional(),
});

/**
 * Message creation schema
 */
const createMessageSchema = Joi.object({
  clientMessageId: Joi.string().max(100).optional(),
  content: Joi.string().min(1).max(10000).required(),
  contentType: Joi.string().valid('text', 'markdown', 'code', 'file').default('text'),
  attachments: Joi.array().items(
    Joi.object({
      fileId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
      filename: Joi.string(),
      mimeType: Joi.string(),
      sizeBytes: Joi.number(),
    })
  ).optional(),
});

/**
 * Portfolio analysis schema
 */
const analyzePortfolioSchema = Joi.object({
  repoUrl: Joi.string().uri().required(),
  branch: Joi.string().max(100).default('main'),
  commitHash: Joi.string().pattern(/^[a-f0-9]{40}$/).optional(),
  simulationId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
});

/**
 * File presign schema
 */
const presignFileSchema = Joi.object({
  filename: Joi.string().min(1).max(255).required(),
  contentType: Joi.string().max(100).required(),
  sizeBytes: Joi.number().min(1).max(104857600).required(), // Max 100MB
});

/**
 * File complete schema
 */
const completeFileSchema = Joi.object({
  fileId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  path: Joi.string().required(),
  url: Joi.string().uri().required(),
  sizeBytes: Joi.number().min(1).required(),
});

/**
 * Pagination schema
 */
const paginationSchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
});

/**
 * Cursor pagination schema
 */
const cursorPaginationSchema = Joi.object({
  cursor: Joi.string().optional(),
  limit: Joi.number().min(1).max(100).default(20),
});

/**
 * ObjectId validation schema
 */
const objectIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required();

module.exports = {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  updateProfileSchema,
  createSimulationSchema,
  createMessageSchema,
  analyzePortfolioSchema,
  presignFileSchema,
  completeFileSchema,
  paginationSchema,
  cursorPaginationSchema,
  objectIdSchema,
};
