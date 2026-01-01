const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createCheckoutSessionSchema } = require('../validation/subscription.validation');

// All subscription routes require authentication
router.use(authenticate);

router.post(
  '/create-checkout-session',
  validate(createCheckoutSessionSchema),
  subscriptionController.createCheckoutSession
);

router.get('/status', subscriptionController.getStatus);

router.post('/cancel', subscriptionController.cancelSubscription);

router.post('/portal', subscriptionController.createPortalSession);

module.exports = router;
