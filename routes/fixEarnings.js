const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Earning = require('../models/Earning');
const MLMService = require('../services/mlmService');

// Fix earnings for a specific user
router.post('/fix-user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can fix user earnings' 
      });
    }

    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Step 1: Calculate correct earnings
    const correctEarnings = await calculateCorrectEarnings(user._id);
    

    // Step 2: Remove all existing earnings for this user
    const deletedEarnings = await Earning.deleteMany({ user: user._id });

    // Step 3: Create correct earnings
    const newEarnings = [];
    
    // Get admin user for fromUser field
    const admin = await User.findOne({ isAdmin: true });
    
    // Direct referral earnings
    if (correctEarnings.directReferralsCount > 0) {
      newEarnings.push({
        user: user._id,
        fromUser: admin._id,
        amount: correctEarnings.directEarnings,
        type: 'direct_referral',
        level: 1,
        commissionRate: 10, // 10% commission
        description: `Direct referral bonus: ${correctEarnings.directReferralsCount} referrals × $2 = $${correctEarnings.directEarnings}`,
        status: 'completed',
        paymentMethod: 'USDT'
      });
    }

    // Level earnings
    for (let level = 1; level <= 15; level++) {
      if (correctEarnings.levelBreakdown[level] > 0) {
        newEarnings.push({
          user: user._id,
          fromUser: admin._id,
          amount: correctEarnings.levelBreakdown[level],
          type: 'level_earning',
          level: level,
          commissionRate: 5, // 5% commission
          description: `Level ${level} earning: ${correctEarnings.levelMembersCount[level]} members × $1 = $${correctEarnings.levelBreakdown[level]}`,
          status: 'completed',
          paymentMethod: 'USDT'
        });
      }
    }

    // Step 4: Save new earnings
    for (const earning of newEarnings) {
      await Earning.create(earning);
    }

    // Step 5: Update user's totalEarnings
    await User.findByIdAndUpdate(user._id, {
      totalEarnings: correctEarnings.totalEarnings,
      exactEarning: correctEarnings.totalEarnings
    });

    res.json({
      success: true,
      message: 'User earnings fixed successfully',
      data: {
        userId: user.userId,
        userName: `${user.firstName} ${user.lastName}`,
        previousEarnings: user.totalEarnings,
        newEarnings: correctEarnings.totalEarnings,
        difference: correctEarnings.totalEarnings - user.totalEarnings,
        earningsBreakdown: {
          directEarnings: correctEarnings.directEarnings,
          levelEarnings: correctEarnings.levelEarnings,
          totalEarnings: correctEarnings.totalEarnings
        },
        levelBreakdown: correctEarnings.levelBreakdown,
        deletedRecords: deletedEarnings.deletedCount,
        createdRecords: newEarnings.length
      }
    });

  } catch (error) {
    console.error('Error fixing user earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fixing user earnings',
      error: error.message 
    });
  }
});

