const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const MLMService = require('../services/mlmService');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Debug middleware to log all requests to auth routes
router.use((req, res, next) => {
  if (req.path === '/wallet-login') {
    console.log('🔍 [AUTH ROUTER] Request received:', req.method, req.path);
    console.log('🔍 [AUTH ROUTER] Request body:', req.body);
    console.log('🔍 [AUTH ROUTER] Request headers:', req.headers);
  }
  next();
});

// Utility function to validate and fix direct referrals
const validateDirectReferrals = async (userId) => {
  try {
    
    // Get sponsor's referral code for validation
    const sponsor = await User.findById(userId).select('referralCode userId');
    if (!sponsor) {
      return {
        claimedCount: 0,
        actualCount: 0,
        validatedCount: 0,
        validatedReferrals: []
      };
    }

    // Method 1: Get users who have this user as sponsor
    const claimedReferrals = await User.find({ sponsor: userId }).select('firstName lastName username email userId sponsorCode createdAt');

    // Method 2: Get users who used this sponsor's referral code
    const referralCodeUsers = await User.find({ sponsorCode: sponsor.referralCode }).select('firstName lastName username email userId sponsorCode createdAt');

    // Method 3: Cross-validate both methods with fallback
    const validatedReferrals = [];
    
    for (const claimedRef of claimedReferrals) {
      // Check if this user also has the correct sponsorCode
      const hasCorrectSponsorCode = claimedRef.sponsorCode === sponsor.referralCode;
      
      // Additional check: verify the user exists in referralCodeUsers
      const existsInReferralCodeUsers = referralCodeUsers.some(ref => ref._id.toString() === claimedRef._id.toString());
      
      // Fallback: If sponsorCode is missing but user exists in referralCodeUsers, still consider valid
      const isFallbackValid = !claimedRef.sponsorCode && existsInReferralCodeUsers;
      
      // Additional validation: Check if user was registered after sponsor
      const sponsorUser = await User.findById(userId).select('createdAt');
      const isRegisteredAfterSponsor = sponsorUser && claimedRef.createdAt > sponsorUser.createdAt;
      
      if ((hasCorrectSponsorCode && existsInReferralCodeUsers) || (isFallbackValid && isRegisteredAfterSponsor)) {
        validatedReferrals.push(claimedRef);
      } else {
      }
    }
    
    
    return {
      claimedCount: claimedReferrals.length,
      actualCount: referralCodeUsers.length,
      validatedCount: validatedReferrals.length,
      validatedReferrals: validatedReferrals
    };
  } catch (error) {
    console.error('❌ Error validating direct referrals:', error);
    return {
      claimedCount: 0,
      actualCount: 0,
      validatedCount: 0,
      validatedReferrals: []
    };
  }
};

