const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['repo_analysis', 'feedback_generation', 'requirements_generation', 'message_agent', 'analysis_cleanup'],
    required: true,
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'done', 'failed', 'cancelled'],
    default: 'queued',
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
  priority: {
    type: Number,
    default: 0,
    min: -10,
    max: 10,
  },
  lastError: {
    message: String,
    stack: String,
    timestamp: Date,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
  },
  startedAt: {
    type: Date,
  },
  finishedAt: {
    type: Date,
  },
  workerId: {
    type: String,
    maxlength: 100,
  },
  bullJobId: {
    type: String, // Reference to BullMQ job ID
    index: true,
  },
  relatedTo: {
    type: {
      type: String,
      enum: ['simulation', 'portfolio', 'user'],
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
}, {
  timestamps: true,
});

// Indexes
jobSchema.index({ status: 1, createdAt: 1 });
jobSchema.index({ type: 1, status: 1 });
jobSchema.index({ bullJobId: 1 }, { unique: true, sparse: true });

// Method to start job
jobSchema.methods.start = function(workerId) {
  this.status = 'running';
  this.startedAt = new Date();
  this.workerId = workerId;
  return this.save();
};

// Method to complete job
jobSchema.methods.complete = function(result = null) {
  this.status = 'done';
  this.finishedAt = new Date();
  if (result) this.result = result;
  return this.save();
};

// Method to fail job
jobSchema.methods.fail = function(error) {
  this.attempts += 1;
  this.lastError = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date(),
  };
  
  if (this.attempts >= this.maxAttempts) {
    this.status = 'failed';
    this.finishedAt = new Date();
  } else {
    this.status = 'queued'; // Retry
  }
  
  return this.save();
};

// Method to cancel job
jobSchema.methods.cancel = function() {
  this.status = 'cancelled';
  this.finishedAt = new Date();
  return this.save();
};

// Static method to find pending jobs
jobSchema.statics.findPending = function(type = null) {
  const query = { status: 'queued' };
  if (type) query.type = type;
  return this.find(query).sort({ priority: -1, createdAt: 1 });
};

// Static method to find job by BullMQ ID
jobSchema.statics.findByBullJobId = function(bullJobId) {
  return this.findOne({ bullJobId });
};

// Static method to get job statistics
jobSchema.statics.getStats = async function(type = null) {
  const match = type ? { type } : {};
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  return stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
};

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
