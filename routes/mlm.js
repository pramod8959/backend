const express = require('express');
const router = express.Router();
const MLMService = require('../services/mlmService');
const { auth, authenticateToken } = require('../middleware/auth');

// Get user's direct referrals (left-right combination)
router.get('/direct-referrals', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const directReferrals = await MLMService.getDirectReferrals(userId);
    
    res.json({
      success: true,
      data: directReferrals
    });
  } catch (error) {
    console.error('Error getting direct referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting direct referrals',
      error: error.message
    });
  }
});

// Get user's team tree in proper binary structure (top-bottom, left-right)
router.get('/binary-team-tree', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const maxLevel = parseInt(req.query.maxLevel) || 15;
    const binaryTree = await MLMService.getBinaryTeamTree(userId, maxLevel);
    
    res.json({
      success: true,
      data: binaryTree
    });
  } catch (error) {
    console.error('Error getting binary team tree:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting binary team tree',
      error: error.message
    });
  }
});

// Get user's team tree (15 levels)
router.get('/team-tree', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const maxLevel = parseInt(req.query.maxLevel) || 15;
    const teamTree = await MLMService.getTeamTree(userId, maxLevel);
    
    res.json({
      success: true,
      data: teamTree
    });
  } catch (error) {
    console.error('Error getting team tree:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting team tree',
      error: error.message
    });
  }
});

// Get user's tree structure (left-right binary tree)
router.get('/tree-structure', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const maxLevel = parseInt(req.query.maxLevel) || 15;
    const treeStructure = await MLMService.getTreeStructure(userId, maxLevel);
    
    res.json({
      success: true,
      data: treeStructure
    });
  } catch (error) {
    console.error('Error getting tree structure:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tree structure',
      error: error.message
    });
  }
});

// Get user's tree statistics
router.get('/tree-statistics', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const treeStats = await MLMService.getTreeStatistics(userId);
    
    res.json({
      success: true,
      data: treeStats
    });
  } catch (error) {
    console.error('Error getting tree statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting tree statistics',
      error: error.message
    });
  }
});

// Get user's earnings summary
router.get('/earnings', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const earningsSummary = await MLMService.getEarningsSummary(userId);
    
    res.json({
      success: true,
      data: earningsSummary
    });
  } catch (error) {
    console.error('Error getting earnings summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting earnings summary',
      error: error.message
    });
  }
});

// Get user's earnings history with pagination
router.get('/earnings/history', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const earningsHistory = await MLMService.getEarningsHistory(userId, page, limit);
    
    res.json({
      success: true,
      data: earningsHistory
    });
  } catch (error) {
    console.error('Error getting earnings history:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting earnings history',
      error: error.message
    });
  }
});

// Get admin's 15 direct SDs
router.get('/admin-direct-sds', auth, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const directSDs = await MLMService.getAdminDirectSDs();
    
    res.json({
      success: true,
      data: directSDs
    });
  } catch (error) {
    console.error('Error getting admin direct SDs:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting admin direct SDs',
      error: error.message
    });
  }
});

// Get MLM configuration
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        registrationFee: MLMService.MLM_CONFIG.REGISTRATION_FEE,
        directReferralFirst: MLMService.MLM_CONFIG.DIRECT_REFERRAL_FIRST,
        directReferralSubsequent: MLMService.MLM_CONFIG.DIRECT_REFERRAL_SUBSEQUENT,
        indirectReferral: MLMService.MLM_CONFIG.INDIRECT_REFERRAL,
        maxLevels: MLMService.MLM_CONFIG.MAX_LEVELS,
        creatorFee: MLMService.MLM_CONFIG.CREATOR_FEE,
        promotionalBonus: MLMService.MLM_CONFIG.PROMOTIONAL_BONUS,
        levelEarnings: MLMService.MLM_CONFIG.LEVEL_EARNINGS
      }
    });
  } catch (error) {
    console.error('Error getting MLM config:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting MLM configuration',
      error: error.message
    });
  }
});

