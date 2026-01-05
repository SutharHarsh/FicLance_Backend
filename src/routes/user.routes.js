const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  updateUserSchema,
  presignAvatarSchema,
  completeAvatarSchema,
} = require('../validation/user.validation');

const badgeController = require('../controllers/badge.controller');

// CRITICAL: OPTIONS handlers MUST be defined BEFORE authenticate middleware
// This allows CORS preflight requests to pass through without authentication
router.options('/me', (req, res) => res.sendStatus(204));
router.options('/me/avatar/presign', (req, res) => res.sendStatus(204));
router.options('/me/avatar/complete', (req, res) => res.sendStatus(204));

// All user routes require authentication
router.use(authenticate);

router.get('/me', userController.getMe);

router.patch(
  '/me',
  validate(updateUserSchema),
  userController.updateMe
);

router.delete('/me', userController.deleteMe);

router.get('/badges', badgeController.getMyBadges);

router.post(
  '/me/avatar/presign',
  validate(presignAvatarSchema),
  userController.presignAvatar
);

router.post(
  '/me/avatar/complete',
  validate(completeAvatarSchema),
  userController.completeAvatar
);

module.exports = router;
