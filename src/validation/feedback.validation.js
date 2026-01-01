const Joi = require('joi');

const createFeedbackSchema = Joi.object({
  simulationId: Joi.string().hex().length(24).required(),
  portfolioId: Joi.string().hex().length(24).optional(),
  summary: Joi.string().max(2000).required(),
  scoreBreakdown: Joi.object().optional(),
  suggestions: Joi.array().items(Joi.string()).optional(),
  rawAgentResponse: Joi.any().optional(),
});

module.exports = {
  createFeedbackSchema,
};
