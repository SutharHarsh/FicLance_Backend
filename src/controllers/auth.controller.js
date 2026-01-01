const authService = require("../services/auth.service");
const { successResponse, errorResponse } = require("../utils/response");
const config = require("../config/env");
const logger = require("../config/logger");
const { AppError } = require("../utils/errors");

/**
 * Register
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const user = await authService.register(name, email, password);

    logger.info(`User registered: ${user._id}`);
    return res
      .status(201)
      .json(successResponse(user, "User registered successfully"));
  } catch (error) {
    next(error);
  }
}

/**
 * Login (Email/Password)
 */
async function login(req, res, next) {
  try {
    const { email, password, deviceName } = req.body;

    const deviceInfo = {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      deviceName: deviceName || "Unknown Device",
    };

    const result = await authService.login(email, password, deviceInfo);

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json(
      successResponse(
        {
          user: result.user,
          access_token: result.accessToken, // ✅ FIXED
          sessionId: result.session._id,
        },
        "Login successful"
      )
    );
  } catch (error) {
    next(error);
  }
}

/**
 * OAuth handler (Google/GitHub)
 */
async function handleOAuthCallbackHelper(req, res, provider) {
  const profile = req.user;

  const deviceInfo = {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
    deviceName: `${provider} OAuth`,
  };

  const result = await authService.loginWithOAuth(
    provider,
    profile,
    deviceInfo
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
  
  res.cookie("refresh_token", result.refreshToken, cookieOptions);
  
  logger.info(`OAuth cookie set for user: ${result.user._id}`, {
    service: 'ficlance-backend',
    env: process.env.NODE_ENV,
    cookieOptions,
  });

  const redirectParams = new URLSearchParams({
    token: result.accessToken,
    user: JSON.stringify(result.user),
  });

  res.redirect(
    `${config.frontendUrl}/auth/callback?${redirectParams.toString()}`
  );
}

async function oauthGoogleCallback(req, res) {
  try {
    await handleOAuthCallbackHelper(req, res, "google");
  } catch (error) {
    res.redirect(
      `${config.frontendUrl}/auth/login?error=${encodeURIComponent(
        error.message
      )}`
    );
  }
}

async function oauthGithubCallback(req, res) {
  try {
    await handleOAuthCallbackHelper(req, res, "github");
  } catch (error) {
    res.redirect(
      `${config.frontendUrl}/auth/login?error=${encodeURIComponent(
        error.message
      )}`
    );
  }
}

/**
 * Refresh Token
 */
async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      return res.status(401).json(errorResponse("Refresh token missing", 401));
    }

    const result = await authService.refreshAccessToken(refreshToken);

    res.cookie("refresh_token", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json(
      successResponse(
        {
          user: result.user,
          access_token: result.accessToken, // ✅ FIXED
        },
        "Token refreshed"
      )
    );
  } catch (error) {
    // Clear cookie ONLY if refresh token is invalid
    if (error instanceof AppError) {
      res.clearCookie("refresh_token", {
        path: "/",
      });
      return res
        .status(error.statusCode || 401)
        .json(errorResponse(error.message, error.statusCode || 401));
    }

    next(error);
  }
}

/**
 * Logout
 */
async function logout(req, res, next) {
  try {
    const sessionId = req.body.sessionId;

    if (sessionId) {
      await authService.logout(sessionId);
    }

    res.clearCookie("refresh_token", {
      path: "/",
    });

    return res.json(successResponse(null, "Logged out successfully"));
  } catch (error) {
    next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    await authService.requestPasswordReset(req.body.email);
    return res.json(
      successResponse(null, "If the email exists, a reset link has been sent")
    );
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    return res.json(successResponse(null, "Password reset successful"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  oauthGoogleCallback,
  oauthGithubCallback,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
};
