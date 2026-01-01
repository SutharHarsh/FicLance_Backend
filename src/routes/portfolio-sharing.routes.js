const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const portfolioSharingService = require("../services/portfolio-sharing.service");
// Helper for async route handlers
const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @route   POST /api/portfolio/share/generate
 * @desc    Generate share token for portfolio (Premium/Pro only)
 * @access  Private
 */
router.post(
  "/generate",
  authenticate,
  wrapAsync(async (req, res) => {
    const { theme, expiresAt, customSlug } = req.body;

    const result = await portfolioSharingService.generateShareToken(
      req.user.id,
      { theme, expiresAt, customSlug }
    );

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @route   GET /api/portfolio/share/public/:shareToken
 * @desc    Get public portfolio by share token
 * @access  Public (no auth required)
 */
router.get(
  "/public/:shareToken",
  wrapAsync(async (req, res) => {
    const { shareToken } = req.params;

    const portfolio = await portfolioSharingService.getPublicPortfolio(
      shareToken
    );

    res.json({
      success: true,
      data: portfolio,
    });
  })
);

/**
 * @route   GET /api/portfolio/share/info
 * @desc    Get user's share settings and link
 * @access  Private
 */
router.get(
  "/info",
  authenticate,
  wrapAsync(async (req, res) => {
    const info = await portfolioSharingService.getShareInfo(req.user.id);

    res.json({
      success: true,
      data: info,
    });
  })
);

/**
 * @route   PUT /api/portfolio/share/settings
 * @desc    Update share settings
 * @access  Private
 */
router.put(
  "/settings",
  authenticate,
  wrapAsync(async (req, res) => {
    const settings = await portfolioSharingService.updateShareSettings(
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      data: settings,
    });
  })
);

/**
 * @route   POST /api/portfolio/share/disable
 * @desc    Disable portfolio sharing
 * @access  Private
 */
router.post(
  "/disable",
  authenticate,
  wrapAsync(async (req, res) => {
    const result = await portfolioSharingService.disableSharing(req.user.id);

    res.json({
      success: true,
      message: result.message,
    });
  })
);

module.exports = router;
