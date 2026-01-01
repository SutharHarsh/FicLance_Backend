const Joi = require("joi");

const createTemplateSchema = Joi.object({
  name: Joi.string().min(3).max(200).required(),
  shortDescription: Joi.string().max(500).required(),
  longDescription: Joi.string().max(5000).required(),
  requiredSkills: Joi.array().items(Joi.string()).min(1).required(),
  expertiseLevel: Joi.string()
    .valid("beginner", "intermediate", "advanced")
    .required(),
  durationEstimateDays: Joi.number().min(0.01).max(365).required(),
  tags: Joi.array().items(Joi.string()).optional(),
  complexityScore: Joi.number().min(1).max(10).optional(),
  sampleRepoUrl: Joi.string().uri().optional(),
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().min(3).max(200).optional(),
  shortDescription: Joi.string().max(500).optional(),
  longDescription: Joi.string().max(5000).optional(),
  requiredSkills: Joi.array().items(Joi.string()).min(1).optional(),
  expertiseLevel: Joi.string()
    .valid("beginner", "intermediate", "advanced")
    .optional(),
  durationEstimateDays: Joi.number().min(0.01).max(365).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  complexityScore: Joi.number().min(1).max(10).optional(),
  sampleRepoUrl: Joi.string().uri().allow("").optional(),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
};
