const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  commissionRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['referral', 'bonus', 'reward', 'direct_referral', 'indirect_referral', 'level_earning', 'level_income', 'creator_bonus', 'development_bonus', 'creator_fee', 'promotional_bonus', 'missed_wallet'],
    default: 'referral'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'paid', 'completed'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['BNB', 'USDT'],
    required: true
  },
  txHash: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
earningSchema.index({ user: 1, createdAt: -1 });
earningSchema.index({ fromUser: 1, level: 1 });
earningSchema.index({ status: 1 });

module.exports = mongoose.model('Earning', earningSchema);
