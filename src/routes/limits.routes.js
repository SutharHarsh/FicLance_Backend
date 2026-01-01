const express = require('express');
const router = express.Router();
const limitsController = require('../controllers/limits.controller');
const { authenticate } = require('../middleware/auth');

// All limits routes require authentication
router.use(authenticate);

router.get('/check', limitsController.checkLimits);
router.get('/can-create-project', limitsController.canCreateProject);

module.exports = router;
