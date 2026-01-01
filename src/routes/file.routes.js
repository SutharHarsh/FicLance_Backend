const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const {
  presignUploadSchema,
  completeUploadSchema,
} = require('../validation/file.validation');

// All file routes require authentication
router.use(authenticate);

router.post(
  '/presign',
  validate(presignUploadSchema),
  fileController.presignUpload
);

router.post(
  '/complete',
  validate(completeUploadSchema),
  fileController.completeUpload
);

router.get('/:id', fileController.getFile);

router.get('/:id/download', fileController.getDownloadUrl);

router.delete('/:id', fileController.deleteFile);

module.exports = router;
