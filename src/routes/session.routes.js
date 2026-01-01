const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { revokeSessionSchema } = require('../validation/session.validation');

// All session routes require authentication
router.use(authenticate);

router.get('/', sessionController.listSessions);

router.post(
  '/revoke',
  validate(revokeSessionSchema),
  sessionController.revokeSession
);

module.exports = router;
