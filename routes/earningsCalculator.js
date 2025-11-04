const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Earning = require('../models/Earning');
const MLMService = require('../services/mlmService');

// Calculate user earnings by ID
router.get('/calculate/:userId', auth, async (req, res) => {
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
    const calculatedEarnings = await calculateUserEarnings(user._id);
    
    // Get current earnings from database
    const currentEarnings = await Earning.find({ user: user._id });
    const currentTotal = currentEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    const isValid = Math.abs(currentTotal - calculatedEarnings.totalEarnings) < 0.01;

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          referralCode: user.referralCode,
          sponsorCode: user.sponsorCode,
          level: user.level,
          registrationDate: user.createdAt
        },
        currentEarnings: {
          total: currentTotal,
          breakdown: currentEarnings.map(earning => ({
            type: earning.type,
            amount: earning.amount,
            level: earning.level,
            description: earning.description,
            createdAt: earning.createdAt
          }))
        },
        calculatedEarnings: {
          total: calculatedEarnings.totalEarnings,
          directEarnings: calculatedEarnings.directEarnings,
          levelEarnings: calculatedEarnings.levelEarnings,
          breakdown: calculatedEarnings.levelBreakdown,
          directReferralsCount: calculatedEarnings.directReferralsCount,
          levelMembersCount: calculatedEarnings.levelMembersCount
        },
        comparison: {
          difference: calculatedEarnings.totalEarnings - currentTotal,
          isValid: isValid,
          needsFix: !isValid
        },
        levelAnalysis: calculatedEarnings.levelAnalysis
      }
    });

  } catch (error) {
    console.error('Error calculating user earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error calculating user earnings',
      error: error.message 
    });
  }
});

// Calculate earnings for current logged-in user
router.get('/my-earnings', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    

    // Calculate correct earnings
    const calculatedEarnings = await calculateUserEarnings(userId);
    
    // Get current earnings from database
    const currentEarnings = await Earning.find({ user: userId });
    const currentTotal = currentEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    const isValid = Math.abs(currentTotal - calculatedEarnings.totalEarnings) < 0.01;

    res.json({
      success: true,
      data: {
        currentEarnings: {
          total: currentTotal,
          breakdown: currentEarnings.map(earning => ({
            type: earning.type,
            amount: earning.amount,
            level: earning.level,
            description: earning.description,
            createdAt: earning.createdAt
          }))
        },
        calculatedEarnings: {
          total: calculatedEarnings.totalEarnings,
          directEarnings: calculatedEarnings.directEarnings,
          levelEarnings: calculatedEarnings.levelEarnings,
          breakdown: calculatedEarnings.levelBreakdown,
          directReferralsCount: calculatedEarnings.directReferralsCount,
          levelMembersCount: calculatedEarnings.levelMembersCount
        },
        comparison: {
          difference: calculatedEarnings.totalEarnings - currentTotal,
          isValid: isValid,
          needsFix: !isValid
        },
        levelAnalysis: calculatedEarnings.levelAnalysis
      }
    });

  } catch (error) {
    console.error('Error calculating current user earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error calculating current user earnings',
      error: error.message 
    });
  }
});

// Update total earnings in database for a specific user
router.put('/update/:userId', auth, async (req, res) => {
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
    const calculatedEarnings = await calculateUserEarnings(userId);
    
    // Get current earnings from database
    const currentEarnings = await Earning.find({ user: userId });
    const currentTotal = currentEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    // Update user's totalEarnings in database
    const previousTotalEarnings = user.totalEarnings;
    user.totalEarnings = calculatedEarnings.totalEarnings;
    await user.save();

    res.json({
      success: true,
      message: 'Total earnings updated successfully',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        },
        previousTotalEarnings: previousTotalEarnings,
        newTotalEarnings: calculatedEarnings.totalEarnings,
        calculatedEarnings: {
          total: calculatedEarnings.totalEarnings,
          directEarnings: calculatedEarnings.directEarnings,
          levelEarnings: calculatedEarnings.levelEarnings,
          breakdown: calculatedEarnings.levelBreakdown,
          directReferralsCount: calculatedEarnings.directReferralsCount,
          levelMembersCount: calculatedEarnings.levelMembersCount
        }
      }
    });

  } catch (error) {
    console.error('Error updating total earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating total earnings',
      error: error.message 
    });
  }
});

