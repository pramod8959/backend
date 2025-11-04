const express = require('express');
const CommissionService = require('../services/commissionService');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Distribute commission for a new user registration
router.post('/distribute/:newUserId', auth, async (req, res) => {
  try {
    const { newUserId } = req.params;
    
    // Verify user exists
    const newUser = await User.findById(newUserId);
    if (!newUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if current user is admin or the new user themselves
    const canDistribute = req.user.isAdmin || req.user._id.toString() === newUserId;
    if (!canDistribute) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to distribute commissions'
      });
    }
    
    console.log(`🎯 Manual commission distribution requested for user: ${newUser.userId}`);
    
    // Distribute commission
    const result = await CommissionService.distributeCommission(newUserId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Commission distributed successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('Error in commission distribution endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during commission distribution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get commission summary for a user
router.get('/summary/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    
    // Check if current user can view this data
    const canView = req.user.isAdmin || req.user._id.toString() === targetUserId;
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view commission data'
      });
    }
    
    const user = await User.findById(targetUserId)
      .select('userId firstName lastName totalEarnings totalWithdrawn');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const summary = await CommissionService.getCommissionSummary(targetUserId);
    
    res.json({
      success: true,
      message: 'Commission summary retrieved successfully',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          totalEarnings: user.totalEarnings || 0,
          totalWithdrawn: user.totalWithdrawn || 0
        },
        summary
      }
    });
    
  } catch (error) {
    console.error('Error getting commission summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting commission summary'
    });
  }
});

// Get user's unlocked levels and status
router.get('/levels/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    
    const user = await User.findById(targetUserId)
      .select('userId firstName lastName totalEarnings');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Calculate user's MLM status
    const directReferralsCount = await CommissionService.getDirectReferralsCount(targetUserId);
    const teamFullyBuilt = await CommissionService.isTeamFullyBuilt(targetUserId);
    const unlockedLevels = CommissionService.calculateUnlockedLevels(directReferralsCount, teamFullyBuilt);
    const totalTeamSize = await CommissionService.getTotalTeamSize(targetUserId);
    
    // Calculate level breakdown
    const levelBreakdown = {};
    for (let level = 1; level <= 15; level++) {
      const membersAtLevel = await CommissionService.getMembersAtLevel(targetUserId, level);
      const expectedMembers = Math.pow(2, level);
      const isUnlocked = level <= unlockedLevels;
      
      levelBreakdown[`level${level}`] = {
        level,
        isUnlocked,
        currentMembers: membersAtLevel,
        expectedMembers,
        fillPercentage: expectedMembers > 0 ? ((membersAtLevel / expectedMembers) * 100).toFixed(2) : 0,
        commissionPerMember: level === 1 ? 2 : 1,
        currentEarnings: isUnlocked ? membersAtLevel * (level === 1 ? 2 : 1) : 0,
        potentialEarnings: expectedMembers * (level === 1 ? 2 : 1)
      };
    }
    
    res.json({
      success: true,
      message: 'User levels retrieved successfully',
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          totalEarnings: user.totalEarnings || 0
        },
        status: {
          directReferralsCount,
          totalTeamSize,
          unlockedLevels,
          maxPossibleLevels: 15,
          teamFullyBuilt,
          progressPercentage: ((unlockedLevels / 15) * 100).toFixed(2)
        },
        requirements: {
          toUnlockLevel5: Math.max(0, 5 - directReferralsCount),
          toUnlockLevel10: Math.max(0, 10 - directReferralsCount),
          toUnlockLevel15: Math.max(0, 15 - directReferralsCount)
        },
        levelBreakdown
      }
    });
    
  } catch (error) {
    console.error('Error getting user levels:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting user levels'
    });
  }
});

// Get commission history for a user
router.get('/history/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const level = req.query.level ? parseInt(req.query.level) : null;
    const type = req.query.type;
    
    // Check authorization
    const canView = req.user.isAdmin || req.user._id.toString() === targetUserId;
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view commission history'
      });
    }
    
    // Build query
    const query = { toUser: targetUserId };
    if (level) query.level = level;
    if (type) query.commissionType = type;
    
    // Get paginated commissions
    const skip = (page - 1) * limit;
    const commissions = await Commission.find(query)
      .populate('fromUser', 'userId firstName lastName walletAddress')
      .populate('triggerRegistration', 'userId firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const totalCommissions = await Commission.countDocuments(query);
    const totalPages = Math.ceil(totalCommissions / limit);
    
    res.json({
      success: true,
      message: 'Commission history retrieved successfully',
      data: {
        commissions,
        pagination: {
          currentPage: page,
          totalPages,
          totalCommissions,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting commission history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting commission history'
    });
  }
});

// Get maximum potential earnings breakdown
router.get('/potential-earnings', auth, async (req, res) => {
  try {
    const potentialEarnings = CommissionService.calculateMaxPotentialEarnings();
    
    res.json({
      success: true,
      message: 'Potential earnings calculated successfully',
      data: potentialEarnings
    });
    
  } catch (error) {
    console.error('Error calculating potential earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating potential earnings'
    });
  }
});

// Admin: Get commission statistics
router.get('/admin/stats', auth, async (req, res) => {
  try {
    // Check admin access
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    const totalCommissions = await Commission.countDocuments();
    const totalAmount = await Commission.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const commissionsByType = await Commission.aggregate([
      { $group: { _id: '$commissionType', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }
    ]);
    
    const commissionsByLevel = await Commission.aggregate([
      { $group: { _id: '$level', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } }
    ]);
    
    const recentCommissions = await Commission.find()
      .populate('fromUser', 'userId firstName lastName')
      .populate('toUser', 'userId firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      message: 'Commission statistics retrieved successfully',
      data: {
        overview: {
          totalCommissions,
          totalAmount: totalAmount[0]?.total || 0,
          averageCommission: totalCommissions > 0 ? (totalAmount[0]?.total || 0) / totalCommissions : 0
        },
        byType: commissionsByType,
        byLevel: commissionsByLevel,
        recent: recentCommissions,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error getting commission stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting commission statistics'
    });
  }
});

module.exports = router;