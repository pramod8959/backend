const express = require('express');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');
const { adminAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const router = express.Router();

// Get admin dashboard statistics
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    // Get admin user info for referral code
    const adminUser = await User.findOne({ isAdmin: true }).select('referralCode walletAddress');
    
    const totalUsers = await User.countDocuments({ isAdmin: false });
    const activeUsers = await User.countDocuments({ isActive: true, isAdmin: false });
    
    const totalEarnings = await Earning.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Get creator fee earnings
    const creatorFeeEarnings = await Earning.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] }, type: 'creator_fee' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Get promotional bonus earnings
    const promotionalBonusEarnings = await Earning.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] }, type: 'promotional_bonus' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    
    // Get total USDT from registrations
    const totalUSDTFromRegistrations = await User.aggregate([
      { $match: { isAdmin: false } },
      { $group: { _id: null, total: { $sum: '$registrationFee' } } }
    ]);
    
    const totalWithdrawals = await Withdrawal.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const pendingWithdrawals = await Withdrawal.countDocuments({ 
      status: { $in: ['pending', 'processing'] } 
    });
    
    // Get top 15 earners
    const topEarners = await User.find({ isAdmin: false })
      .sort({ totalEarnings: -1 })
      .limit(15)
      .select('firstName lastName username userId walletAddress totalEarnings');
    
    // Calculate monthly growth
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date(currentMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const currentMonthUsers = await User.countDocuments({ 
      createdAt: { $gte: currentMonth },
      isAdmin: false 
    });
    
    const lastMonthUsers = await User.countDocuments({ 
      createdAt: { $gte: lastMonth, $lt: currentMonth },
      isAdmin: false 
    });
    
    const monthlyGrowth = lastMonthUsers > 0 
      ? Math.round(((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100)
      : currentMonthUsers > 0 ? 100 : 0;
    
    const recentUsers = await User.find({ isAdmin: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('firstName lastName username email createdAt totalEarnings walletAddress');
    
    const recentWithdrawals = await Withdrawal.find()
      .populate('user', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalEarnings: totalEarnings[0]?.total || 0,
        totalWithdrawn: totalWithdrawals[0]?.total || 0,
        pendingWithdrawals,
        monthlyGrowth,
        // New admin-specific earnings
        creatorFeeEarnings: creatorFeeEarnings[0]?.total || 0,
        promotionalBonusEarnings: promotionalBonusEarnings[0]?.total || 0,
        totalUSDTFromRegistrations: totalUSDTFromRegistrations[0]?.total || 0,
        // Calculate total admin earnings
        totalAdminEarnings: (creatorFeeEarnings[0]?.total || 0) + 
                           (promotionalBonusEarnings[0]?.total || 0),
        // Admin referral information
        adminReferral: {
          referralCode: adminUser?.referralCode || '',
          referralUrl: adminUser?.referralCode ? `https://sbw-ten.vercel.app/auth/register?ref=${adminUser.referralCode}` : '',
          walletAddress: adminUser?.walletAddress || ''
        },
        topEarners: topEarners.map(user => {
          // Return name if available, otherwise return wallet address
          const displayName = (user.firstName && user.lastName) 
            ? `${user.firstName} ${user.lastName}` 
            : (user.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'Unknown User');
          
          return {
            id: user._id,
            name: displayName,
            earnings: user.totalEarnings,
            userId: user.userId,
            walletAddress: user.walletAddress,
            firstName: user.firstName,
            lastName: user.lastName
          };
        }),
        recentUsers: recentUsers.map(user => {
          // Return name if available, otherwise return wallet address
          const displayName = (user.firstName && user.lastName) 
            ? `${user.firstName} ${user.lastName}` 
            : (user.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'Unknown User');
          
          return {
            ...user.toObject(),
            displayName: displayName
          };
        }),
        recentWithdrawals
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const users = await User.find(query)
      .populate('sponsor', 'username referralCode')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all users with detailed information for admin
router.get('/users/all', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { isAdmin: false };
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { walletAddress: { $regex: search, $options: 'i' } },
        { referralCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const users = await User.find(query)
      .populate('sponsor', 'username referralCode firstName lastName walletAddress')
      .select('-password')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    // Get additional statistics
    const stats = {
      totalUsers: await User.countDocuments({ isAdmin: false }),
      activeUsers: await User.countDocuments({ isAdmin: false, isActive: true }),
      usersWithWallet: await User.countDocuments({ isAdmin: false, walletAddress: { $exists: true, $ne: null } }),
      usersWithoutWallet: await User.countDocuments({ isAdmin: false, walletAddress: { $exists: false } })
    };
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        stats
      }
    });

  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user status
router.put('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User status updated successfully',
      data: user
    });

  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user details
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id)
      .populate('sponsor', 'username referralCode firstName lastName')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's team tree
    const teamTree = await user.getTeamTree(1, 15);
    
    // Get user's earnings
    const earnings = await Earning.find({ user: id })
      .populate('fromUser', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(20);
    
    // Get user's withdrawals
    const withdrawals = await Withdrawal.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({
      success: true,
      data: {
        user,
        teamTree,
        earnings,
        withdrawals
      }
    });

  } catch (error) {
    console.error('User details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get earnings report
router.get('/earnings/report', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, level } = req.query;
    
    let matchQuery = { status: 'confirmed' };
    
    if (startDate && endDate) {
      matchQuery.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (level) {
      matchQuery.level = parseInt(level);
    }
    
    const earnings = await Earning.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            level: '$level',
            paymentMethod: '$paymentMethod'
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.level': 1 } }
    ]);
    
    const totalEarnings = await Earning.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        earnings,
        totalAmount: totalEarnings[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Earnings report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get admin earnings breakdown
router.get('/earnings', adminAuth, async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }
    
    // Get admin user
    const admin = await User.findOne({ isAdmin: true });
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    const query = { 
      user: admin._id, 
      status: { $in: ['confirmed', 'completed'] },
      ...dateFilter 
    };
    
    const earnings = await Earning.find(query)
      .populate('fromUser', 'username firstName lastName')
      .sort({ createdAt: -1 });
    
    // Group earnings by type
    const earningsByType = {
      creator_fee: 0,
      promotional_bonus: 0,
      missed_wallet: 0,
      total: 0
    };
    
    earnings.forEach(earning => {
      earningsByType[earning.type] = (earningsByType[earning.type] || 0) + earning.amount;
      earningsByType.total += earning.amount;
    });
    
    // Get total USDT from registrations
    const totalUSDTFromRegistrations = await User.aggregate([
      { $match: { isAdmin: false, ...dateFilter } },
      { $group: { _id: null, total: { $sum: '$registrationFee' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        earningsByType,
        totalUSDTFromRegistrations: totalUSDTFromRegistrations[0]?.total || 0,
        recentEarnings: earnings.slice(0, 20).map(earning => ({
          amount: earning.amount,
          type: earning.type,
          description: earning.description,
          fromUser: earning.fromUser,
          date: earning.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Admin earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get system statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }
    
    const newUsers = await User.countDocuments(dateFilter);
    const newEarnings = await Earning.aggregate([
      { $match: { ...dateFilter, status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const newWithdrawals = await Withdrawal.aggregate([
      { $match: { ...dateFilter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        period,
        newUsers,
        newEarnings: newEarnings[0]?.total || 0,
        newWithdrawals: newWithdrawals[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update user wallet address
router.put('/users/:id/wallet', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    // Check if wallet address is already in use by another user
    const existingUser = await User.findOne({ 
      walletAddress: walletAddress.toLowerCase(),
      _id: { $ne: id }
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is already in use by another user'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { 
        walletAddress: walletAddress.toLowerCase(),
        referralCode: walletAddress.toLowerCase() // Update referral code to match wallet address
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User wallet address updated successfully',
      data: user
    });

  } catch (error) {
    console.error('User wallet update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Upload user profile photo
router.put('/users/:id/photo', adminAuth, upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { 
        photo: {
          public_id: req.file.public_id,
          url: req.file.url,
          secure_url: req.file.secure_url
        }
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User profile photo updated successfully',
      data: user
    });

  } catch (error) {
    console.error('User photo update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get admin tree view
router.get('/tree', adminAuth, async (req, res) => {
  try {
    const { maxLevel = 5 } = req.query;
    
    // Get admin user
    const adminUser = await User.findOne({ isAdmin: true });
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Get all users with their sponsor information
    const users = await User.find({ isAdmin: false })
      .populate('sponsor', 'username firstName lastName isAdmin')
      .select('userId username firstName lastName email totalEarnings totalWithdrawn isActive level position sponsor leftChild rightChild createdAt referralCode walletAddress')
      .sort({ createdAt: 1 });
    
    // Build tree structure starting from admin
    const buildTree = (parentId, level = 1, maxLevel = 5) => {
      if (level > maxLevel) return [];
      
      const directReferrals = users.filter(user => {
        // Check if user has sponsor and it matches the parentId
        const hasSponsor = user.sponsor && user.sponsor._id.toString() === parentId.toString();
        
        // Also check sponsorCode as fallback
        const hasSponsorCode = user.sponsorCode && user.sponsorCode === adminUser.referralCode;
        
        return hasSponsor || hasSponsorCode;
      });
      
      return directReferrals.map(user => {
        // Calculate user's actual level in the tree
        const calculateUserLevel = (userId) => {
          let userLevel = 0;
          let currentUserId = userId;
          
          while (currentUserId) {
            const currentUser = users.find(u => u._id.toString() === currentUserId.toString());
            if (!currentUser || !currentUser.sponsor) break;
            
            currentUserId = currentUser.sponsor._id;
            userLevel++;
          }
          
          return userLevel;
        };
        
        return {
          _id: user._id,
          userId: user.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          referralCode: user.referralCode,
          walletAddress: user.walletAddress,
          totalEarnings: user.totalEarnings,
          totalWithdrawn: user.totalWithdrawn,
          isActive: user.isActive,
          level: calculateUserLevel(user._id), // Use actual level in tree
          position: user.position,
          registrationDate: user.createdAt,
          children: buildTree(user._id, level + 1, maxLevel)
        };
      });
    };
    
    // Start building tree from admin user
    const treeData = buildTree(adminUser._id, 1, parseInt(maxLevel));
    
    // Get admin stats
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.isActive).length;
    const totalEarnings = users.reduce((sum, user) => sum + user.totalEarnings, 0);
    const totalWithdrawn = users.reduce((sum, user) => sum + (user.totalWithdrawn || 0), 0);
    
    res.json({
      success: true,
      data: {
        tree: treeData,
        adminInfo: {
          _id: adminUser._id,
          userId: adminUser.userId,
          username: adminUser.username,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          referralCode: adminUser.referralCode,
          walletAddress: adminUser.walletAddress,
          totalEarnings: adminUser.totalEarnings,
          totalWithdrawn: adminUser.totalWithdrawn,
          isActive: adminUser.isActive,
          level: 0,
          position: 'root',
          registrationDate: adminUser.createdAt
        },
        stats: {
          totalUsers,
          activeUsers,
          totalEarnings,
          totalWithdrawn,
          maxLevel: parseInt(maxLevel)
        }
      }
    });

  } catch (error) {
    console.error('Admin tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get missed wallet processing status
router.get('/missed-wallet-status', adminAuth, async (req, res) => {
  try {
    const AutoMissedWalletProcessor = require('../services/autoMissedWalletProcessor');
    const status = AutoMissedWalletProcessor.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Missed wallet status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Manually trigger missed wallet processing
router.post('/trigger-missed-wallet', adminAuth, async (req, res) => {
  try {
    const AutoMissedWalletProcessor = require('../services/autoMissedWalletProcessor');
    await AutoMissedWalletProcessor.triggerProcessing();
    
    res.json({
      success: true,
      message: 'Missed wallet processing triggered successfully'
    });
  } catch (error) {
    console.error('Trigger missed wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get missed wallet statistics
router.get('/missed-wallet-stats', adminAuth, async (req, res) => {
  try {
    const totalMissedWallet = await Earning.countDocuments({ type: 'missed_wallet' });
    const totalMissedAmount = await Earning.aggregate([
      { $match: { type: 'missed_wallet' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const recentMissedWallet = await Earning.find({ type: 'missed_wallet' })
      .populate('user', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: {
        totalMissedWallet,
        totalMissedAmount: totalMissedAmount[0]?.total || 0,
        recentMissedWallet
      }
    });
  } catch (error) {
    console.error('Missed wallet stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get admin direct tree (only direct referrals)
router.get('/direct-tree', adminAuth, async (req, res) => {
  try {
    // Get admin user
    const adminUser = await User.findOne({ isAdmin: true });
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Get only direct referrals of admin (users who joined directly with admin's referral code)
    // Use case-insensitive comparison for sponsorCode and also check sponsor field
    const directReferrals = await User.find({ 
      isAdmin: false,
      $or: [
        { sponsorCode: { $regex: new RegExp(`^${adminUser.referralCode}$`, 'i') } },
        { sponsor: adminUser._id }
      ]
    })
    .select('userId username firstName lastName email totalEarnings totalWithdrawn isActive level position createdAt referralCode walletAddress sponsorCode sponsor')
    .sort({ createdAt: 1 });
    
    res.json({
      success: true,
      data: {
        adminInfo: {
          _id: adminUser._id,
          userId: adminUser.userId,
          username: adminUser.username,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          referralCode: adminUser.referralCode,
          walletAddress: adminUser.walletAddress,
          totalEarnings: adminUser.totalEarnings,
          totalWithdrawn: adminUser.totalWithdrawn,
          isActive: adminUser.isActive,
          level: 0,
          position: 'root',
          registrationDate: adminUser.createdAt
        },
        tree: directReferrals.map(user => ({
          _id: user._id,
          userId: user.userId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          referralCode: user.referralCode,
          walletAddress: user.walletAddress,
          totalEarnings: user.totalEarnings,
          totalWithdrawn: user.totalWithdrawn,
          isActive: user.isActive,
          level: 1, // All direct referrals are level 1
          position: user.position,
          registrationDate: user.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Admin direct tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
