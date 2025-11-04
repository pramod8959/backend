const mongoose = require('mongoose');

const missedLevelEarningSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 15
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    enum: ['level_incomplete', 'level_locked', 'system_error', 'manual_adjustment'],
    default: 'level_incomplete'
  },
  status: {
    type: String,
    enum: ['pending', 'allocated', 'transferred'],
    default: 'pending'
  },
  allocatedAt: {
    type: Date,
    default: null
  },
  transferredAt: {
    type: Date,
    default: null
  },
  transferredToEarning: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Earning',
    default: null
  },
  metadata: {
    expectedMembers: {
      type: Number,
      default: 0
    },
    actualMembers: {
      type: Number,
      default: 0
    },
    missingMembers: {
      type: Number,
      default: 0
    },
    levelCompletionPercentage: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for better performance
missedLevelEarningSchema.index({ user: 1, level: 1 });
missedLevelEarningSchema.index({ userId: 1, level: 1 });
missedLevelEarningSchema.index({ status: 1 });
missedLevelEarningSchema.index({ createdAt: -1 });

// Unique compound index to prevent duplicates (only for pending status)
missedLevelEarningSchema.index(
  { user: 1, level: 1, reason: 1, status: 1 },
  { 
    unique: true, 
    partialFilterExpression: { status: 'pending' } 
  }
);

// Virtual for total missed amount by user
missedLevelEarningSchema.virtual('totalMissedAmount').get(function() {
  return this.amount;
});

// Method to check if level is complete
missedLevelEarningSchema.methods.isLevelComplete = function() {
  return this.metadata.levelCompletionPercentage >= 100;
};

// Method to transfer to main earnings
missedLevelEarningSchema.methods.transferToEarnings = async function() {
  if (this.status !== 'allocated') {
    throw new Error('Can only transfer allocated missed earnings');
  }
  
  this.status = 'transferred';
  this.transferredAt = new Date();
  
  return await this.save();
};

module.exports = mongoose.model('MissedLevelEarning', missedLevelEarningSchema);