// Get indirect users only (excluding direct referrals)
router.get('/indirect-users', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { level = 15, page = 1, limit = 100 } = req.query;
    
    
    // Get all team members (direct + indirect)
    const allMembers = await MLMService.getAllTeamMembers(userId, parseInt(level));
    
    // Filter out direct referrals (level 1) to get only indirect users
    const indirectUsers = allMembers.filter(member => member.treeLevel > 1);
    
    // Log some sample data for debugging
    if (indirectUsers.length > 0) {
      console.log('Sample indirect user:', {
        username: indirectUsers[0].username,
        totalEarnings: indirectUsers[0].totalEarnings,
        treeLevel: indirectUsers[0].treeLevel,
        level: indirectUsers[0].level
      });
    }
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = indirectUsers.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        members: paginatedMembers,
        totalCount: indirectUsers.length,
        currentPage: parseInt(page),
        totalPages: Math.ceil(indirectUsers.length / limit)
      }
    });
  } catch (error) {
    console.error('Error getting indirect users:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting indirect users',
      error: error.message
    });
  }
});

// Recalculate all user earnings (admin only)
router.post('/recalculate-earnings', auth, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    await MLMService.recalculateAllEarningsWithMissedWallet();
    
    res.json({
      success: true,
      message: 'All user earnings recalculated successfully with missed wallet handling'
    });
  } catch (error) {
    console.error('Error recalculating earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error recalculating earnings',
      error: error.message
    });
  }
});

// Process missed wallet earnings for a specific user (admin only)
router.post('/process-missed-wallet/:userId', auth, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { userId } = req.params;
    const missedEarnings = await MLMService.processMissedWalletEarnings(userId);
    
    res.json({
      success: true,
      message: `Processed ${missedEarnings.length} missed wallet earnings`,
      data: missedEarnings
    });
  } catch (error) {
    console.error('Error processing missed wallet earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing missed wallet earnings',
      error: error.message
    });
  }
});

// Fix existing earnings (admin only) - runs the fixExistingEarnings script
router.post('/fix-existing-earnings', auth, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Import and run the fix script
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../scripts/fixExistingEarnings.js');
    
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running fix script:', error);
        return res.status(500).json({
          success: false,
          message: 'Error running fix script',
          error: error.message
        });
      }
      
      if (stderr) {
        console.error('Fix script stderr:', stderr);
      }
      
      
      res.json({
        success: true,
        message: 'Existing earnings fixed successfully',
        output: stdout
      });
    });
    
  } catch (error) {
    console.error('Error fixing existing earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing existing earnings',
      error: error.message
    });
  }
});

// Fix self registration earnings (admin only) - removes earnings users got from their own registration
router.post('/fix-self-registration-earnings', auth, async (req, res) => {
  try {
    // Check if user is admin
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Import and run the fix script
    const { exec } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../scripts/fixSelfRegistrationEarnings.js');
    
    exec(`node ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error running fix script:', error);
        return res.status(500).json({
          success: false,
          message: 'Error running fix script',
          error: error.message
        });
      }
      
      if (stderr) {
        console.error('Fix script stderr:', stderr);
      }
      
      
      res.json({
        success: true,
        message: 'Self registration earnings fixed successfully',
        output: stdout
      });
    });
    
  } catch (error) {
    console.error('Error fixing self registration earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing self registration earnings',
      error: error.message
    });
  }
});

// Get level-wise member distribution
router.get('/level-distribution', authenticateToken, async (req, res) => {
  try {
    const { maxLevel = 15 } = req.query;
    const userId = req.user._id;

    // Validate userId
    if (!userId) {
      console.error('No user ID found in request');
      return res.status(400).json({
        success: false,
        message: 'User ID not found in request'
      });
    }

    const distribution = await MLMService.getLevelWiseMemberDistribution(userId, parseInt(maxLevel));

    if (distribution) {
      res.json({
        success: true,
        data: distribution,
        message: 'Level-wise member distribution retrieved successfully'
      });
    } else {
      console.error('Distribution is null or undefined');
      res.status(404).json({
        success: false,
        message: 'User not found or no distribution data available'
      });
    }
  } catch (error) {
    console.error('Level distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get level distribution',
      error: error.message
    });
  }
});

// Get level-wise member details
router.get('/level-details/:level', authenticateToken, async (req, res) => {
  try {
    const { level } = req.params;
    const userId = req.user._id;

    const levelDetails = await MLMService.getLevelWiseMemberDetails(userId, parseInt(level));

    if (levelDetails) {
      res.json({
        success: true,
        data: levelDetails,
        message: `Level ${level} details retrieved successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User not found or no level data available'
      });
    }
  } catch (error) {
    console.error('Level details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get level details',
      error: error.message
    });
  }
});

module.exports = router;