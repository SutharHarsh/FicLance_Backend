const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Webhook route - NO authentication (Stripe validates via signature)
// IMPORTANT: Must use raw body for signature verification
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

module.exports = router;
