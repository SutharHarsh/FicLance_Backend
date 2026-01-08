const express = require("express");
const router = express.Router();
const newsletterController = require("../controllers/newsletter.controller");
const { authRateLimiter } = require("../middleware/rateLimiter");

// Newsletter subscription (public, rate-limited)
router.post("/subscribe", authRateLimiter, newsletterController.subscribe);

module.exports = router;
