const mongoose = require('mongoose');

const languageBreakdownSchema = new mongoose.Schema({
  language: {
    type: String,
    required: true,
  },
  bytes: {
    type: Number,
    required: true,
    min: 0,
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100,
  },
}, { _id: false });

const securityFindingSchema = new mongoose.Schema({
  id: String,
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
  },
  description: String,
  file: String,
  line: Number,
}, { _id: false });

const analysisMetaSchema = new mongoose.Schema({
  languageBreakdown: [languageBreakdownSchema],
  testsFound: {
    type: Boolean,
    default: false,
  },
  testsSummary: {
    total: {
      type: Number,
      default: 0,
    },
    passing: {
      type: Number,
      default: 0,
    },
    failing: {
      type: Number,
      default: 0,
    },
  },
  ciConfigFound: {
    type: Boolean,
    default: false,
  },
  lintIssuesCount: {
    type: Number,
    default: 0,
  },
  securityFindings: [securityFindingSchema],
  readmePresent: {
    type: Boolean,
    default: false,
  },
  missingRequirements: [
    {
      type: String,
      maxlength: 500,
    },
  ],
}, { _id: false });

const portfolioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  simulationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Simulation',
  },
  repoUrl: {
    type: String,
    required: true,
  },
  repoOwner: {
    type: String,
    required: true,
    maxlength: 100,
  },
  repoName: {
    type: String,
    required: true,
    maxlength: 100,
  },
  normalizedRepo: {
    type: String,
    required: true,
    index: true,
  },
  branch: {
    type: String,
    default: 'main',
    maxlength: 100,
  },
  commitHash: {
    type: String,
    maxlength: 40,
  },
  analysisRequestHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'queued', 'running', 'done', 'error', 'cancelled'],
    default: 'pending',
    index: true,
  },
  analysisJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
  },
  analysisRequestedAt: {
    type: Date,
    default: Date.now,
  },
  analyzedAt: {
    type: Date,
  },
  analyzerVersion: {
    type: String,
    default: '1.0.0',
  },
  toolchain: {
    linter: String,
    ci: String,
    testRunner: String,
  },
  fileCount: {
    type: Number,
    min: 0,
  },
  sizeBytes: {
    type: Number,
    min: 0,
  },
  analysisMeta: analysisMetaSchema,
  analysisError: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed,
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  requestedVia: {
    type: String,
    default: 'web',
  },
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
portfolioSchema.index({ userId: 1, createdAt: -1 });
portfolioSchema.index({ normalizedRepo: 1, branch: 1, commitHash: 1 });
portfolioSchema.index({ status: 1, analysisRequestedAt: 1 });

// Pre-save middleware to normalize repo URL
portfolioSchema.pre('save', function(next) {
  if (this.isModified('repoUrl') && !this.normalizedRepo) {
    // Extract owner/repo from URL
    const match = this.repoUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+)/);
    if (match) {
      this.repoOwner = match[1];
      this.repoName = match[2].replace(/\.git$/, '');
      this.normalizedRepo = `github.com/${this.repoOwner}/${this.repoName}`;
    }
  }
  next();
});

// Method to transition status
portfolioSchema.methods.transitionStatus = function(newStatus, error = null) {
  this.status = newStatus;
  
  if (newStatus === 'done') {
    this.analyzedAt = new Date();
  }
  
  if (newStatus === 'error' && error) {
    this.analysisError = {
      code: error.code || 'UNKNOWN',
      message: error.message,
      details: error.details,
    };
  }
  
  return this.save();
};

// Method to update analysis results
portfolioSchema.methods.updateAnalysis = function(results) {
  this.analysisMeta = results.analysisMeta || {};
  this.fileCount = results.fileCount;
  this.sizeBytes = results.sizeBytes;
  this.toolchain = results.toolchain || {};
  this.analyzedAt = new Date();
  this.status = 'done';
  return this.save();
};

// Static method to find by status
portfolioSchema.statics.findByStatus = function(status, userId = null) {
  const query = { status };
  if (userId) query.userId = userId;
  return this.find(query).sort({ analysisRequestedAt: -1 });
};

// Static method to check if analysis exists
portfolioSchema.statics.findExistingAnalysis = function(repoUrl, branch, userId) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${repoUrl}::${branch}::${userId}`)
    .digest('hex');
  
  return this.findOne({ analysisRequestHash: hash });
};

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = Portfolio;
