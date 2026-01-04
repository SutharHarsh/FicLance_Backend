const express = require("express");
const router = express.Router();
const portfolioController = require("../controllers/portfolio.controller");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validation");
const {
  analyzeRepositorySchema,
} = require("../validation/portfolio.validation");

// Public portfolio access
router.get("/user/:username", portfolioController.getPublicPortfolio);

// All other portfolio routes require authentication
router.use(authenticate);

router.post(
  "/analyze/sync",
  (req, res, next) => {
    console.log("🔍 [Debug] Analyze Internal Body:", JSON.stringify(req.body, null, 2));
    next();
  },
  // validate(analyzeRepositorySchema), // TEMPORARILY DISABLED
  portfolioController.analyzeRepositorySync
);

router.post(
  "/analyze",
  validate(analyzeRepositorySchema),
  portfolioController.analyzeRepository
);

// List my portfolio
router.get("/", portfolioController.listUserPortfolio);

router.get("/:id", portfolioController.getPortfolio);

router.post("/:id/retry", portfolioController.retryAnalysis);

module.exports = router;
