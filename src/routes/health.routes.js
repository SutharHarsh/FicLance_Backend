const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Public health check endpoint
router.get('/', healthController.healthCheck);
router.get('/queues', healthController.queueHealth);

module.exports = router;
