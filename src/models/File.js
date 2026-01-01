const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
    required: true,
    maxlength: 255,
  },
  mimeType: {
    type: String,
    required: true,
    maxlength: 100,
  },
  sizeBytes: {
    type: Number,
    required: true,
    min: 0,
    max: 104857600, // 100MB max
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  storage: {
    provider: {
      type: String,
      enum: ['s3', 'minio'],
      default: 's3',
    },
    bucket: {
      type: String,
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
  },
  meta: {
    originalName: String,
    encoding: String,
    uploadMethod: {
      type: String,
      enum: ['presigned', 'direct'],
      default: 'presigned',
    },
  },
  status: {
    type: String,
    enum: ['uploading', 'completed', 'failed', 'deleted'],
    default: 'uploading',
  },
  deletedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
fileSchema.index({ ownerId: 1, createdAt: -1 });
fileSchema.index({ status: 1 });
fileSchema.index({ path: 1 }, { unique: true, sparse: true });

// Method to mark as completed
fileSchema.methods.markCompleted = function() {
  this.status = 'completed';
  return this.save();
};

// Method to mark as deleted (soft delete)
fileSchema.methods.markDeleted = function() {
  this.status = 'deleted';
  this.deletedAt = new Date();
  return this.save();
};

// Method to generate signed URL (placeholder - actual implementation in service)
fileSchema.methods.getSignedUrl = function() {
  // This will be implemented in FileService
  return this.url;
};

// Static method to find completed files
fileSchema.statics.findCompleted = function(ownerId) {
  return this.find({
    ownerId,
    status: 'completed',
  }).sort({ uploadedAt: -1 });
};

// Static method to cleanup old uploading files
fileSchema.statics.cleanupStaleUploads = function(hoursOld = 24) {
  const threshold = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  return this.updateMany(
    {
      status: 'uploading',
      createdAt: { $lt: threshold },
    },
    {
      $set: {
        status: 'failed',
      },
    }
  );
};

const File = mongoose.model('File', fileSchema);

module.exports = File;
