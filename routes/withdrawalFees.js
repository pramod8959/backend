const express = require('express');
const { body, validationResult } = require('express-validator');
const WithdrawalFee = require('../models/WithdrawalFee');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get current withdrawal fee configuration
router.get('/', adminAuth, async (req, res) => {
  try {
    let feeConfig = await WithdrawalFee.findOne({ isActive: true });
    
    // If no fee config exists, create a default one
    if (!feeConfig) {
      feeConfig = new WithdrawalFee({
        feePercentage: 5,
        isActive: true,
        description: 'Default withdrawal processing fee',
        createdBy: req.user._id
      });
      await feeConfig.save();
    }
    
    res.json({
      success: true,
      data: feeConfig
    });

  } catch (error) {
    console.error('Get withdrawal fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update withdrawal fee configuration
router.put('/', adminAuth, [
  body('feePercentage').isFloat({ min: 0, max: 100 }).withMessage('Fee percentage must be between 0 and 100'),
  body('description').optional().isString().withMessage('Description must be a string')
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

    const { feePercentage, description } = req.body;
    
    // Deactivate current active fee config
    await WithdrawalFee.updateMany(
      { isActive: true },
      { isActive: false }
    );
    
    // Create new fee configuration
    const newFeeConfig = new WithdrawalFee({
      feePercentage,
      description: description || 'Withdrawal processing fee',
      isActive: true,
      createdBy: req.user._id
    });
    
    await newFeeConfig.save();
    
    res.json({
      success: true,
      message: 'Withdrawal fee updated successfully',
      data: newFeeConfig
    });

  } catch (error) {
    console.error('Update withdrawal fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get withdrawal fee history
router.get('/history', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const fees = await WithdrawalFee.find()
      .populate('createdBy', 'username firstName lastName')
      .populate('updatedBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await WithdrawalFee.countDocuments();
    
    res.json({
      success: true,
      data: {
        fees,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get withdrawal fee history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Calculate withdrawal fee for a given amount
router.post('/calculate', adminAuth, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
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

    const { amount } = req.body;
    
    let feeConfig = await WithdrawalFee.findOne({ isActive: true });
    
    // If no fee config exists, use default 5%
    if (!feeConfig) {
      feeConfig = { feePercentage: 5 };
    }
    
    const feeAmount = (amount * feeConfig.feePercentage) / 100;
    const netAmount = amount - feeAmount;
    
    res.json({
      success: true,
      data: {
        originalAmount: amount,
        feePercentage: feeConfig.feePercentage,
        feeAmount: parseFloat(feeAmount.toFixed(2)),
        netAmount: parseFloat(netAmount.toFixed(2))
      }
    });

  } catch (error) {
    console.error('Calculate withdrawal fee error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
