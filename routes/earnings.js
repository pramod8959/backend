const express = require('express');
const Earning = require('../models/Earning');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all earnings for a user
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { user: req.user._id };
    
    if (type) {
      query.type = type;
    }
    
    if (status) {
      query.status = status;
    }
    
    const earnings = await Earning.find(query)
      .populate('fromUser', 'username firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Earning.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        earnings,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Earnings fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get earnings summary
router.get('/summary', auth, async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    
    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }
    
    const query = { 
      user: req.user._id, 
      status: 'confirmed',
      ...dateFilter 
    };
    
    const earnings = await Earning.find(query);
    
    const summary = {
      totalAmount: earnings.reduce((sum, earning) => sum + earning.amount, 0),
      totalCount: earnings.length,
      byType: {},
      byLevel: {},
      byStatus: {}
    };
    
    // Group by type
    earnings.forEach(earning => {
      summary.byType[earning.type] = (summary.byType[earning.type] || 0) + earning.amount;
    });
    
    // Group by level
    earnings.forEach(earning => {
      summary.byLevel[earning.level] = (summary.byLevel[earning.level] || 0) + earning.amount;
    });
    
    // Group by status
    earnings.forEach(earning => {
      summary.byStatus[earning.status] = (summary.byStatus[earning.status] || 0) + earning.amount;
    });
    
    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Earnings summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get earnings by level
router.get('/by-level', auth, async (req, res) => {
  try {
    const earnings = await Earning.find({ 
      user: req.user._id, 
      status: 'confirmed' 
    });
    
    const levelEarnings = {};
    
    earnings.forEach(earning => {
      if (!levelEarnings[earning.level]) {
        levelEarnings[earning.level] = {
          level: earning.level,
          amount: 0,
          count: 0,
          commissionRate: earning.commissionRate
        };
      }
      levelEarnings[earning.level].amount += earning.amount;
      levelEarnings[earning.level].count += 1;
    });
    
    const result = Object.values(levelEarnings).sort((a, b) => a.level - b.level);
    
    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Earnings by level error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
