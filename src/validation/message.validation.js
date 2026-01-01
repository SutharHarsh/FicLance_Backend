const Joi = require("joi");

const createMessageSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required(),
  contentType: Joi.string()
    .valid("text", "markdown", "code", "file")
    .optional(),
  attachments: Joi.array()
    .items(
      Joi.object({
        fileId: Joi.string().hex().length(24).required(),
        filename: Joi.string().max(255).required(),
        mimeType: Joi.string().max(100).required(),
        sizeBytes: Joi.number().min(0).required(),
      })
    )
    .optional(),
  clientMessageId: Joi.string().max(100).optional(),
  sender: Joi.object({
    type: Joi.string().valid("user", "agent", "system").required(),
    id: Joi.string().hex().length(24).optional(), // Make ID optional for agents/system
    agentName: Joi.string().optional(),
    userId: Joi.string().optional(),
    displayName: Joi.string().optional(),
  }).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

const editMessageSchema = Joi.object({
  content: Joi.string().min(1).max(10000).required(),
});

module.exports = {
  createMessageSchema,
  editMessageSchema,
};
