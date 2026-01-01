const mongoose = require('mongoose');

const scoreBreakdownSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  weight: {
    type: Number,
    min: 0,
    max: 1,
  },
  comments: String,
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  simulationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Simulation',
    required: true,
    index: true,
  },
  portfolioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Portfolio',
    index: true,
  },
  summary: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
  },
  scoreBreakdown: [scoreBreakdownSchema],
  strengths: [{
    type: String,
    maxlength: 500,
  }],
  improvements: [{
    type: String,
    maxlength: 500,
  }],
  missingRequirements: [{
    type: String,
    maxlength: 500,
  }],
  suggestions: [{
    type: String,
    maxlength: 500,
  }],
  rawAgentResponse: {
    type: mongoose.Schema.Types.Mixed,
  },
  agentVersion: {
    type: String,
    default: '1.0.0',
  },
  generatedBy: {
    type: String,
    enum: ['feedback-agent', 'manual', 'system'],
    default: 'feedback-agent',
  },
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
  },
}, {
  timestamps: true,
});

// Indexes
feedbackSchema.index({ simulationId: 1 });
feedbackSchema.index({ portfolioId: 1 });
feedbackSchema.index({ createdAt: -1 });

// Virtual for weighted average score
feedbackSchema.virtual('calculatedScore').get(function() {
  if (!this.scoreBreakdown || this.scoreBreakdown.length === 0) {
    return this.overallScore || 0;
  }
  
  const totalWeight = this.scoreBreakdown.reduce((sum, item) => sum + (item.weight || 1), 0);
  const weightedSum = this.scoreBreakdown.reduce((sum, item) => {
    return sum + (item.score * (item.weight || 1));
  }, 0);
  
  return Math.round(weightedSum / totalWeight);
});

// Method to calculate overall score from breakdown
feedbackSchema.methods.calculateOverallScore = function() {
  if (this.scoreBreakdown && this.scoreBreakdown.length > 0) {
    this.overallScore = this.calculatedScore;
  }
  return this;
};

// Static method to find by simulation
feedbackSchema.statics.findBySimulation = function(simulationId) {
  return this.findOne({ simulationId }).sort({ createdAt: -1 });
};

// Static method to find by portfolio
feedbackSchema.statics.findByPortfolio = function(portfolioId) {
  return this.findOne({ portfolioId }).sort({ createdAt: -1 });
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
