const express = require('express');
const supportController = require('../controllers/support.controller');
const { optionalAuthenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/support/ticket
 * @desc    Submit a support ticket
 * @access  Public (optionally authenticated)
 */
router.post('/ticket', optionalAuthenticate, supportController.submitTicket);

module.exports = router;
