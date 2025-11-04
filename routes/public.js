const express = require('express');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Withdrawal = require('../models/Withdrawal');

const router = express.Router();

// Get public statistics for landing page
router.get('/stats', async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.countDocuments({ isAdmin: false });
    
    // Get active users count
    const activeUsers = await User.countDocuments({ isActive: true, isAdmin: false });
    
    // Get total earnings from all users
    const totalEarningsResult = await Earning.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalEarnings = totalEarningsResult[0]?.total || 0;
    
    // Get total withdrawn amount
    const totalWithdrawnResult = await Withdrawal.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawn = totalWithdrawnResult[0]?.total || 0;
    
    // Get monthly earnings (current month)
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const monthlyEarningsResult = await Earning.aggregate([
      { 
        $match: { 
          status: { $in: ['confirmed', 'completed'] },
          createdAt: { $gte: currentMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlyEarnings = monthlyEarningsResult[0]?.total || 0;
    
    // Get top earners (top 5 users by total earnings)
    const topEarners = await User.find({ isAdmin: false })
      .select('userId walletAddress totalEarnings')
      .sort({ totalEarnings: -1 })
      .limit(5);
    
    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRegistrations = await User.countDocuments({
      isAdmin: false,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    // Get platform statistics
    const platformStats = {
      totalUsers,
      activeUsers,
      totalEarnings,
      totalWithdrawn,
      monthlyEarnings,
      recentRegistrations,
      topEarners: topEarners.map(user => ({
        userId: user.userId,
        walletAddress: user.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'N/A',
        totalEarnings: user.totalEarnings
      })),
      // Additional stats for landing page
      earningLevels: 15,
      registrationFee: 20,
      directReferralBonus: 2,
      levelBonus: 1,
      maxLevels: 15
    };
    
    res.json({
      success: true,
      data: platformStats
    });

  } catch (error) {
    console.error('Public stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get platform features and benefits
router.get('/features', async (req, res) => {
  try {
    const features = {
      registrationFee: 20,
      currency: 'USDT',
      maxLevels: 15,
      directReferralBonus: 2,
      levelBonus: 1,
      withdrawalFee: 5, // 5% service charge
      instantPayouts: true,
      blockchainSecurity: true,
      realTimeDashboard: true,
      socialSharing: true,
      support24x7: true
    };
    
    res.json({
      success: true,
      data: features
    });

  } catch (error) {
    console.error('Features error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get testimonials (placeholder - can be extended with real testimonials)
router.get('/testimonials', async (req, res) => {
  try {
    // Get some top earners as testimonials
    const topEarners = await User.find({ isAdmin: false, totalEarnings: { $gt: 0 } })
      .select('userId walletAddress totalEarnings')
      .sort({ totalEarnings: -1 })
      .limit(3);
    
    const testimonials = topEarners.map((user, index) => ({
      id: user._id,
      userId: user.userId,
      walletAddress: user.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : 'N/A',
      earnings: user.totalEarnings,
      testimonial: `Earned $${user.totalEarnings.toFixed(2)} USDT through our platform! The 15-level system really works.`,
      rating: 5,
      verified: true
    }));
    
    // Add some default testimonials if we don't have enough real ones
    const defaultTestimonials = [
      {
        id: 'default1',
        userId: 'SBW0001',
        walletAddress: '0x1234...5678',
        earnings: 1250,
        testimonial: 'Amazing platform! Started with just $20 USDT and now earning daily. The blockchain security gives me peace of mind.',
        rating: 5,
        verified: true
      },
      {
        id: 'default2',
        userId: 'SBW0002',
        walletAddress: '0x9876...5432',
        earnings: 890,
        testimonial: 'The 15-level earning system is incredible. My team keeps growing and so do my earnings!',
        rating: 5,
        verified: true
      },
      {
        id: 'default3',
        userId: 'SBW0003',
        walletAddress: '0xABCD...EFGH',
        earnings: 2100,
        testimonial: 'Building my crypto empire with the 15-level MLM system. The more I refer, the more I earn from every level!',
        rating: 5,
        verified: true
      },
      {
        id: 'default4',
        userId: 'SBW0004',
        walletAddress: '0xEFGH...IJKL',
        earnings: 650,
        testimonial: 'Transparent earnings, instant payouts. This USDT MLM platform changed my financial future!',
        rating: 5,
        verified: true
      },
      {
        id: 'default5',
        userId: 'SBW0005',
        walletAddress: '0xMNOP...QRST',
        earnings: 1800,
        testimonial: 'From $20 to earning thousands! The 15-level system rewards every referral in your network.',
        rating: 5,
        verified: true
      }
    ];
    
    // Combine real and default testimonials
    const allTestimonials = [...testimonials, ...defaultTestimonials].slice(0, 6);
    
    res.json({
      success: true,
      data: allTestimonials
    });

  } catch (error) {
    console.error('Testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
