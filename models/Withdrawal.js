const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  feePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  feeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['BNB', 'USDT'],
    required: true
  },
  walletAddress: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    trim: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  txHash: {
    type: String,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  paymentType: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual'
  },
  actualReceiveAmount: {
    type: Number,
    min: 0
  },
  transferTxHash: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ processedBy: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