// Fix earnings for all users
router.post('/fix-all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admin can fix all user earnings' 
      });
    }

    // Get all non-admin users
    const users = await User.find({ isAdmin: false }).sort({ createdAt: 1 });

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    let totalEarningsFixed = 0;

    for (const user of users) {
      try {

        // Calculate correct earnings
        const correctEarnings = await calculateCorrectEarnings(user._id);
        
        // Remove existing earnings
        const deletedEarnings = await Earning.deleteMany({ user: user._id });
        
        // Create correct earnings
        const newEarnings = [];
        
        // Get admin user for fromUser field
        const admin = await User.findOne({ isAdmin: true });
        
        // Direct referral earnings
        if (correctEarnings.directReferralsCount > 0) {
          newEarnings.push({
            user: user._id,
            fromUser: admin._id,
            amount: correctEarnings.directEarnings,
            type: 'direct_referral',
            level: 1,
            commissionRate: 10, // 10% commission
            description: `Direct referral bonus: ${correctEarnings.directReferralsCount} referrals × $2 = $${correctEarnings.directEarnings}`,
            status: 'completed',
            paymentMethod: 'USDT'
          });
        }

        // Level earnings
        for (let level = 1; level <= 15; level++) {
          if (correctEarnings.levelBreakdown[level] > 0) {
            newEarnings.push({
              user: user._id,
              fromUser: admin._id,
              amount: correctEarnings.levelBreakdown[level],
              type: 'level_earning',
              level: level,
              commissionRate: 5, // 5% commission
              description: `Level ${level} earning: ${correctEarnings.levelMembersCount[level]} members × $1 = $${correctEarnings.levelBreakdown[level]}`,
              status: 'completed',
              paymentMethod: 'USDT'
            });
          }
        }

        // Save new earnings
        for (const earning of newEarnings) {
          await Earning.create(earning);
        }

        // Update user's totalEarnings
        await User.findByIdAndUpdate(user._id, {
          totalEarnings: correctEarnings.totalEarnings,
          exactEarning: correctEarnings.totalEarnings
        });

        const difference = correctEarnings.totalEarnings - user.totalEarnings;
        totalEarningsFixed += difference;

        results.push({
          userId: user.userId,
          userName: `${user.firstName} ${user.lastName}`,
          previousEarnings: user.totalEarnings,
          newEarnings: correctEarnings.totalEarnings,
          difference: difference,
          status: 'success'
        });

        successCount++;

      } catch (error) {
        console.error(`   ❌ Error fixing ${user.userId}:`, error.message);
        results.push({
          userId: user.userId,
          userName: `${user.firstName} ${user.lastName}`,
          error: error.message,
          status: 'error'
        });
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: 'All user earnings fixed successfully',
      data: {
        totalUsers: users.length,
        successCount: successCount,
        errorCount: errorCount,
        totalEarningsFixed: totalEarningsFixed,
        results: results
      }
    });

  } catch (error) {
    console.error('Error fixing all user earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fixing all user earnings',
      error: error.message 
    });
  }
});

// Validate user earnings without fixing
router.get('/validate/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Calculate correct earnings
    const correctEarnings = await calculateCorrectEarnings(user._id);
    
    // Get current earnings from database
    const currentEarnings = await Earning.find({ user: user._id });
    const currentTotal = currentEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    const isValid = Math.abs(currentTotal - correctEarnings.totalEarnings) < 0.01;

    res.json({
      success: true,
      data: {
        userId: user.userId,
        userName: `${user.firstName} ${user.lastName}`,
        currentEarnings: currentTotal,
        correctEarnings: correctEarnings.totalEarnings,
        difference: correctEarnings.totalEarnings - currentTotal,
        isValid: isValid,
        earningsBreakdown: {
          directEarnings: correctEarnings.directEarnings,
          levelEarnings: correctEarnings.levelEarnings,
          totalEarnings: correctEarnings.totalEarnings
        },
        levelBreakdown: correctEarnings.levelBreakdown,
        directReferralsCount: correctEarnings.directReferralsCount
      }
    });

  } catch (error) {
    console.error('Error validating user earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error validating user earnings',
      error: error.message 
    });
  }
});

// Helper function to calculate correct earnings
async function calculateCorrectEarnings(userId) {
  try {
    // Get direct referrals count using sponsorCode field
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    const directReferrals = await User.find({ sponsorCode: user.referralCode });
    const directReferralsCount = directReferrals.length;
    
    // Calculate direct earnings
    const directEarnings = directReferralsCount * 2; // $2 per direct referral
    
    // Calculate level earnings
    let levelEarnings = 0;
    const levelBreakdown = {};
    const levelMembersCount = {};
    
    for (let level = 1; level <= 15; level++) {
      const requiredRefs = MLMService.MLM_CONFIG.LEVEL_CRITERIA[level];
      const isUnlocked = directReferralsCount >= requiredRefs;
      
      if (isUnlocked) {
        try {
          const teamMembers = await MLMService.getTeamMembersAtLevel(userId, level);
          const levelEarning = teamMembers.length * 1; // $1 per member
          levelEarnings += levelEarning;
          levelBreakdown[level] = levelEarning;
          levelMembersCount[level] = teamMembers.length;
        } catch (error) {
          levelBreakdown[level] = 0;
          levelMembersCount[level] = 0;
        }
      } else {
        levelBreakdown[level] = 0;
        levelMembersCount[level] = 0;
      }
    }
    
    const totalEarnings = directEarnings + levelEarnings;
    
    return {
      directReferralsCount,
      directEarnings,
      levelEarnings,
      totalEarnings,
      levelBreakdown,
      levelMembersCount
    };
    
  } catch (error) {
    console.error('Error calculating correct earnings:', error);
    throw error;
  }
}

module.exports = router;
