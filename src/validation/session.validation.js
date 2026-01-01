const Joi = require('joi');

const revokeSessionSchema = Joi.object({
  sessionId: Joi.string().hex().length(24).required(),
});

module.exports = {
  revokeSessionSchema,
};
