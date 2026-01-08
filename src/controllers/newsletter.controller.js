const emailService = require("../services/email.service");
const { successResponse, errorResponse } = require("../utils/response");
const logger = require("../config/logger");

/**
 * Subscribe to Newsletter
 */
async function subscribe(req, res, next) {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json(errorResponse("Email is required", 400));
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(errorResponse("Invalid email address", 400));
    }

    // Send notification email to admin
    await emailService.sendNewsletterSubscription({
      email: email.toLowerCase().trim(),
      subscribedAt: new Date(),
    });

    logger.info(`Newsletter subscription received: ${email}`);

    return res.json(
      successResponse(
        { email },
        "Thank you for subscribing! We'll keep you updated."
      )
    );
  } catch (error) {
    logger.error("Newsletter subscription error:", error);
    next(error);
  }
}

module.exports = {
  subscribe,
};
