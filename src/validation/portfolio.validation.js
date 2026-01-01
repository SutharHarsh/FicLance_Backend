const Joi = require("joi");

const analyzeRepositorySchema = Joi.object({
  repoUrl: Joi.string().required(), // Allow any string (normalization happens in service)
  branch: Joi.string().max(100).optional().default("main"),
  commitHash: Joi.string().max(40).optional(),
  simulationId: Joi.string().optional(), // Allow any string ID
});

module.exports = {
  analyzeRepositorySchema,
};
