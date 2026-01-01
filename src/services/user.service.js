const { User, AuthSession } = require("../models");
const { AppError } = require("../utils/errors");
const { getPresignedUrl } = require("./file.service");
const logger = require("../config/logger");

/**
 * Get user by ID
 */
async function getUserById(userId) {
  const user = await User.findOne({ _id: userId, deleted: false });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user.toSafeObject();
}

/**
 * Update user profile
 */
async function updateUser(userId, updates) {
  const allowedUpdates = [
    "name",
    "about",
    "description",
    "profile",
    "preferences",
    "avatarUrl",
  ];
  const filteredUpdates = {};

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  // 1. Find the user first
  const user = await User.findOne({ _id: userId, deleted: false });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  // 2. Apply updates explicitly
  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {

      // Smart Merge for PROFILE to prevent overwriting missing fields (True PATCH)
      if (key === 'profile' && typeof updates[key] === 'object' && updates[key] !== null) {
        if (updates[key].portfolio) {
          console.log("Applying PORTFOLIO update:", JSON.stringify(updates[key].portfolio.experiences, null, 2));
        }

        // Iterate over the keys in the profile update (e.g. skills, portfolio, phone)
        // and apply them individually to the user.profile subdocument.
        // This preserves fields that are NOT in the payload (e.g. bio, availability).
        for (const profileKey in updates[key]) {
          user.profile[profileKey] = updates[key][profileKey];
        }
      } else {
        // Normal logic for non-nested fields (name, about, etc.)
        user[key] = updates[key];
      }
    }
  }

  // 3. Mark modified paths (crucial for Mixed types sometimes) if needed, 
  // but overwriting the root 'profile' usually works. 
  // ensuring persistence.
  user.markModified('profile');

  // 4. Save the document
  await user.save();

  if (!user) {
    throw new AppError("User not found", 404);
  }

  logger.info(`User updated: ${userId}`);

  return user.toSafeObject();
}

/**
 * Update user avatar
 */
async function updateAvatar(userId, avatarUrl) {
  const user = await User.findOneAndUpdate(
    { _id: userId, deleted: false },
    { avatarUrl },
    { new: true }
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  logger.info(`User avatar updated: ${userId}`);

  return user.toSafeObject();
}

/**
 * Soft delete user
 */
async function deleteUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.deleted = true;
  user.deletedAt = new Date();
  await user.save();

  // Revoke all sessions
  await AuthSession.updateMany(
    { userId },
    { revoked: true, revokedReason: "User deleted" }
  );

  logger.info(`User deleted: ${userId}`);

  return { success: true };
}

/**
 * List user's active sessions
 */
async function listUserSessions(userId) {
  const sessions = await AuthSession.find({
    userId,
    revoked: false,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();

  return sessions.map((session) => ({
    id: session._id,
    deviceInfo: session.deviceInfo,
    provider: session.provider,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
  }));
}

/**
 * Revoke a specific session
 */
async function revokeSession(userId, sessionId) {
  const session = await AuthSession.findOne({
    _id: sessionId,
    userId,
  });

  if (!session) {
    throw new AppError("Session not found", 404);
  }

  session.revoked = true;
  session.revokedReason = "User revoked";
  await session.save();

  logger.info(`Session revoked: ${sessionId} for user: ${userId}`);

  return { success: true };
}

module.exports = {
  getUserById,
  updateUser,
  updateAvatar,
  deleteUser,
  listUserSessions,
  revokeSession,
};
