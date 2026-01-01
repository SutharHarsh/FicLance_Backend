const Joi = require('joi');

const presignUploadSchema = Joi.object({
  filename: Joi.string().max(255).required(),
  contentType: Joi.string().max(100).required(),
  sizeBytes: Joi.number().max(50 * 1024 * 1024).required(), // Max 50MB
});

const completeUploadSchema = Joi.object({
  fileId: Joi.string().required(),
  url: Joi.string().uri().required(),
});

module.exports = {
  presignUploadSchema,
  completeUploadSchema,
};
