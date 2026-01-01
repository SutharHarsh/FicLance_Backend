const subscriptionService = require('../services/subscription.service');
const logger = require('../config/logger');

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  logger.warn('Stripe not configured - webhook handler disabled');
}

/**
 * Handle Stripe webhooks
 * POST /webhooks/stripe
 */
async function handleStripeWebhook(req, res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Webhook handler not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    // Handle the event
    await subscriptionService.handleWebhookEvent(event);

    // Return 200 response to acknowledge receipt of event
    res.json({ received: true });
  } catch (error) {
    logger.error(`Error processing webhook: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = {
  handleStripeWebhook,
};
