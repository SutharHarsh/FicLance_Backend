const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { validate } = require("../middleware/validation");
const { authRateLimiter } = require("../middleware/rateLimiter");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} = require("../validation/auth.validation");

console.log(
  "[PASSPORT ROUTES] strategies:",
  Object.keys(require("passport")._strategies)
);

// Public routes with rate limiting
router.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  authController.register
);

router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

// OAuth routes
const passport = require("passport");

// Google OAuth
router.get(
  "/oauth/google",
  passport.authenticate("google", {
    session: false,
    scope: ["profile", "email"],
  })
);

router.get(
  "/oauth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/auth/login",
  }),
  authController.oauthGoogleCallback
);

// GitHub OAuth
router.get(
  "/oauth/github",
  passport.authenticate("github", { session: false, scope: ["user:email"] })
);

router.get(
  "/oauth/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/auth/login",
  }),
  authController.oauthGithubCallback
);

// Explicit OPTIONS for refresh (must allow unauthenticated preflight)
router.options("/refresh", (req, res) => res.sendStatus(204));

router.post("/refresh", authController.refresh);

router.post("/logout", authController.logout);

router.post(
  "/request-password-reset",
  authRateLimiter,
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);

router.post(
  "/reset-password",
  validate(passwordResetSchema),
  authController.resetPassword
);

module.exports = router;
