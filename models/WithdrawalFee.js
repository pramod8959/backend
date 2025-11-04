const mongoose = require('mongoose');

const withdrawalFeeSchema = new mongoose.Schema({
  feePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 5 // Default 5% fee
  },
  isActive: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true,
    default: 'Withdrawal processing fee'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one active fee configuration exists
withdrawalFeeSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('WithdrawalFee', withdrawalFeeSchema);
