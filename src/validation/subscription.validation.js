const Joi = require('joi');

const createCheckoutSessionSchema = Joi.object({
  plan: Joi.string().valid('premium', 'pro').required()
    .messages({
      'any.only': 'Plan must be either "premium" or "pro"',
    }),
});

module.exports = {
  createCheckoutSessionSchema,
};
