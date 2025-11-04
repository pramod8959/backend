const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Transaction details
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  blockHash: {
    type: String,
    required: true
  },
  
  // Token and contract information
  tokenAddress: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  network: {
    type: String,
    required: true,
    enum: ['BSC_MAINNET', 'BSC_TESTNET']
  },
  chainId: {
    type: Number,
    required: true
  },
  
  // Amount and pricing
  amount: {
    type: String,
    required: true
  },
  amountInWei: {
    type: String,
    required: true
  },
  tokenSymbol: {
    type: String,
    default: 'USDT'
  },
  tokenDecimals: {
    type: Number,
    default: 18
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  confirmationCount: {
    type: Number,
    default: 0
  },
  
  // Gas information
  gasUsed: {
    type: String
  },
  gasPrice: {
    type: String
  },
  gasLimit: {
    type: String
  },
  
  // Timestamps
  transactionTime: {
    type: Date,
    required: true
  },
  confirmationTime: {
    type: Date
  },
  
  // Additional metadata
  fromAddress: {
    type: String,
    required: true
  },
  toAddress: {
    type: String,
    required: true
  },
  
  // Explorer URLs
  explorerUrl: {
    type: String,
    required: true
  },
  
  // Event logs (for contract events)
  eventLogs: [{
    eventName: String,
    eventData: mongoose.Schema.Types.Mixed,
    logIndex: Number
  }],
  
  // Error information
  errorMessage: {
    type: String
  },
  
  // Additional tracking
  referralCode: {
    type: String
  },
  packageId: {
    type: Number,
    default: 0
  },
  
  // Registration tracking
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isRegistrationPayment: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
transactionSchema.index({ walletAddress: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ network: 1, status: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return `${this.amount} ${this.tokenSymbol}`;
});

// Virtual for transaction URL
transactionSchema.virtual('transactionUrl').get(function() {
  return `${this.explorerUrl}/tx/${this.txHash}`;
});

// Method to update confirmation count
transactionSchema.methods.updateConfirmation = function(confirmationCount) {
  this.confirmationCount = confirmationCount;
  if (confirmationCount >= 12) { // BSC typically needs 12 confirmations
    this.status = 'confirmed';
    this.confirmationTime = new Date();
  }
  return this.save();
};

// Static method to find transactions by wallet
transactionSchema.statics.findByWallet = function(walletAddress) {
  return this.find({ walletAddress: walletAddress.toLowerCase() })
    .sort({ createdAt: -1 })
    .populate('userId', 'firstName lastName email username');
};

// Static method to find transactions by network
transactionSchema.statics.findByNetwork = function(network) {
  return this.find({ network })
    .sort({ createdAt: -1 })
    .populate('userId', 'firstName lastName email username');
};

module.exports = mongoose.model('Transaction', transactionSchema);
