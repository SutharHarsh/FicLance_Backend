const Joi = require("joi");

const createSimulationSchema = Joi.object({
  projectTemplateId: Joi.string().hex().length(24).optional(),
  projectName: Joi.string().min(3).max(200).required(),
  projectDescription: Joi.string().min(10).max(2000).required(),
  filters: Joi.object({
    skills: Joi.array().items(Joi.string()).optional(),
    expertise: Joi.string()
      .valid("beginner", "intermediate", "advanced")
      .optional(),
    durationDays: Joi.number().min(0.01).max(365).optional(),
  }).optional(),
});

const updateSimulationStateSchema = Joi.object({
  state: Joi.string()
    .valid(
      "requirements_sent",
      "in_progress",
      "completed",
      "archived",
      "cancelled"
    )
    .required(),
});

const addParticipantSchema = Joi.object({
  id: Joi.string().hex().length(24).optional(),
  type: Joi.string().valid("user", "agent", "system").required(),
  role: Joi.string().max(100).optional(),
  displayName: Joi.string().max(100).required(),
  avatarUrl: Joi.string().uri().optional(),
});

module.exports = {
  createSimulationSchema,
  updateSimulationStateSchema,
  addParticipantSchema,
};
