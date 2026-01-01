const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulation.controller');
const portfolioController = require('../controllers/portfolio.controller');
const { authenticate } = require('../middleware/auth');

// User-specific resource routes
router.get(
  '/:userId/simulations',
  authenticate,
  simulationController.listUserSimulations
);

router.get(
  '/:userId/portfolio',
  authenticate,
  portfolioController.listUserPortfolio
);

module.exports = router;
