const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const config = require("../config/env");
const logger = require("../config/logger");

/**
 * Initialize Passport OAuth strategies
 * MUST be called once at app startup
 */
function initializePassport() {
  // Required by passport (even if sessions are disabled)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  console.log(
    "[PASSPORT INIT] strategies:",
    Object.keys(require("passport")._strategies)
  );

  /**
   * =========================
   * GOOGLE OAUTH STRATEGY
   * =========================
   */
  if (
    config.oauth.google.clientId &&
    config.oauth.google.clientSecret &&
    config.oauth.google.callbackURL
  ) {
    passport.use(
      "google",
      new GoogleStrategy(
        {
          clientID: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
          callbackURL: config.oauth.google.callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const oauthProfile = {
              provider: "google",
              providerId: profile.id,
              name: profile.displayName,
              email: profile.emails?.[0]?.value || null,
              emailVerified: profile.emails?.[0]?.verified || false,
              avatar: profile.photos?.[0]?.value || null,
            };

            logger.info(`Google OAuth success: ${oauthProfile.email}`);
            return done(null, oauthProfile);
          } catch (err) {
            logger.error("Google OAuth error", err);
            return done(err, null);
          }
        }
      )
    );

    logger.info("Google OAuth strategy registered");
  } else {
    logger.warn("Google OAuth NOT registered (missing env variables)");
  }

  /**
   * =========================
   * GITHUB OAUTH STRATEGY
   * =========================
   */
  if (
    config.oauth.github.clientId &&
    config.oauth.github.clientSecret &&
    config.oauth.github.callbackURL
  ) {
    passport.use(
      "github",
      new GitHubStrategy(
        {
          clientID: config.oauth.github.clientId,
          clientSecret: config.oauth.github.clientSecret,
          callbackURL: config.oauth.github.callbackURL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const oauthProfile = {
              provider: "github",
              providerId: profile.id,
              name: profile.displayName || profile.username,
              email: profile.emails?.[0]?.value || null,
              avatar: profile.photos?.[0]?.value || null,
            };

            logger.info(`GitHub OAuth success: ${oauthProfile.email}`);
            return done(null, oauthProfile);
          } catch (err) {
            logger.error("GitHub OAuth error", err);
            return done(err, null);
          }
        }
      )
    );

    logger.info("GitHub OAuth strategy registered");
  } else {
    logger.warn("GitHub OAuth NOT registered (missing env variables)");
  }

  // Debug (remove later if you want)
  logger.info(
    `Passport strategies loaded: ${Object.keys(passport._strategies).join(
      ", "
    )}`
  );
}

module.exports = {
  initializePassport,
};
