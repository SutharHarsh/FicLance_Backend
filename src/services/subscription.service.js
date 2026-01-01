const { User } = require('../models');
const { getPlan, isValidPlan, isPaidPlan } = require('../config/plans');
const { AppError } = require('../utils/errors');
const config = require('../config/env');
const logger = require('../config/logger');

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (error) {
  logger.warn('Stripe not configured - subscription features disabled');
}

/**
 * Create Stripe Checkout Session for subscription
 * @param {string} userId - User ID
 * @param {string} planName - Plan name (premium or pro)
 * @returns {object} Checkout session with URL
 */
async function createCheckoutSession(userId, planName) {
  if (!stripe) {
    throw new AppError('Payment system not configured', 503);
  }

  if (!isValidPlan(planName)) {
    throw new AppError('Invalid plan selected', 400);
  }

  if (planName === 'free') {
    throw new AppError('Free plan does not require payment', 400);
  }

  const plan = getPlan(planName);
  if (!plan.priceId) {
    throw new AppError(`Stripe Price ID not configured for ${planName} plan`, 500);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Create or retrieve Stripe customer
  let customerId = user.subscription.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user._id.toString(),
      },
    });
    customerId = customer.id;

    user.subscription.stripeCustomerId = customerId;
    await user.save();
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: plan.priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${config.frontendUrl}/dashboard?payment=success`,
    cancel_url: `${config.frontendUrl}/pricing?payment=canceled`,
    metadata: {
      userId: user._id.toString(),
      plan: planName,
    },
  });

  logger.info(`Checkout session created for user ${userId}, plan: ${planName}`);

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Create Stripe Billing Portal session
 * @param {string} userId - User ID
 * @returns {object} Portal session with URL
 */
async function createPortalSession(userId) {
  if (!stripe) {
    throw new AppError('Payment system not configured', 503);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.subscription.stripeCustomerId) {
    throw new AppError('No active subscription found', 404);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: `${config.frontendUrl}/dashboard`,
  });

  logger.info(`Billing portal session created for user ${userId}`);

  return {
    url: session.url,
  };
}

/**
 * Cancel subscription at period end
 * @param {string} userId - User ID
 * @returns {object} Updated subscription
 */
async function cancelSubscription(userId) {
  if (!stripe) {
    throw new AppError('Payment system not configured', 503);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.subscription.stripeSubscriptionId) {
    throw new AppError('No active subscription to cancel', 404);
  }

  // Cancel at period end (user keeps access until then)
  const subscription = await stripe.subscriptions.update(
    user.subscription.stripeSubscriptionId,
    { cancel_at_period_end: true }
  );

  user.subscription.status = 'canceled';
  await user.save();

  logger.info(`Subscription canceled for user ${userId}`);

  return {
    plan: user.subscription.plan,
    status: user.subscription.status,
    currentPeriodEnd: user.subscription.currentPeriodEnd,
    canceledAt: new Date(),
  };
}

/**
 * Get user's subscription status
 * @param {string} userId - User ID
 * @returns {object} Subscription details
 */
async function getSubscriptionStatus(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const plan = getPlan(user.subscription.plan);

  return {
    plan: user.subscription.plan,
    status: user.subscription.status,
    currentPeriodEnd: user.subscription.currentPeriodEnd,
    features: plan.features,
    limits: {
      maxProjects: plan.maxProjects,
      allowedExpertise: plan.allowedExpertise,
      allowedThemes: plan.allowedThemes,
      canMakePublic: plan.canMakePublic,
    },
  };
}

/**
 * Handle Stripe webhook event
 * @param {object} event - Stripe webhook event
 */
async function handleWebhookEvent(event) {
  logger.info(`Processing Stripe webhook: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;

    default:
      logger.info(`Unhandled webhook event type: ${event.type}`);
  }
}

/**
 * Handle subscription created/updated
 * @param {object} subscription - Stripe subscription object
 */
async function handleSubscriptionUpdate(subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    logger.warn('No userId in subscription metadata');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.error(`User not found for subscription update: ${userId}`);
    return;
  }

  // Determine plan from price ID
  let planName = user.subscription.plan;
  if (subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    planName = getPlanByPriceId(priceId);
  }

  user.subscription.plan = planName;
  user.subscription.status = subscription.status === 'active' ? 'active' : subscription.status;
  user.subscription.stripeSubscriptionId = subscription.id;
  user.subscription.stripeCustomerId = subscription.customer;
  user.subscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  user.paymentHistory.push({
    event: 'subscription.updated',
    data: {
      subscriptionId: subscription.id,
      status: subscription.status,
      plan: planName,
    },
  });

  await user.save();

  logger.info(`Subscription updated for user ${userId}: ${planName} (${subscription.status})`);
}

/**
 * Handle subscription deleted
 * @param {object} subscription - Stripe subscription object
 */
async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) {
    logger.warn('No userId in subscription metadata');
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.error(`User not found for subscription deletion: ${userId}`);
    return;
  }

  // Downgrade to free
  user.subscription.plan = 'free';
  user.subscription.status = 'inactive';
  user.subscription.stripeSubscriptionId = null;
  user.subscription.currentPeriodEnd = null;

  user.paymentHistory.push({
    event: 'subscription.deleted',
    data: {
      subscriptionId: subscription.id,
    },
  });

  await user.save();

  logger.info(`User ${userId} downgraded to free plan`);
}

/**
 * Handle invoice paid
 * @param {object} invoice - Stripe invoice object
 */
async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;
  
  const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
  if (!user) {
    logger.warn(`User not found for invoice paid event: ${customerId}`);
    return;
  }

  user.paymentHistory.push({
    event: 'invoice.paid',
    data: {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    },
  });

  await user.save();

  logger.info(`Invoice paid for user ${user._id}: ${invoice.amount_paid / 100} ${invoice.currency}`);
}

/**
 * Handle payment failed
 * @param {object} invoice - Stripe invoice object
 */
async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;
  
  const user = await User.findOne({ 'subscription.stripeCustomerId': customerId });
  if (!user) {
    logger.warn(`User not found for payment failed event: ${customerId}`);
    return;
  }

  // Update status to past_due
  user.subscription.status = 'past_due';

  user.paymentHistory.push({
    event: 'invoice.payment_failed',
    data: {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
    },
  });

  await user.save();

  logger.warn(`Payment failed for user ${user._id}`);
}

/**
 * Get plan name from Stripe price ID
 * @param {string} priceId - Stripe price ID
 * @returns {string} Plan name
 */
function getPlanByPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRICE_ID_PREMIUM) {
    return 'premium';
  }
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    return 'pro';
  }
  return 'free';
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  getSubscriptionStatus,
  handleWebhookEvent,
};
