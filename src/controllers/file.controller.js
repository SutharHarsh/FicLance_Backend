const fileService = require("../services/file.service");
const { successResponse, errorResponse } = require("../utils/response");

/**
 * Get presigned URL for file upload
 * POST /files/presign
 */
async function presignUpload(req, res, next) {
  try {
    const userId = req.user.userId;
    const { filename, contentType, sizeBytes } = req.body;

    const result = await fileService.generatePresignedUploadUrl(
      userId,
      filename,
      contentType,
      sizeBytes
    );

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Complete file upload
 * POST /files/complete
 */
async function completeUpload(req, res, next) {
  try {
    const { fileId, url } = req.body;

    const file = await fileService.completeFileUpload(fileId, url);

    return res.json(successResponse(file, "File upload completed"));
  } catch (error) {
    next(error);
  }
}

/**
 * Get file by ID
 * GET /files/:id
 */
async function getFile(req, res, next) {
  try {
    const { id } = req.params;

    const file = await fileService.getFileById(id);

    return res.json(successResponse(file));
  } catch (error) {
    next(error);
  }
}

/**
 * Get presigned download URL
 * GET /files/:id/download
 */
async function getDownloadUrl(req, res, next) {
  try {
    const { id } = req.params;

    const result = await fileService.generatePresignedDownloadUrl(id);

    return res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete file
 * DELETE /files/:id
 */
async function deleteFile(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await fileService.deleteFile(id, userId);

    return res.json(successResponse(null, "File deleted"));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  presignUpload,
  completeUpload,
  getFile,
  getDownloadUrl,
  deleteFile,
};
