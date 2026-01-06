const userService = require("../services/user.service");
const limitsService = require("../services/limits.service");
const fileService = require("../services/file.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get current user profile
 * GET /users/me
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.userId;

    const user = await userService.getUserById(userId);

    return res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
}

/**
 * Update current user profile
 * PATCH /users/me
 */
async function updateMe(req, res, next) {
  try {
    const userId = req.user.userId;
    const updates = req.body;

    console.log("=== CONTROLLER UPDATE ME ===");
    console.log("USER ID:", userId);
    console.log("FULL REQ.BODY:", JSON.stringify(req.body, null, 2)); // <--- SHOW ME EVERYTHING
    
    if (updates.profile) {
      console.log("📦 Profile object:", JSON.stringify(updates.profile, null, 2));
    }
    if (updates.profile && updates.profile.portfolio) {
      console.log("Req.body.profile.portfolio:", JSON.stringify(updates.profile.portfolio, null, 2));
    } else {
      console.log("Req.body.profile.portfolio IS MISSING OR EMPTY");
    }
    console.log("============================");

    // Check if trying to make portfolio public
    const isTryingToMakePublic =
      updates.profile?.portfolio?.isPublic === true ||
      updates.portfolioPublic === true;

    if (isTryingToMakePublic) {
      const canMakePublic = await limitsService.canMakePublic(userId);
      if (!canMakePublic.allowed) {
        return res.status(403).json(errorResponse(canMakePublic.reason));
      }
    }

    const user = await userService.updateUser(userId, updates);

    console.log("✅ RESPONSE BEING SENT BACK:", JSON.stringify(user, null, 2).substring(0, 500));
    
    return res.json(successResponse(user, "Profile updated"));
  } catch (error) {
    console.error("❌ UPDATE ERROR:", error);
    next(error);
  }
}

/**
 * Get presigned URL for avatar upload
 * POST /users/me/avatar/presign
 */
async function presignAvatar(req, res, next) {
  try {
    const userId = req.user.userId;
    const { filename, contentType, sizeBytes } = req.body;

    const result = await fileService.generatePresignedUploadUrl(
      userId,
      filename,
      contentType,
      sizeBytes
    );

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Complete avatar upload
 * POST /users/me/avatar/complete
 */
async function completeAvatar(req, res, next) {
  try {
    const userId = req.user.userId;
    const { fileId, url } = req.body;

    // Complete file upload
    await fileService.completeFileUpload(fileId, url);

    // Update user avatar
    const user = await userService.updateAvatar(userId, url);

    return res.json(successResponse(user, "Avatar updated"));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete current user account
 * DELETE /users/me
 */
async function deleteMe(req, res, next) {
  try {
    const userId = req.user.userId;
    await userService.deleteUser(userId);
    return res.json(
      successResponse({ success: true }, "Account deleted successfully")
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMe,
  updateMe,
  presignAvatar,
  completeAvatar,
  deleteMe,
};
