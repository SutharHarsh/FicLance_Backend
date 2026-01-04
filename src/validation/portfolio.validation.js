const Joi = require("joi");

const analyzeRepositorySchema = Joi.object({
  repoUrl: Joi.string().required(), // Allow any string (normalization happens in service)
  branch: Joi.string().max(100).optional().allow(null, "").default("main"),
  commitHash: Joi.string().max(40).optional().allow(null, ""),
  simulationId: Joi.string().optional().allow(null, ""), // Allow any string ID
});

module.exports = {
  analyzeRepositorySchema,
};
