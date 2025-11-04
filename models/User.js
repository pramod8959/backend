const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    sparse: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  sponsorCode: {
    type: String,
    required: true,
    ref: 'User'
  },
  sponsor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  position: {
    type: String,
    enum: ['left', 'right', 'root'],
    required: true
  },
  level: {
    type: Number,
    default: 1
  },
  leftChild: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rightChild: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  registrationFee: {
    type: Number,
    default: 20,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['BNB', 'USDT'],
    required: true
  },
  paymentTxHash: {
    type: String,
    trim: true
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  exactEarning: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  walletAddress: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values but ensures uniqueness for non-null values
  },
  photo: {
    public_id: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    },
    secure_url: {
      type: String,
      trim: true
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// Generate unique user ID starting from SBW786
userSchema.statics.generateUserId = async function() {
  // Find the highest existing userId number
  const lastUser = await this.findOne({ userId: { $regex: /^SBW\d+$/ } })
    .sort({ userId: -1 })
    .limit(1);
  
  let nextNumber = 786; // Starting number
  
  if (lastUser && lastUser.userId) {
    // Extract the number from the last userId (e.g., SBW786 -> 786)
    const lastNumber = parseInt(lastUser.userId.replace('SBW', ''));
    nextNumber = lastNumber + 1;
  }
  
  return `SBW${nextNumber}`;
};

// Set referral code to wallet address and generate userId
userSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate unique userId if not already set
    if (!this.userId) {
      this.userId = await this.constructor.generateUserId();
    }
    
    // Set referral code to wallet address
    if (!this.referralCode && this.walletAddress) {
      this.referralCode = this.walletAddress.toLowerCase();
    }
  }
  next();
});

// Get team members
userSchema.methods.getTeamMembers = async function() {
  return await this.constructor.find({ sponsor: this._id }).populate('sponsor', 'referralCode walletAddress');
};

// Get team tree (up to 15 levels)
userSchema.methods.getTeamTree = async function(level = 1, maxLevel = 15) {
  if (level > maxLevel) return [];
  
  const directTeam = await this.constructor.find({ sponsor: this._id });
  const teamTree = [];
  
  for (const member of directTeam) {
    const memberData = {
      _id: member._id,
      level: level,
      totalEarnings: member.totalEarnings,
      isActive: member.isActive,
      children: await member.getTeamTree(level + 1, maxLevel)
    };
    teamTree.push(memberData);
  }
  
  return teamTree;
};

module.exports = mongoose.model('User', userSchema);
