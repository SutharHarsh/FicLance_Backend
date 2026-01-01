const mongoose = require('mongoose');

const senderSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['user', 'agent', 'system'],
    required: true,
  },
  id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  agentName: {
    type: String,
    maxlength: 100,
  },
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
  },
  filename: {
    type: String,
    required: true,
    maxlength: 255,
  },
  mimeType: {
    type: String,
    maxlength: 100,
  },
  sizeBytes: {
    type: Number,
    min: 0,
  },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  simulationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Simulation',
    required: true,
    index: true,
  },
  sequence: {
    type: Number,
    required: true,
    min: 1,
  },
  clientMessageId: {
    type: String,
    maxlength: 100,
    sparse: true,
  },
  sender: {
    type: senderSchema,
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000,
  },
  contentType: {
    type: String,
    enum: ['text', 'markdown', 'code', 'file'],
    default: 'text',
  },
  attachments: [attachmentSchema],
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Compound unique index for sequence per simulation
messageSchema.index({ simulationId: 1, sequence: 1 }, { unique: true });
messageSchema.index({ simulationId: 1, createdAt: -1 });
messageSchema.index({ clientMessageId: 1 }, { sparse: true });

// Static method to get next sequence number
messageSchema.statics.getNextSequence = async function(simulationId) {
  const lastMessage = await this.findOne({ simulationId })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  
  return lastMessage ? lastMessage.sequence + 1 : 1;
};

// Static method to find by simulation with pagination
messageSchema.statics.findBySimulation = function(simulationId, options = {}) {
  const { limit = 50, cursor = null, direction = 'asc' } = options;
  
  const query = { simulationId };
  
  if (cursor) {
    query.sequence = direction === 'asc' 
      ? { $gt: cursor } 
      : { $lt: cursor };
  }
  
  return this.find(query)
    .sort({ sequence: direction === 'asc' ? 1 : -1 })
    .limit(limit)
    .lean();
};

// Static method to check if clientMessageId exists
messageSchema.statics.existsByClientId = async function(simulationId, clientMessageId) {
  if (!clientMessageId) return false;
  const count = await this.countDocuments({ simulationId, clientMessageId });
  return count > 0;
};

// Method to edit message
messageSchema.methods.edit = function(newContent, userId) {
  this.content = newContent;
  this.metadata.editedAt = new Date();
  this.metadata.editedBy = userId;
  return this.save();
};

// Method to flag message
messageSchema.methods.flag = function() {
  this.metadata.flagged = true;
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
