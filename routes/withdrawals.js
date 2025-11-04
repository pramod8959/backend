const express = require('express');
const { body, validationResult } = require('express-validator');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const WithdrawalFee = require('../models/WithdrawalFee');
const TransactionService = require('../services/transactionService');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Request withdrawal
router.post('/request', auth, [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['BNB', 'USDT']).withMessage('Payment method must be BNB or USDT'),
  body('walletAddress').notEmpty().withMessage('Wallet address is required'),
  body('paymentType').optional().isIn(['auto', 'manual']).withMessage('Payment type must be auto or manual'),
  body('actualReceiveAmount').optional().isFloat({ min: 0 }).withMessage('Actual receive amount must be greater than or equal to 0')
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

    const { amount, paymentMethod, walletAddress, paymentType, actualReceiveAmount } = req.body;
    const user = await User.findById(req.user._id);
    
    // Check if user has sufficient balance
    const availableBalance = user.totalEarnings - user.totalWithdrawn;
    if (amount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Check minimum withdrawal amount
    const minWithdrawal = 10; // $10 minimum
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${minWithdrawal}`
      });
    }
    
    // Check if user has pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({
      user: req.user._id,
      status: { $in: ['pending', 'processing'] }
    });
    
    if (pendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request'
      });
    }
    
    // Get current withdrawal fee configuration
    let feeConfig = await WithdrawalFee.findOne({ isActive: true });
    if (!feeConfig) {
      // Create default fee config if none exists
      feeConfig = new WithdrawalFee({
        feePercentage: 5,
        isActive: true,
        description: 'Default withdrawal processing fee',
        createdBy: req.user._id
      });
      await feeConfig.save();
    }
    
    // Calculate fee and net amount
    const feeAmount = (amount * feeConfig.feePercentage) / 100;
    const netAmount = amount - feeAmount;
    
    // Create withdrawal request
    const withdrawal = new Withdrawal({
      user: req.user._id,
      amount,
      feePercentage: feeConfig.feePercentage,
      feeAmount: parseFloat(feeAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      paymentMethod,
      walletAddress,
      paymentType: paymentType || 'manual', // Default to manual for user requests
      actualReceiveAmount: actualReceiveAmount || parseFloat(netAmount.toFixed(2)),
      status: 'pending'
    });
    
    await withdrawal.save();
    
    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: {
        ...withdrawal.toObject(),
        netAmount: withdrawal.netAmount,
        feeBreakdown: {
          originalAmount: withdrawal.amount,
          feePercentage: withdrawal.feePercentage,
          feeAmount: withdrawal.feeAmount,
          netAmount: withdrawal.netAmount
        }
      }
    });

  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Calculate withdrawal fee for user
router.post('/calculate-fee', auth, [
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
    
    // Get current withdrawal fee configuration
    let feeConfig = await WithdrawalFee.findOne({ isActive: true });
    if (!feeConfig) {
      feeConfig = { feePercentage: 5 }; // Default 5%
    }
    
    // Calculate fee and net amount
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

// Get user's withdrawal history - FIXED VERSION
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { user: req.user._id };
    if (status) {
      query.status = status;
    }
    
    const withdrawals = await Withdrawal.find(query)
      .populate('processedBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean() for better performance
    
    const total = await Withdrawal.countDocuments(query);
    
    // Transform withdrawal data to match frontend expectations
    const transformedWithdrawals = withdrawals.map(withdrawal => ({
      id: withdrawal._id.toString(),
      amount: withdrawal.amount,
      feePercentage: withdrawal.feePercentage,
      feeAmount: withdrawal.feeAmount,
      netAmount: withdrawal.netAmount,
      method: withdrawal.paymentMethod, // Map paymentMethod to method
      status: withdrawal.status,
      requestDate: withdrawal.createdAt.toISOString(), // Map createdAt to requestDate
      processedDate: withdrawal.processedAt ? withdrawal.processedAt.toISOString() : undefined,
      transactionHash: withdrawal.txHash, // Map txHash to transactionHash
      walletAddress: withdrawal.walletAddress, // Add walletAddress field
      adminNotes: withdrawal.adminNotes,
      processedBy: withdrawal.processedBy ? {
        username: withdrawal.processedBy.username,
        name: `${withdrawal.processedBy.firstName || ''} ${withdrawal.processedBy.lastName || ''}`.trim()
      } : null
    }));
    
    res.json({
      success: true,
      data: {
        withdrawals: transformedWithdrawals,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Withdrawal history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get withdrawal summary
router.get('/summary', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const withdrawals = await Withdrawal.find({ user: req.user._id });
    
    const summary = {
      totalWithdrawn: user.totalWithdrawn,
      totalRequests: withdrawals.length,
      pendingAmount: 0,
      completedAmount: 0,
      rejectedAmount: 0,
      byStatus: {}
    };
    
    withdrawals.forEach(withdrawal => {
      summary.byStatus[withdrawal.status] = (summary.byStatus[withdrawal.status] || 0) + withdrawal.amount;
      
      if (withdrawal.status === 'pending' || withdrawal.status === 'processing') {
        summary.pendingAmount += withdrawal.amount;
      } else if (withdrawal.status === 'completed') {
        summary.completedAmount += withdrawal.amount;
      } else if (withdrawal.status === 'rejected') {
        summary.rejectedAmount += withdrawal.amount;
      }
    });
    
    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Withdrawal summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Get all withdrawal requests
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const withdrawals = await Withdrawal.find(query)
      .populate('user', 'username firstName lastName email')
      .populate('processedBy', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Withdrawal.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        withdrawals,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Admin withdrawals error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Update withdrawal status
router.put('/admin/:id/status', adminAuth, [
  body('status').isIn(['pending', 'processing', 'completed', 'rejected']).withMessage('Invalid status'),
  body('adminNotes').optional().isString()
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

    const { id } = req.params;
    const { status, adminNotes, txHash } = req.body;
    
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }
    
    const updateData = {
      status,
      adminNotes,
      processedBy: req.user._id,
      processedAt: new Date()
    };
    
    if (txHash) {
      updateData.txHash = txHash;
    }
    
    // If completed, update user's total withdrawn (deduct the original requested amount)
    if (status === 'completed') {
      await User.findByIdAndUpdate(withdrawal.user, {
        $inc: { totalWithdrawn: withdrawal.amount }
      });

      // Create transaction history record
      try {
        const transactionHash = txHash || `manual_${id}_${Date.now()}`;
        await TransactionService.createTransaction({
          userId: withdrawal.user,
          walletAddress: withdrawal.walletAddress,
          txHash: transactionHash,
          blockNumber: Math.floor(Math.random() * 1000000) + 1000000, // Simulate block number
          blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
          tokenAddress: '0x55d398326f99059ff775485246999027b3197955', // USDT contract address
          contractAddress: '0x55d398326f99059ff775485246999027b3197955',
          network: 'BSC_MAINNET',
          chainId: 56,
          amount: withdrawal.netAmount.toString(),
          amountInWei: (withdrawal.netAmount * Math.pow(10, 18)).toString(),
          tokenSymbol: 'USDT',
          tokenDecimals: 18,
          status: 'confirmed',
          confirmationCount: 12,
          transactionTime: new Date(),
          confirmationTime: new Date(),
          fromAddress: '0x0000000000000000000000000000000000000000', // Admin wallet (placeholder)
          toAddress: withdrawal.walletAddress,
          explorerUrl: 'https://bscscan.com',
          isRegistrationPayment: false
        });
      } catch (txError) {
        console.error(`Error creating transaction history for withdrawal ${id}:`, txError);
        // Don't fail the withdrawal if transaction history creation fails
      }
    }
    
    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'username firstName lastName email');
    
    res.json({
      success: true,
      message: 'Withdrawal status updated successfully',
      data: updatedWithdrawal
    });

  } catch (error) {
    console.error('Withdrawal status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Approve withdrawal with transaction hash
router.put('/admin/:id/approve', adminAuth, [
  body('txHash').notEmpty().withMessage('Transaction hash is required for approval'),
  body('adminNotes').optional().isString()
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

    const { id } = req.params;
    const { txHash, adminNotes } = req.body;
    
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal is not pending'
      });
    }
    
    const updateData = {
      status: 'completed',
      txHash,
      adminNotes,
      processedBy: req.user._id,
      processedAt: new Date()
    };
    
    // Update user's total withdrawn (deduct the original requested amount)
    await User.findByIdAndUpdate(withdrawal.user, {
      $inc: { totalWithdrawn: withdrawal.amount }
    });

    // Create transaction history record
    try {
      await TransactionService.createTransaction({
        userId: withdrawal.user,
        walletAddress: withdrawal.walletAddress,
        txHash: txHash,
        blockNumber: Math.floor(Math.random() * 1000000) + 1000000, // Simulate block number
        blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        tokenAddress: '0x55d398326f99059ff775485246999027b3197955', // USDT contract address
        contractAddress: '0x55d398326f99059ff775485246999027b3197955',
        network: 'BSC_MAINNET',
        chainId: 56,
        amount: withdrawal.netAmount.toString(),
        amountInWei: (withdrawal.netAmount * Math.pow(10, 18)).toString(),
        tokenSymbol: 'USDT',
        tokenDecimals: 18,
        status: 'confirmed',
        confirmationCount: 12,
        transactionTime: new Date(),
        confirmationTime: new Date(),
        fromAddress: '0x0000000000000000000000000000000000000000', // Admin wallet (placeholder)
        toAddress: withdrawal.walletAddress,
        explorerUrl: 'https://bscscan.com',
        isRegistrationPayment: false
      });
    } catch (txError) {
      console.error(`Error creating transaction history for withdrawal ${id}:`, txError);
      // Don't fail the withdrawal if transaction history creation fails
    }
    
    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'username firstName lastName email');
    
    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: updatedWithdrawal
    });

  } catch (error) {
    console.error('Admin withdrawal approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Reject withdrawal with reason
router.put('/admin/:id/reject', adminAuth, [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  body('adminNotes').optional().isString()
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

    const { id } = req.params;
    const { rejectionReason, adminNotes } = req.body;
    
    const withdrawal = await Withdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal is not pending'
      });
    }
    
    const updateData = {
      status: 'rejected',
      rejectionReason,
      adminNotes,
      processedBy: req.user._id,
      processedAt: new Date()
    };
    
    const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'username firstName lastName email');
    
    res.json({
      success: true,
      message: 'Withdrawal rejected successfully',
      data: updatedWithdrawal
    });

  } catch (error) {
    console.error('Admin withdrawal rejection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Bulk auto payment processing
router.post('/admin/bulk-auto-payment', adminAuth, [
  body('withdrawalIds').isArray({ min: 1 }).withMessage('Withdrawal IDs array is required'),
  body('withdrawalIds.*').isMongoId().withMessage('Invalid withdrawal ID format'),
  body('adminNotes').optional().isString(),
  body('transferTxHashes').optional().isObject().withMessage('Transfer transaction hashes must be an object')
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

    const { withdrawalIds, adminNotes, transferTxHashes } = req.body;
    
    // Get all pending withdrawals (regardless of paymentType for auto processing)
    const withdrawals = await Withdrawal.find({
      _id: { $in: withdrawalIds },
      status: 'pending'
    }).populate('user', 'username firstName lastName email walletAddress');

    if (withdrawals.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No pending withdrawals found for processing'
      });
    }

    const results = [];
    const processingErrors = [];

    for (const withdrawal of withdrawals) {
      try {
        // Use actual transaction hash from frontend or generate one if not provided
        const transferTxHash = transferTxHashes && transferTxHashes[withdrawal._id.toString()] 
          ? transferTxHashes[withdrawal._id.toString()]
          : `0x${Math.random().toString(16).substr(2, 64)}`;
        
        // Update withdrawal status
        const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
          withdrawal._id,
          {
            status: 'completed',
            transferTxHash,
            adminNotes,
            processedBy: req.user._id,
            processedAt: new Date()
          },
          { new: true }
        );

        // Update user's total withdrawn (deduct the original requested amount)
        await User.findByIdAndUpdate(withdrawal.user._id, {
          $inc: { totalWithdrawn: withdrawal.amount }
        });

        // Create transaction history record
        try {
          await TransactionService.createTransaction({
            userId: withdrawal.user._id,
            walletAddress: withdrawal.walletAddress,
            txHash: transferTxHash,
            blockNumber: Math.floor(Math.random() * 1000000) + 1000000, // Simulate block number
            blockHash: `0x${Math.random().toString(16).substr(2, 64)}`,
            tokenAddress: '0x55d398326f99059ff775485246999027b3197955', // USDT contract address
            contractAddress: '0x55d398326f99059ff775485246999027b3197955',
            network: 'BSC_MAINNET',
            chainId: 56,
            amount: (withdrawal.actualReceiveAmount || withdrawal.netAmount).toString(),
            amountInWei: ((withdrawal.actualReceiveAmount || withdrawal.netAmount) * Math.pow(10, 18)).toString(),
            tokenSymbol: 'USDT',
            tokenDecimals: 18,
            status: 'confirmed',
            confirmationCount: 12,
            transactionTime: new Date(),
            confirmationTime: new Date(),
            fromAddress: '0x0000000000000000000000000000000000000000', // Admin wallet (placeholder)
            toAddress: withdrawal.walletAddress,
            explorerUrl: 'https://bscscan.com',
            isRegistrationPayment: false
          });
        } catch (txError) {
          console.error(`Error creating transaction history for withdrawal ${withdrawal._id}:`, txError);
          // Don't fail the withdrawal if transaction history creation fails
        }

        results.push({
          withdrawalId: withdrawal._id,
          status: 'success',
          transferTxHash,
          actualReceiveAmount: withdrawal.actualReceiveAmount || withdrawal.netAmount
        });
      } catch (error) {
        console.error(`Error processing withdrawal ${withdrawal._id}:`, error);
        processingErrors.push({
          withdrawalId: withdrawal._id,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} withdrawals successfully`,
      data: {
        successful: results,
        failed: processingErrors,
        totalProcessed: results.length,
        totalFailed: processingErrors.length
      }
    });

  } catch (error) {
    console.error('Bulk auto payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin: Bulk manual payment processing
router.post('/admin/bulk-manual-payment', adminAuth, [
  body('withdrawalIds').isArray({ min: 1 }).withMessage('Withdrawal IDs array is required'),
  body('withdrawalIds.*').isMongoId().withMessage('Invalid withdrawal ID format'),
  body('adminNotes').optional().isString()
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

    const { withdrawalIds, adminNotes } = req.body;
    
    // Get all pending withdrawals (regardless of paymentType for manual processing)
    const withdrawals = await Withdrawal.find({
      _id: { $in: withdrawalIds },
      status: 'pending'
    }).populate('user', 'username firstName lastName email walletAddress');

    if (withdrawals.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No pending withdrawals found for processing'
      });
    }

    const results = [];
    const processingErrors = [];

    for (const withdrawal of withdrawals) {
      try {
        // Update withdrawal status (no actual transfer)
        const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
          withdrawal._id,
          {
            status: 'completed',
            adminNotes,
            processedBy: req.user._id,
            processedAt: new Date()
          },
          { new: true }
        );

        // Update user's total withdrawn (deduct the original requested amount)
        await User.findByIdAndUpdate(withdrawal.user._id, {
          $inc: { totalWithdrawn: withdrawal.amount }
        });

        // Create transaction history record for manual payment
        try {
          const manualTxHash = `manual_${withdrawal._id}_${Date.now()}`;
          await TransactionService.createTransaction({
            userId: withdrawal.user._id,
            walletAddress: withdrawal.walletAddress,
            txHash: manualTxHash,
            blockNumber: 0, // Manual payment
            blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            tokenAddress: '0x55d398326f99059ff775485246999027b3197955', // USDT contract address
            contractAddress: '0x55d398326f99059ff775485246999027b3197955',
            network: 'BSC_MAINNET',
            chainId: 56,
            amount: (withdrawal.actualReceiveAmount || withdrawal.netAmount).toString(),
            amountInWei: ((withdrawal.actualReceiveAmount || withdrawal.netAmount) * Math.pow(10, 18)).toString(),
            tokenSymbol: 'USDT',
            tokenDecimals: 18,
            status: 'confirmed',
            confirmationCount: 0, // Manual payment
            transactionTime: new Date(),
            confirmationTime: new Date(),
            fromAddress: '0x0000000000000000000000000000000000000000', // Admin wallet (placeholder)
            toAddress: withdrawal.walletAddress,
            explorerUrl: 'https://bscscan.com',
            isRegistrationPayment: false
          });
        } catch (txError) {
          console.error(`Error creating transaction history for withdrawal ${withdrawal._id}:`, txError);
          // Don't fail the withdrawal if transaction history creation fails
        }

        results.push({
          withdrawalId: withdrawal._id,
          status: 'success',
          actualReceiveAmount: withdrawal.actualReceiveAmount || withdrawal.netAmount
        });
      } catch (error) {
        console.error(`Error processing withdrawal ${withdrawal._id}:`, error);
        processingErrors.push({
          withdrawalId: withdrawal._id,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} withdrawals successfully`,
      data: {
        successful: results,
        failed: processingErrors,
        totalProcessed: results.length,
        totalFailed: processingErrors.length
      }
    });

  } catch (error) {
    console.error('Bulk manual payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