// Update total earnings for current logged-in user
router.put('/update-my-earnings', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    

    // Calculate correct earnings
    const calculatedEarnings = await calculateUserEarnings(userId);
    
    // Get current earnings from database
    const currentEarnings = await Earning.find({ user: userId });
    const currentTotal = currentEarnings.reduce((sum, earning) => sum + earning.amount, 0);

    // Update user's totalEarnings in database
    const user = await User.findById(userId);
    const previousTotalEarnings = user.totalEarnings;
    user.totalEarnings = calculatedEarnings.totalEarnings;
    await user.save();

    res.json({
      success: true,
      message: 'Total earnings updated successfully',
      data: {
        previousTotalEarnings: previousTotalEarnings,
        newTotalEarnings: calculatedEarnings.totalEarnings,
        calculatedEarnings: {
          total: calculatedEarnings.totalEarnings,
          directEarnings: calculatedEarnings.directEarnings,
          levelEarnings: calculatedEarnings.levelEarnings,
          breakdown: calculatedEarnings.levelBreakdown,
          directReferralsCount: calculatedEarnings.directReferralsCount,
          levelMembersCount: calculatedEarnings.levelMembersCount
        }
      }
    });

  } catch (error) {
    console.error('Error updating total earnings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating total earnings',
      error: error.message 
    });
  }
});

// Helper function to calculate user earnings
async function calculateUserEarnings(userId) {
  try {
    // Get user details
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    // Get direct referrals count using sponsorCode field
    const directReferrals = await User.find({ sponsorCode: user.referralCode });
    const directReferralsCount = directReferrals.length;
    
    // Calculate direct earnings
    const directEarnings = directReferralsCount * 2; // $2 per direct referral
    
    // Calculate level earnings
    let levelEarnings = 0;
    const levelBreakdown = {};
    const levelMembersCount = {};
    const levelAnalysis = {};
    
    for (let level = 1; level <= 15; level++) {
      const requiredRefs = MLMService.MLM_CONFIG.LEVEL_CRITERIA[level];
      const isUnlocked = directReferralsCount >= requiredRefs;
      
      levelAnalysis[level] = {
        requiredReferrals: requiredRefs,
        currentReferrals: directReferralsCount,
        isUnlocked: isUnlocked,
        membersCount: 0,
        earning: 0
      };
      
      if (isUnlocked) {
        try {
          const teamMembers = await MLMService.getTeamMembersAtLevel(userId, level);
          const levelEarning = teamMembers.length * 1; // $1 per member
          levelEarnings += levelEarning;
          levelBreakdown[level] = levelEarning;
          levelMembersCount[level] = teamMembers.length;
          
          levelAnalysis[level].membersCount = teamMembers.length;
          levelAnalysis[level].earning = levelEarning;
        } catch (error) {
          levelBreakdown[level] = 0;
          levelMembersCount[level] = 0;
          levelAnalysis[level].membersCount = 0;
          levelAnalysis[level].earning = 0;
        }
      } else {
        levelBreakdown[level] = 0;
        levelMembersCount[level] = 0;
        levelAnalysis[level].membersCount = 0;
        levelAnalysis[level].earning = 0;
      }
    }
    
    const totalEarnings = directEarnings + levelEarnings;
    
    return {
      directReferralsCount,
      directEarnings,
      levelEarnings,
      totalEarnings,
      levelBreakdown,
      levelMembersCount,
      levelAnalysis
    };
    
  } catch (error) {
    console.error('Error calculating user earnings:', error);
    throw error;
  }
}

// Automatic update helper function
async function updateUserTotalEarningsInDatabase(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found: ${userId}`);
      return null;
    }
    
    const calculatedEarnings = await calculateUserEarnings(userId);
    user.totalEarnings = calculatedEarnings.totalEarnings;
    await user.save();
    
    return calculatedEarnings.totalEarnings;
  } catch (error) {
    console.error(`Error auto-updating totalEarnings for user ${userId}:`, error);
    return null;
  }
}

module.exports = router;

// Export helper function separately
module.exports.updateUserTotalEarningsInDatabase = updateUserTotalEarningsInDatabase;
