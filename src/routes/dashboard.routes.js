const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticate);

router.get('/', dashboardController.getDashboard);
router.get('/stats', dashboardController.getStats);
router.get('/projects', dashboardController.getProjects);

module.exports = router;
