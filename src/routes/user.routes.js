const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");
const badgeController = require("../controllers/badge.controller");

const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validation");

const {
  updateUserSchema,
  presignAvatarSchema,
  completeAvatarSchema,
} = require("../validation/user.validation");

/* ======================================================
   🔐 AUTHENTICATION (ALL USER ROUTES PROTECTED)
====================================================== */
router.use(authenticate);

/* ======================================================
   👤 USER PROFILE
====================================================== */

// Get current user
router.get("/me", userController.getMe);

// Update current user
router.put("/me", validate(updateUserSchema), userController.updateMe);

// Delete user
router.delete("/me", userController.deleteMe);

/* ======================================================
   🏅 BADGES
====================================================== */

router.get("/badges", badgeController.getMyBadges);

/* ======================================================
   🖼️ AVATAR UPLOAD FLOW
====================================================== */

// Step 1: Presign upload
router.post(
  "/me/avatar/presign",
  validate(presignAvatarSchema),
  userController.presignAvatar
);

// Step 2: Confirm upload
router.post(
  "/me/avatar/complete",
  validate(completeAvatarSchema),
  userController.completeAvatar
);

module.exports = router;
