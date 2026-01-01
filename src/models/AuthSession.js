const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  deviceInfo: {
    ua: {
      type: String,
      maxlength: 500,
    },
    ip: {
      type: String,
      maxlength: 45, // IPv6 length
    },
    name: {
      type: String,
      maxlength: 100,
      default: 'Unknown Device',
    },
  },
  refreshTokenHash: {
    type: String,
    required: true,
    select: false, // Don't include in queries by default
  },
  refreshTokenCreatedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true, // For TTL index
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'github'],
    default: 'local',
  },
  oauthAccessTokenEncrypted: {
    type: String,
    select: false,
  },
  oauthRefreshTokenEncrypted: {
    type: String,
    select: false,
  },
  revoked: {
    type: Boolean,
    default: false,
    index: true,
  },
  revokedReason: {
    type: String,
    maxlength: 200,
  },
  revokedAt: {
    type: Date,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Compound indexes
authSessionSchema.index({ userId: 1, revoked: 1 });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save middleware to set expiresAt if not provided
authSessionSchema.pre('save', function(next) {
  if (!this.expiresAt && this.refreshTokenCreatedAt) {
    // Default 30 days expiry
    this.expiresAt = new Date(this.refreshTokenCreatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Method to check if session is valid
authSessionSchema.methods.isValid = function() {
  return !this.revoked && this.expiresAt > new Date();
};

// Method to revoke session
authSessionSchema.methods.revoke = function(reason = 'User logout') {
  this.revoked = true;
  this.revokedReason = reason;
  this.revokedAt = new Date();
  return this.save();
};

// Method to update last used
authSessionSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to find valid sessions for user
authSessionSchema.statics.findValidSessions = function(userId) {
  return this.find({
    userId,
    revoked: false,
    expiresAt: { $gt: new Date() },
  }).sort({ lastUsedAt: -1 });
};

// Static method to revoke all sessions for user
authSessionSchema.statics.revokeAllForUser = async function(userId, reason = 'User action') {
  return this.updateMany(
    { userId, revoked: false },
    {
      $set: {
        revoked: true,
        revokedReason: reason,
        revokedAt: new Date(),
      },
    }
  );
};

// Static method to cleanup expired sessions (manual, even though TTL handles it)
authSessionSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
  });
};

const AuthSession = mongoose.model('AuthSession', authSessionSchema);

module.exports = AuthSession;
