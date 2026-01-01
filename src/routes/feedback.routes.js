const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const { validate } = require('../middleware/validation');
const { createFeedbackSchema } = require('../validation/feedback.validation');

// Public route for agent to create feedback
router.post(
  '/feedback',
  validate(createFeedbackSchema),
  feedbackController.createFeedback
);

module.exports = router;
