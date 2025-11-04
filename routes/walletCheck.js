const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Check if wallet is already registered
router.post('/check', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    // Check if wallet is already registered
    const existingUser = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });

    if (existingUser) {
      return res.json({
        success: true,
        isRegistered: true,
        user: {
          id: existingUser._id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          username: existingUser.username,
          walletAddress: existingUser.walletAddress,
          isActive: existingUser.isActive
        },
        message: 'Wallet is already registered'
      });
    }

    return res.json({
      success: true,
      isRegistered: false,
      message: 'Wallet is not registered'
    });

  } catch (error) {
    console.error('Error checking wallet registration:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking wallet registration',
      error: error.message
    });
  }
});

// Get wallet registration status
router.get('/status/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;

    const existingUser = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    });

    return res.json({
      success: true,
      isRegistered: !!existingUser,
      user: existingUser ? {
        id: existingUser._id,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        email: existingUser.email,
        username: existingUser.username,
        walletAddress: existingUser.walletAddress,
        isActive: existingUser.isActive
      } : null
    });

  } catch (error) {
    console.error('Error getting wallet status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting wallet status',
      error: error.message
    });
  }
});

module.exports = router;
