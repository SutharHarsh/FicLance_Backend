const mongoose = require('mongoose');

const projectTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  shortDescription: {
    type: String,
    required: true,
    maxlength: 500,
  },
  longDescription: {
    type: String,
    maxlength: 5000,
  },
  requiredSkills: [{
    type: String,
    trim: true,
  }],
  expertiseLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    required: true,
    default: 'beginner',
  },
  durationEstimateDays: {
    type: Number,
    min: 1,
    max: 365,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  complexityScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
  sampleRepoUrl: {
    type: String,
    validate: {
      validator: (v) => !v || /^https?:\/\/.+/.test(v),
      message: 'Invalid repository URL',
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  version: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
});

// Indexes for filtering and search
projectTemplateSchema.index({ isActive: 1, expertiseLevel: 1 });
projectTemplateSchema.index({ isActive: 1, tags: 1 });
projectTemplateSchema.index({ isActive: 1, requiredSkills: 1 });
projectTemplateSchema.index({ name: 'text', shortDescription: 'text', tags: 'text' });

// Virtual for active status
projectTemplateSchema.virtual('status').get(function() {
  return this.isActive ? 'active' : 'inactive';
});

// Method to create snapshot for simulations
projectTemplateSchema.methods.createSnapshot = function() {
  return {
    name: this.name,
    shortDescription: this.shortDescription,
    requiredSkills: this.requiredSkills,
    expertiseLevel: this.expertiseLevel,
    durationEstimateDays: this.durationEstimateDays,
    complexityScore: this.complexityScore,
    version: this.version,
  };
};

// Method to increment version
projectTemplateSchema.methods.incrementVersion = function() {
  this.version += 1;
  return this.save();
};

// Static method to find active templates
projectTemplateSchema.statics.findActive = function(query = {}) {
  return this.find({ ...query, isActive: true });
};

// Static method to filter by skills
projectTemplateSchema.statics.findBySkills = function(skills) {
  return this.find({
    isActive: true,
    requiredSkills: { $in: skills },
  });
};

// Static method to filter by expertise
projectTemplateSchema.statics.findByExpertise = function(level) {
  return this.find({
    isActive: true,
    expertiseLevel: level,
  });
};

// Static method for text search
projectTemplateSchema.statics.search = function(searchTerm) {
  return this.find({
    isActive: true,
    $text: { $search: searchTerm },
  }, {
    score: { $meta: 'textScore' },
  }).sort({ score: { $meta: 'textScore' } });
};

const ProjectTemplate = mongoose.model('ProjectTemplate', projectTemplateSchema);

module.exports = ProjectTemplate;
