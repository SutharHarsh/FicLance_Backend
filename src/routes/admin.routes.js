const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticate, isAdmin } = require('../middleware/auth');

// Admin routes - all require authentication and admin role
router.use(authenticate, isAdmin);

router.get('/jobs', adminController.listJobs);

module.exports = router;
