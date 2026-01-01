const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { File } = require('../models');
const { enqueueCleanup } = require('./queue.service');
const { AppError } = require('../utils/errors');
const config = require('../config/env');
const logger = require('../config/logger');

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: config.s3Endpoint,
  region: config.s3Region,
  credentials: {
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
  },
  forcePathStyle: config.s3ForcePathStyle,
});

/**
 * Generate presigned URL for file upload
 */
async function generatePresignedUploadUrl(userId, filename, contentType, sizeBytes) {
  // Validate file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (sizeBytes > maxSize) {
    throw new AppError('File size exceeds maximum allowed (50MB)', 400);
  }

  // Generate unique file key
  const fileId = uuidv4();
  const ext = filename.split('.').pop();
  const key = `uploads/${userId}/${fileId}.${ext}`;

  // Create file record with status 'uploading'
  const file = await File.create({
    _id: fileId,
    ownerId: userId,
    filename,
    mimeType: contentType,
    sizeBytes,
    path: key,
    storage: {
      provider: 's3',
      bucket: config.s3Bucket,
      region: config.s3Region,
    },
    meta: { status: 'uploading' },
  });

  // Generate presigned URL for PUT (valid for 15 minutes)
  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  logger.info(`Presigned upload URL generated for file: ${fileId}`);

  return {
    fileId,
    uploadUrl,
    key,
    expiresIn: 900,
  };
}

/**
 * Complete file upload
 */
async function completeFileUpload(fileId, uploadedUrl) {
  const file = await File.findById(fileId);

  if (!file) {
    throw new AppError('File not found', 404);
  }

  file.url = uploadedUrl;
  file.uploadedAt = new Date();
  file.meta.status = 'completed';
  await file.save();

  logger.info(`File upload completed: ${fileId}`);

  return file.toObject();
}

/**
 * Get file by ID
 */
async function getFileById(fileId) {
  const file = await File.findById(fileId).lean();

  if (!file || file.deleted) {
    throw new AppError('File not found', 404);
  }

  return file;
}

/**
 * Generate presigned URL for file download
 */
async function generatePresignedDownloadUrl(fileId) {
  const file = await File.findById(fileId);

  if (!file || file.deleted) {
    throw new AppError('File not found', 404);
  }

  const command = new GetObjectCommand({
    Bucket: file.storage.bucket,
    Key: file.path,
  });

  const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  logger.info(`Presigned download URL generated for file: ${fileId}`);

  return {
    downloadUrl,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    expiresIn: 3600,
  };
}

/**
 * Delete file (soft delete + enqueue S3 cleanup)
 */
async function deleteFile(fileId, userId) {
  const file = await File.findById(fileId);

  if (!file) {
    throw new AppError('File not found', 404);
  }

  if (file.ownerId.toString() !== userId.toString()) {
    throw new AppError('Not authorized', 403);
  }

  file.deleted = true;
  file.deletedAt = new Date();
  await file.save();

  // Enqueue cleanup job to delete from S3 (with delay to allow rollback)
  await enqueueCleanup('file', {
    fileId: fileId.toString(),
    bucket: file.storage.bucket,
    key: file.path,
  }, {
    delay: 60000, // 1 minute delay
  });

  logger.info(`File soft deleted: ${fileId}`);

  return { success: true };
}

/**
 * Delete file from S3 (called by cleanup worker)
 */
async function deleteFileFromS3(bucket, key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);

    logger.info(`File deleted from S3: ${key}`);
    
    return { success: true };
  } catch (error) {
    logger.error(`Failed to delete file from S3: ${key}`, error);
    throw error;
  }
}

module.exports = {
  generatePresignedUploadUrl,
  completeFileUpload,
  getFileById,
  generatePresignedDownloadUrl,
  deleteFile,
  deleteFileFromS3,
};
