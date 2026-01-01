const express = require('express');
const router = express.Router();
const templateController = require('../controllers/template.controller');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  createTemplateSchema,
  updateTemplateSchema,
} = require('../validation/template.validation');

// Public routes
router.get('/', templateController.listTemplates);
router.get('/:id', templateController.getTemplate);

// Admin routes
router.post(
  '/',
  authenticate,
  isAdmin,
  validate(createTemplateSchema),
  templateController.createTemplate
);

router.patch(
  '/:id',
  authenticate,
  isAdmin,
  validate(updateTemplateSchema),
  templateController.updateTemplate
);

router.delete(
  '/:id',
  authenticate,
  isAdmin,
  templateController.deleteTemplate
);

module.exports = router;
