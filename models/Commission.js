const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow null for development fund
    index: true
  },
  level: {
    type: Number,
    required: true,
    min: -1, // Allow -1 for development fund, 0 for creator bonus
    max: 15,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  commissionType: {
    type: String,
    enum: ['direct_referral', 'level_income', 'creator_bonus', 'development_bonus', 'bonus', 'special'],
    default: 'level_income',
    index: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'paid',
    index: true
  },
  transactionHash: {
    type: String,
    sparse: true
  },
  // Track the registration that triggered this commission
  triggerRegistration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Additional metadata
  metadata: {
    directReferralsCount: Number,
    unlockedLevels: Number,
    teamSize: Number,
    calculationDate: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Compound indexes for better query performance
commissionSchema.index({ toUser: 1, createdAt: -1 });
commissionSchema.index({ fromUser: 1, level: 1 });
commissionSchema.index({ toUser: 1, level: 1, createdAt: -1 });
commissionSchema.index({ triggerRegistration: 1 });
commissionSchema.index({ commissionType: 1, status: 1 });

// Virtual for formatted amount
commissionSchema.virtual('formattedAmount').get(function() {
  return `$${this.amount.toFixed(2)}`;
});

// Method to mark commission as paid
commissionSchema.methods.markAsPaid = function(transactionHash = null) {
  this.status = 'paid';
  if (transactionHash) {
    this.transactionHash = transactionHash;
  }
  return this.save();
};

// Static method to get total commissions for a user
commissionSchema.statics.getTotalCommissions = function(userId, options = {}) {
  const query = { toUser: userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.level) {
    query.level = options.level;
  }
  
  if (options.commissionType) {
    query.commissionType = options.commissionType;
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalCommissions: { $sum: 1 },
        byLevel: {
          $push: {
            level: '$level',
            amount: '$amount',
            type: '$commissionType'
          }
        }
      }
    }
  ]);
};

// Static method to get commission breakdown by level
commissionSchema.statics.getCommissionBreakdown = function(userId) {
  return this.aggregate([
    { $match: { toUser: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$level',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

// Static method to get recent commissions
commissionSchema.statics.getRecentCommissions = function(userId, limit = 10) {
  return this.find({ toUser: userId })
    .populate('fromUser', 'userId firstName lastName walletAddress')
    .populate('triggerRegistration', 'userId firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Pre-save middleware to set description if not provided
commissionSchema.pre('save', function(next) {
  if (!this.description) {
    if (this.level === 1) {
      this.description = `Direct referral commission from level ${this.level}`;
      this.commissionType = 'direct_referral';
    } else {
      this.description = `Indirect referral commission from level ${this.level}`;
      this.commissionType = 'indirect_referral';
    }
  }
  next();
});

module.exports = mongoose.model('Commission', commissionSchema);