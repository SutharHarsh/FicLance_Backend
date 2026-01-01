const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User, AuthSession } = require('../models');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt');
const { hashToken } = require('../utils/crypto');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');
const config = require('../config/env');

/**
 * Register a new user
 */
async function register(name, email, password) {
  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

  // Create user
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    providers: [{ provider: 'local', providerId: email.toLowerCase() }],
  });

  logger.info(`User registered: ${user._id}`);

  return user.toSafeObject();
}

/**
 * Login with email and password
 */
async function login(email, password, deviceInfo = {}) {
  // Find user
  const user = await User.findOne({ email: email.toLowerCase(), deleted: false })
    .select('+passwordHash');

  if (!user || !user.passwordHash) {
    throw new AppError('Invalid credentials', 401);
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401);
  }

  // Create auth session and tokens
  const { accessToken, refreshToken, session } = await createSession(user._id, deviceInfo);

  // Update last active
  user.lastActiveAt = new Date();
  await user.save();

  logger.info(`User logged in: ${user._id}`);

  return {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
    session,
  };
}

/**
 * Login with OAuth provider
 */
async function loginWithOAuth(provider, profile, deviceInfo = {}) {
  // ✅ ALWAYS normalize providerId safely
  const providerId = profile.providerId || profile.id;

  if (!providerId) {
    throw new Error(`OAuth providerId missing for provider: ${provider}`);
  }

  // Find user by provider + providerId
  let user = await User.findByProvider(provider, providerId);

  if (!user) {
    // ✅ Create new user safely
    user = await User.create({
      name: profile.displayName || profile.name || "Unnamed User",
      email: profile.email?.toLowerCase(),
      emailVerified: Boolean(profile.emailVerified),
      avatarUrl: profile.avatar || profile.picture || null,
      providers: [
        {
          provider,
          providerId,
          linkedAt: new Date(),
        },
      ],
      lastActiveAt: new Date(),
    });

    logger.info(`New user created via ${provider}: ${user._id}`);
  } else {
    // ✅ Update existing provider link
    const providerIndex = user.providers.findIndex(
      (p) => p.provider === provider
    );

    if (providerIndex >= 0) {
      user.providers[providerIndex].providerId = providerId;
      user.providers[providerIndex].linkedAt = new Date();
    }

    user.lastActiveAt = new Date();
    await user.save();
  }

  // ✅ Create session (access + refresh)
  const { accessToken, refreshToken, session } =
    await createSession(user._id, deviceInfo, provider);

  logger.info(`User logged in via ${provider}: ${user._id}`);

  return {
    user: user.toSafeObject(),
    accessToken,
    refreshToken,
    session,
  };
}


/**
 * Create auth session and generate tokens
 */
async function createSession(userId, deviceInfo = {}, provider = 'local') {
  // Generate tokens
  const accessToken = generateAccessToken({ userId });
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  // Calculate expiry
  const expiresAt = new Date();
  const ttlMatch = config.jwt.refreshTTL.match(/(\d+)([dhm])/);
  if (ttlMatch) {
    const value = parseInt(ttlMatch[1]);
    const unit = ttlMatch[2];
    if (unit === 'd') expiresAt.setDate(expiresAt.getDate() + value);
    else if (unit === 'h') expiresAt.setHours(expiresAt.getHours() + value);
    else if (unit === 'm') expiresAt.setMinutes(expiresAt.getMinutes() + value);
  }

  // Create session
  const session = await AuthSession.create({
    userId,
    deviceInfo: {
      ua: deviceInfo.userAgent,
      ip: deviceInfo.ip,
      name: deviceInfo.deviceName || 'Unknown Device',
    },
    refreshTokenHash,
    refreshTokenCreatedAt: new Date(),
    expiresAt,
    provider,
  });

  return { accessToken, refreshToken, session };
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Refresh token required', 401);
  }

  const refreshTokenHash = hashToken(refreshToken);

  // Find session
  const session = await AuthSession.findOne({
    refreshTokenHash,
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).populate('userId');

  if (!session) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Check if user still exists
  const user = await User.findById(session.userId);
  if (!user || user.deleted) {
    throw new AppError('User not found', 401);
  }

  // Generate new access token
  const accessToken = generateAccessToken({ userId: user._id });

  // Rotate refresh token
  const newRefreshToken = generateRefreshToken();
  session.refreshTokenHash = hashToken(newRefreshToken);
  session.refreshTokenCreatedAt = new Date();
  session.lastUsedAt = new Date();
  await session.save();

  logger.info(`Tokens refreshed for user: ${user._id}`);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: user.toSafeObject(),
  };
}

/**
 * Logout (revoke session)
 */
async function logout(sessionId) {
  const session = await AuthSession.findById(sessionId);
  
  if (session) {
    session.revoked = true;
    session.revokedReason = 'User logout';
    await session.save();

    logger.info(`Session revoked: ${sessionId}`);
  }
}

/**
 * Revoke all sessions for a user
 */
async function revokeAllSessions(userId) {
  const result = await AuthSession.updateMany(
    { userId, revoked: false },
    { revoked: true, revokedReason: 'Revoke all sessions' }
  );

  logger.info(`Revoked ${result.modifiedCount} sessions for user: ${userId}`);

  return result.modifiedCount;
}

/**
 * Request password reset
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ email: email.toLowerCase(), deleted: false });
  
  if (!user) {
    // Don't reveal if user exists (security best practice)
    logger.warn(`Password reset requested for non-existent email: ${email}`);
    return { success: true };
  }

  // Generate reset token (valid for 1 hour)
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = hashToken(resetToken);
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

  // Store hashed token in user document
  user.passwordResetToken = resetTokenHash;
  user.passwordResetExpiry = resetTokenExpiry;
  await user.save();

  // Send password reset email
  const emailService = require('./email.service');
  try {
    await emailService.sendPasswordResetEmail({
      email: user.email,
      resetToken,
      userName: user.name,
    });
    logger.info(`Password reset email sent to: ${user.email}`);
  } catch (error) {
    logger.error(`Failed to send password reset email to ${user.email}:`, error);
    // Don't throw error - token is still valid, user can try again
  }

  return {
    success: true,
  };
}

/**
 * Reset password with token
 */
async function resetPassword(token, newPassword) {
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpiry: { $gt: new Date() },
    deleted: false,
  }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid or expired reset token', 400);
  }

  // Hash new password
  user.passwordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  await user.save();

  // Revoke all existing sessions
  await revokeAllSessions(user._id);

  logger.info(`Password reset for user: ${user._id}`);

  return { success: true };
}

module.exports = {
  register,
  login,
  loginWithOAuth,
  createSession,
  refreshAccessToken,
  logout,
  revokeAllSessions,
  requestPasswordReset,
  resetPassword,
};
