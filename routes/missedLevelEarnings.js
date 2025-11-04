const express = require('express');
const router = express.Router();
const MLMService = require('../services/mlmService');
const { auth, adminAuth } = require('../middleware/auth');

// @route   GET /api/missed-level-earnings
// @desc    Get user's missed level earnings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const missedEarnings = await MLMService.getMissedLevelEarnings(req.user._id);
    
    res.json({
      success: true,
      data: {
        missedEarnings,
        totalAmount: missedEarnings.reduce((sum, earning) => sum + earning.amount, 0),
        totalCount: missedEarnings.length
      }
    });
  } catch (error) {
    console.error('Error getting missed level earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting missed level earnings',
      error: error.message
    });
  }
});

// @route   POST /api/missed-level-earnings/process
// @desc    Process missed level earnings for current user
// @access  Private
router.post('/process', auth, async (req, res) => {
  try {
    const missedEarnings = await MLMService.checkAndCreateMissedLevelEarnings(req.user._id);
    
    res.json({
      success: true,
      message: `Processed ${missedEarnings.length} missed level earnings`,
      data: {
        missedEarnings,
        totalAmount: missedEarnings.reduce((sum, earning) => sum + earning.amount, 0)
      }
    });
  } catch (error) {
    console.error('Error processing missed level earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing missed level earnings',
      error: error.message
    });
  }
});

// @route   POST /api/missed-level-earnings/allocate/:level
// @desc    Allocate missed level earnings for a specific level
// @access  Private
router.post('/allocate/:level', auth, async (req, res) => {
  try {
    const { level } = req.params;
    const levelNum = parseInt(level);
    
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid level. Must be between 1 and 15'
      });
    }
    
    const allocatedEarnings = await MLMService.allocateMissedLevelEarnings(req.user._id, levelNum);
    
    res.json({
      success: true,
      message: `Allocated ${allocatedEarnings.length} missed level earnings for level ${levelNum}`,
      data: {
        allocatedEarnings,
        totalAmount: allocatedEarnings.reduce((sum, earning) => sum + earning.amount, 0)
      }
    });
  } catch (error) {
    console.error('Error allocating missed level earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error allocating missed level earnings',
      error: error.message
    });
  }
});

// @route   POST /api/missed-level-earnings/check-completion/:level
// @desc    Check level completion and transfer missed earnings
// @access  Private
router.post('/check-completion/:level', auth, async (req, res) => {
  try {
    const { level } = req.params;
    const levelNum = parseInt(level);
    
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 15) {
      return res.status(400).json({
        success: false,
        message: 'Invalid level. Must be between 1 and 15'
      });
    }
    
    await MLMService.checkLevelCompletionAndTransfer(req.user._id, levelNum);
    
    res.json({
      success: true,
      message: `Checked level ${levelNum} completion and transferred eligible missed earnings`
    });
  } catch (error) {
    console.error('Error checking level completion:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking level completion',
      error: error.message
    });
  }
});

// ==================== ADMIN ROUTES ====================

// @route   GET /api/missed-level-earnings/admin/summary
// @desc    Get missed level earnings summary for admin
// @access  Private (Admin)
router.get('/admin/summary', adminAuth, async (req, res) => {
  try {
    const summary = await MLMService.getMissedLevelEarningsSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error getting missed level earnings summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting missed level earnings summary',
      error: error.message
    });
  }
});

// @route   POST /api/missed-level-earnings/admin/process-all
// @desc    Process missed level earnings for all users
// @access  Private (Admin)
router.post('/admin/process-all', adminAuth, async (req, res) => {
  try {
    const results = await MLMService.processMissedLevelEarnings();
    
    res.json({
      success: true,
      message: `Processed missed level earnings for ${results.length} users`,
      data: {
        results,
        totalProcessed: results.reduce((sum, result) => sum + result.missedEarnings, 0)
      }
    });
  } catch (error) {
    console.error('Error processing all missed level earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing all missed level earnings',
      error: error.message
    });
  }
});

// @route   GET /api/missed-level-earnings/admin/user/:userId
// @desc    Get missed level earnings for a specific user
// @access  Private (Admin)
router.get('/admin/user/:userId', adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const missedEarnings = await MLMService.getMissedLevelEarnings(userId);
    
    res.json({
      success: true,
      data: {
        userId,
        missedEarnings,
        totalAmount: missedEarnings.reduce((sum, earning) => sum + earning.amount, 0),
        totalCount: missedEarnings.length
      }
    });
  } catch (error) {
    console.error('Error getting user missed level earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user missed level earnings',
      error: error.message
    });
  }
});

module.exports = router;
