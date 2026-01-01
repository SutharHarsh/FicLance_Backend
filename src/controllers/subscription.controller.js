const subscriptionService = require("../services/subscription.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Create Stripe Checkout Session
 * POST /subscriptions/create-checkout-session
 */
async function createCheckoutSession(req, res, next) {
  try {
    const userId = req.user.userId;
    const { plan } = req.body;

    const result = await subscriptionService.createCheckoutSession(
      userId,
      plan
    );

    return res.json(successResponse(result, "Checkout session created"));
  } catch (error) {
    next(error);
  }
}

/**
 * Get subscription status
 * GET /subscriptions/status
 */
async function getStatus(req, res, next) {
  try {
    const userId = req.user.userId;

    const status = await subscriptionService.getSubscriptionStatus(userId);

    return res.json(successResponse(status));
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel subscription
 * POST /subscriptions/cancel
 */
async function cancelSubscription(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await subscriptionService.cancelSubscription(userId);

    return res.json(
      successResponse(result, "Subscription will be canceled at period end")
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Create Stripe Billing Portal session
 * POST /subscriptions/portal
 */
async function createPortalSession(req, res, next) {
  try {
    const userId = req.user.userId;

    const result = await subscriptionService.createPortalSession(userId);

    return res.json(successResponse(result, "Portal session created"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createCheckoutSession,
  getStatus,
  cancelSubscription,
  createPortalSession,
};
