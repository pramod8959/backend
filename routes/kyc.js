const express = require('express');
const router = express.Router();
const KYC = require('../models/KYC');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Submit KYC information
router.post('/submit', auth, async (req, res) => {
  try {
    const { email, mobileNumber, fullName } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!email || !mobileNumber || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, mobile number, and full name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate mobile number format (basic validation)
    const mobileRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number'
      });
    }

    // Check if user already has a KYC submission
    const existingKYC = await KYC.findOne({ user: userId });
    
    if (existingKYC) {
      if (existingKYC.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'KYC submission is already pending approval'
        });
      } else if (existingKYC.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'KYC is already approved'
        });
      }
    }

    // Create new KYC submission
    const kycData = {
      user: userId,
      email: email.toLowerCase().trim(),
      mobileNumber: mobileNumber.trim(),
      fullName: fullName.trim()
    };

    const kyc = new KYC(kycData);
    await kyc.save();

    res.json({
      success: true,
      message: 'KYC information submitted successfully',
      data: {
        id: kyc._id,
        status: kyc.status,
        submittedAt: kyc.submittedAt
      }
    });

  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's KYC status - OPTIMIZED VERSION
router.get('/status', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Optimized query with proper indexing
    const kyc = await KYC.findOne({ user: userId })
      .select('status submittedAt reviewedAt rejectionReason adminNotes')
      .sort({ submittedAt: -1 })
      .lean() // Use lean() for faster query execution
      .limit(1); // Limit to 1 result for better performance

    if (!kyc) {
      return res.json({
        success: true,
        data: {
          status: 'not_submitted',
          message: 'KYC not submitted yet'
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: kyc.status,
        submittedAt: kyc.submittedAt,
        reviewedAt: kyc.reviewedAt,
        rejectionReason: kyc.rejectionReason,
        adminNotes: kyc.adminNotes
      }
    });

  } catch (error) {
    console.error('KYC status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user's KYC details (for editing)
router.get('/details', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const kyc = await KYC.findOne({ user: userId })
      .select('email mobileNumber fullName status submittedAt')
      .sort({ submittedAt: -1 });

    if (!kyc) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        email: kyc.email,
        mobileNumber: kyc.mobileNumber,
        fullName: kyc.fullName,
        status: kyc.status,
        submittedAt: kyc.submittedAt
      }
    });

  } catch (error) {
    console.error('KYC details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update KYC information (if rejected)
router.post('/update', auth, async (req, res) => {
  try {
    const { email, mobileNumber, fullName } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!email || !mobileNumber || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Email, mobile number, and full name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate mobile number format
    const mobileRegex = /^[0-9+\-\s()]{10,15}$/;
    if (!mobileRegex.test(mobileNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number'
      });
    }

    // Find existing KYC
    const existingKYC = await KYC.findOne({ user: userId });
    
    if (!existingKYC) {
      return res.status(404).json({
        success: false,
        message: 'No KYC submission found'
      });
    }

    if (existingKYC.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update approved KYC'
      });
    }

    // Update KYC information
    existingKYC.email = email.toLowerCase().trim();
    existingKYC.mobileNumber = mobileNumber.trim();
    existingKYC.fullName = fullName.trim();
    existingKYC.status = 'pending';
    existingKYC.submittedAt = new Date();
    existingKYC.reviewedAt = null;
    existingKYC.rejectionReason = null;
    existingKYC.adminNotes = null;

    await existingKYC.save();

    res.json({
      success: true,
      message: 'KYC information updated successfully',
      data: {
        id: existingKYC._id,
        status: existingKYC.status,
        submittedAt: existingKYC.submittedAt
      }
    });

  } catch (error) {
    console.error('KYC update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin routes
// Get all KYC submissions (admin only)
router.get('/admin/all', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || 'all';
    const skip = (page - 1) * limit;

    let query = {};
    if (status !== 'all') {
      query.status = status;
    }

    const kycs = await KYC.find(query)
      .populate('user', 'userId walletAddress')
      .populate('reviewedBy', 'userId')
      .select('-__v')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await KYC.countDocuments(query);

    res.json({
      success: true,
      data: {
        kycs,
        pagination: {
          current: page,
          total: total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin KYC list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Approve KYC (admin only)
router.put('/admin/approve/:kycId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { kycId } = req.params;
    const { adminNotes } = req.body;

    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC submission not found'
      });
    }

    kyc.status = 'approved';
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = req.user._id;
    kyc.adminNotes = adminNotes || '';
    kyc.rejectionReason = null;

    await kyc.save();

    res.json({
      success: true,
      message: 'KYC approved successfully',
      data: {
        id: kyc._id,
        status: kyc.status,
        reviewedAt: kyc.reviewedAt
      }
    });

  } catch (error) {
    console.error('KYC approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Reject KYC (admin only)
router.put('/admin/reject/:kycId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const { kycId } = req.params;
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const kyc = await KYC.findById(kycId);
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: 'KYC submission not found'
      });
    }

    kyc.status = 'rejected';
    kyc.reviewedAt = new Date();
    kyc.reviewedBy = req.user._id;
    kyc.rejectionReason = rejectionReason;
    kyc.adminNotes = adminNotes || '';

    await kyc.save();

    res.json({
      success: true,
      message: 'KYC rejected successfully',
      data: {
        id: kyc._id,
        status: kyc.status,
        reviewedAt: kyc.reviewedAt,
        rejectionReason: kyc.rejectionReason
      }
    });

  } catch (error) {
    console.error('KYC rejection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get KYC statistics (admin only)
router.get('/admin/stats', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    const total = await KYC.countDocuments();
    const pending = await KYC.countDocuments({ status: 'pending' });
    const approved = await KYC.countDocuments({ status: 'approved' });
    const rejected = await KYC.countDocuments({ status: 'rejected' });

    // Get recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentSubmissions = await KYC.countDocuments({
      submittedAt: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        recentSubmissions
      }
    });

  } catch (error) {
    console.error('KYC stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