// Register new user
router.post('/register', [
  body('sponsorCode').optional().custom((value) => {
    if (value !== undefined && value !== null && value !== '' && typeof value !== 'string') {
      throw new Error('Referral code must be a string');
    }
    return true;
  }),
  body('paymentMethod').isIn(['BNB', 'USDT']).withMessage('Payment method must be BNB or USDT'),
  body('walletAddress').notEmpty().withMessage('Wallet address is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sponsorCode, paymentMethod, walletAddress, paymentTxHash } = req.body;
    
    // Normalize wallet address to lowercase for consistency
    const normalizedWalletAddress = walletAddress?.toLowerCase();

    // Check if user already exists (wallet address only)
    const existingUser = await User.findOne({
      $or: [
        { walletAddress: normalizedWalletAddress },
        { walletAddress: walletAddress },
        ...(walletAddress ? [
          { walletAddress: walletAddress.toLowerCase() },
          { walletAddress: walletAddress.toUpperCase() }
        ] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is already registered'
      });
    }

    // Handle sponsor code - use admin as fallback if no referral provided
    let sponsor;
    let finalSponsorCode;
    
    if (sponsorCode && sponsorCode.trim()) {
      
      // Debug: Check all referral codes in database
      const allUsers = await User.find({}, 'referralCode username').limit(10);
      
      // Try exact match first
      sponsor = await User.findOne({ referralCode: sponsorCode.toLowerCase() });
      
      // If not found, try case-insensitive search
      if (!sponsor) {
        sponsor = await User.findOne({ referralCode: { $regex: new RegExp(`^${sponsorCode}$`, 'i') } });
      }
      
      // If still not found, try without toLowerCase
      if (!sponsor) {
        sponsor = await User.findOne({ referralCode: sponsorCode });
      }
      
      if (!sponsor) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }
      finalSponsorCode = sponsorCode.toLowerCase();
    } else {
      // No referral code provided, use admin as sponsor
      sponsor = await User.findOne({ isAdmin: true });
      if (!sponsor) {
        return res.status(500).json({
          success: false,
          message: 'Admin account not found. Please contact support.'
        });
      }
      finalSponsorCode = sponsor.referralCode;
    }

    // Use MLM service for registration
    const registrationResult = await MLMService.registerUser({
      sponsorCode: finalSponsorCode,
      walletAddress: normalizedWalletAddress,
      paymentTxHash,
      paymentMethod
    });

    if (!registrationResult.success) {
      return res.status(400).json({
        success: false,
        message: registrationResult.message
      });
    }

    const user = registrationResult.user;

    // Check if JWT_SECRET is available
    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET is not defined");
      throw new Error('JWT_SECRET is not configured');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        sponsorCode: user.sponsorCode,
        referralCode: user.referralCode,
        totalEarnings: user.totalEarnings,
        totalWithdrawn: user.totalWithdrawn,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error code:', error.code);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      console.error('❌ Validation errors:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }
    
    if (error.code === 11000) {
      console.error('❌ Duplicate key error:', error.keyValue);
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found',
        field: Object.keys(error.keyValue)[0]
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Wallet-based login
router.post('/wallet-login', [
  body('walletAddress')
    .notEmpty()
    .withMessage('Wallet address is required')
    .isLength({ min: 42, max: 42 })
    .withMessage('Invalid wallet address format')
    .matches(/^0x[a-fA-F0-9]{40}$/i)
    .withMessage('Invalid Ethereum wallet address format')
], async (req, res) => {
  try {
    console.log('🔐 Wallet-login endpoint hit');
    console.log('📥 Request body:', req.body);
    console.log('📥 Wallet address received:', req.body?.walletAddress);
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { walletAddress } = req.body;
    console.log('✅ Validation passed for wallet address:', walletAddress);
    
    // Normalize wallet address to lowercase for consistency
    const normalizedWalletAddress = walletAddress.toLowerCase();
    console.log('🔄 Normalized wallet address:', normalizedWalletAddress);

    // Find user by wallet address (case insensitive)
    console.log('🔍 Searching for user with wallet address...');
    const user = await User.findOne({ 
      $or: [
        { walletAddress: { $regex: new RegExp(`^${walletAddress}$`, 'i') } },
        { walletAddress: normalizedWalletAddress },
        { walletAddress: walletAddress },
        ...(walletAddress ? [
          { walletAddress: walletAddress.toLowerCase() },
          { walletAddress: walletAddress.toUpperCase() }
        ] : [])
      ]
    });
    console.log('👤 User found:', user ? 'Yes' : 'No');
    if (!user) {
      console.log('❌ No user found with wallet address:', normalizedWalletAddress);
      return res.status(401).json({
        success: false,
        message: 'No account found with this wallet address'
      });
    }

    // Check if account is active
    console.log('✅ User found:', user.userId || user.username || user.email, '- isActive:', user.isActive);
    if (!user.isActive) {
      console.log('❌ Account is deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Wallet login successful for user:', user.userId || user.username || user.email);
    res.json({
      success: true,
      message: 'Wallet login successful',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        sponsorCode: user.sponsorCode,
        referralCode: user.referralCode,
        totalEarnings: user.totalEarnings,
        totalWithdrawn: user.totalWithdrawn,
        walletAddress: user.walletAddress,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('❌ Wallet login error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during wallet login'
    });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user data and direct referrals count in parallel
    const [user, validationResult] = await Promise.all([
      User.findById(userId).select('-password'),
      validateDirectReferrals(userId)
    ]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add direct referrals count to user object
    const userWithReferrals = {
      ...user.toObject(),
      directReferrals: validationResult.validatedCount,
      directReferralsDebug: {
        claimedCount: validationResult.claimedCount,
        actualCount: validationResult.actualCount,
        validatedCount: validationResult.validatedCount,
        validatedReferrals: validationResult.validatedReferrals.map(ref => ({
          id: ref._id,
          name: `${ref.firstName} ${ref.lastName}`,
          username: ref.username,
          userId: ref.userId
        }))
      }
    };
    
    
    res.json({
      success: true,
      user: userWithReferrals
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user profile
router.put('/profile', auth, [
  body('walletAddress').optional().notEmpty().withMessage('Wallet address cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { walletAddress } = req.body;
    const updateData = {};

    if (walletAddress) updateData.walletAddress = walletAddress;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Debug endpoint to check wallet addresses
router.get('/debug-wallets', async (req, res) => {
  try {
    const users = await User.find({}, 'username email walletAddress isAdmin').sort({ createdAt: 1 });
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching wallet addresses',
      error: error.message
    });
  }
});

// Debug endpoint to check referral codes
router.get('/debug-referral-codes', async (req, res) => {
  try {
    const users = await User.find({}, 'username referralCode sponsorCode isAdmin').sort({ createdAt: 1 });
    res.json({
      success: true,
      data: users.map(user => ({
        username: user.username,
        referralCode: user.referralCode,
        sponsorCode: user.sponsorCode,
        isAdmin: user.isAdmin,
        referralCodeLength: user.referralCode ? user.referralCode.length : 0,
        referralCodeType: typeof user.referralCode
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching referral codes',
      error: error.message
    });
  }
});

module.exports = router;
