/**
 * Subscription plan configurations
 * Defines limits and features for Free, Premium, and Pro plans
 */

const plans = {
  free: {
    name: "free",
    displayName: "Free",
    price: 0,
    maxProjects: 5,
    allowedExpertise: ["beginner"],
    allowedThemes: [1],
    canMakePublic: false,
    priceId: null, // No Stripe price for free plan
    features: {
      portfolioSharing: false,
      pdfExport: false,
      analytics: false,
      description: [
        "5 beginner-level projects",
        "1 portfolio theme",
        "Private portfolio only",
        "Beginner templates only",
      ],
    },
  },

  premium: {
    name: "premium",
    displayName: "Premium",
    price: 9.99, // USD per month
    maxProjects: 15,
    allowedExpertise: ["beginner", "intermediate"],
    allowedThemes: [1, 2, 3],
    canMakePublic: true,
    priceId: process.env.STRIPE_PRICE_ID_PREMIUM,
    features: {
      portfolioSharing: true,
      pdfExport: true,
      analytics: false,
      description: [
        "15 intermediate-level projects",
        "3 portfolio themes",
        "Public portfolio sharing",
        "Beginner + Intermediate templates",
        "Priority support",
      ],
    },
  },

  pro: {
    name: "pro",
    displayName: "Pro",
    price: 19.99, // USD per month
    maxProjects: null, // unlimited
    allowedExpertise: ["beginner", "intermediate", "advanced"],
    allowedThemes: "all",
    canMakePublic: true,
    priceId: process.env.STRIPE_PRICE_ID_PRO,
    features: {
      portfolioSharing: true,
      pdfExport: true,
      analytics: true,
      description: [
        "Unlimited projects",
        "All portfolio themes",
        "Public portfolio sharing",
        "All template levels",
        "Advanced features",
        "Portfolio analytics",
        "Priority support",
      ],
    },
  },
};

/**
 * Get plan configuration by name
 * @param {string} planName - Plan name (free, premium, pro)
 * @returns {object} Plan configuration
 */
function getPlan(planName) {
  const plan = plans[planName];
  if (!plan) {
    throw new Error(`Invalid plan: ${planName}`);
  }
  return plan;
}

/**
 * Check if a plan is valid
 * @param {string} planName - Plan name to validate
 * @returns {boolean}
 */
function isValidPlan(planName) {
  return Object.keys(plans).includes(planName);
}

/**
 * Get all available plans
 * @returns {array} Array of plan configurations
 */
function getAllPlans() {
  return Object.values(plans);
}

/**
 * Check if a plan is paid
 * @param {string} planName - Plan name
 * @returns {boolean}
 */
function isPaidPlan(planName) {
  return planName === "premium" || planName === "pro";
}

module.exports = {
  plans,
  getPlan,
  isValidPlan,
  getAllPlans,
  isPaidPlan,
};
