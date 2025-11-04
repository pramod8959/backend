const express = require('express');
const User = require('../models/User');
const Earning = require('../models/Earning');
const MLMService = require('../services/mlmService');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Utility function to validate and fix direct referrals
const validateDirectReferrals = async (userId) => {
  try {
    
    // Get sponsor's referral code for validation
    const sponsor = await User.findById(userId).select('referralCode userId');
    if (!sponsor) {
      return {
        claimedCount: 0,
        actualCount: 0,
        validatedCount: 0,
        validatedReferrals: []
      };
    }

    // Method 1: Get users who have this user as sponsor
    const claimedReferrals = await User.find({ sponsor: userId }).select('firstName lastName username email userId sponsorCode createdAt');

    // Method 2: Get users who used this sponsor's referral code
    const referralCodeUsers = await User.find({ sponsorCode: sponsor.referralCode }).select('firstName lastName username email userId sponsorCode createdAt');

    // Method 3: Simplified validation - use the actual count from referralCodeUsers
    // This is more reliable as it directly checks who used the sponsor's referral code
    const validatedReferrals = referralCodeUsers;
    
    
    // Log validation details for debugging
    for (const ref of validatedReferrals) {
    }
    
    
    return {
      claimedCount: claimedReferrals.length,
      actualCount: referralCodeUsers.length,
      validatedCount: validatedReferrals.length,
      validatedReferrals: validatedReferrals
    };
  } catch (error) {
    console.error('❌ Error validating direct referrals:', error);
    return {
      claimedCount: 0,
      actualCount: 0,
      validatedCount: 0,
      validatedReferrals: []
    };
  }
};

// Get user dashboard data - ULTRA OPTIMIZED VERSION
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Execute all independent operations in parallel for better performance
    const [
      user,
      earningsAggregation,
      recentEarnings
    ] = await Promise.all([
      // Get user data with essential fields only
      User.findById(userId).select('_id userId firstName lastName username email referralCode totalEarnings totalWithdrawn walletAddress position level createdAt isAdmin'),
      
      // Get earnings aggregation in one query
      Earning.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$amount' },
            directEarnings: {
              $sum: {
                $cond: [{ $eq: ['$type', 'direct_referral'] }, '$amount', 0]
              }
            },
            levelEarnings: {
              $sum: {
                $cond: [{ $eq: ['$type', 'level_earning'] }, '$amount', 0]
              }
            },
            indirectEarnings: {
              $sum: {
                $cond: [{ $eq: ['$type', 'indirect_referral'] }, '$amount', 0]
              }
            },
            missedWalletEarnings: {
              $sum: {
                $cond: [{ $eq: ['$type', 'missed_wallet'] }, '$amount', 0]
              }
            }
          }
        }
      ]),
      
      // Get recent earnings (limited to 5 for faster loading)
      Earning.find({ user: userId })
        .populate('fromUser', 'walletAddress')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('amount type description createdAt')
    ]);

    // Process earnings aggregation result
    const earningsData = earningsAggregation[0] || {
      totalEarnings: 0,
      directEarnings: 0,
      levelEarnings: 0,
      indirectEarnings: 0,
      missedWalletEarnings: 0
    };
    
    // Get basic team stats with minimal queries
    const [directReferralsCount, totalTeamMembers] = await Promise.all([
      User.countDocuments({ sponsor: userId }),
      User.countDocuments({ 
        $or: [
          { sponsor: userId },
          { sponsorCode: user.referralCode }
        ]
      })
    ]);
    
    // Format recent earnings
    const formattedRecentEarnings = recentEarnings.map(earning => ({
      id: earning._id,
      amount: earning.amount,
      type: earning.type,
      date: earning.createdAt,
      description: earning.description
    }));

    // Get direct referrals for display (limited to 10 for performance)
    const actualDirectReferrals = await User.find({ sponsor: userId })
      .select('firstName lastName username email userId')
      .limit(10)
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          referralCode: user.referralCode,
          totalEarnings: user.totalEarnings,
          totalWithdrawn: user.totalWithdrawn,
          availableBalance: earningsData.totalEarnings,
          walletAddress: user.walletAddress,
          position: user.position,
          level: user.level,
          registrationDate: user.createdAt
        },
        directReferrals: directReferralsCount,
        actualDirectReferrals: actualDirectReferrals.map(ref => ({
          id: ref._id,
          name: `${ref.firstName || ''} ${ref.lastName || ''}`.trim() || 'No name',
          username: ref.username || 'No username',
          userId: ref.userId
        })),
        totalTeam: totalTeamMembers,
        totalEarnings: earningsData.totalEarnings,
        directIncome: earningsData.directEarnings,
        levelIncome: earningsData.levelEarnings,
        teamStats: {
          totalMembers: totalTeamMembers,
          directReferrals: directReferralsCount,
          totalLevels: 15 // Fixed value for performance
        },
        totalActualEarnings: earningsData.totalEarnings,
        recentEarnings: formattedRecentEarnings,
        // Removed missedWallet for performance - can be loaded separately if needed
        missedWallet: {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          message: 'Load missed wallet data separately for better performance'
        }
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get team members (binary structure)
router.get('/team', auth, async (req, res) => {
  try {
    const { level = 15, page = 1, limit = 100 } = req.query;
    
    // Get binary tree structure
    const binaryTree = await MLMService.getBinaryTree(req.user._id, parseInt(level));
    
    // Flatten binary tree for pagination
    const flattenBinaryTree = (node, currentLevel = 1) => {
      let result = [];
      if (!node) return result;
      
      result.push({
        id: node._id,
        _id: node._id,
        username: node.username,
        firstName: node.firstName,
        lastName: node.lastName,
        email: node.email || `${node.username}@example.com`,
        referralCode: node.referralCode,
        position: node.position,
        level: currentLevel,
        totalEarnings: node.totalEarnings || 0,
        isActive: node.isActive,
        joinDate: node.createdAt,
        registrationDate: node.createdAt
      });
      
      if (node.leftChild) {
        result = result.concat(flattenBinaryTree(node.leftChild, currentLevel + 1));
      }
      if (node.rightChild) {
        result = result.concat(flattenBinaryTree(node.rightChild, currentLevel + 1));
      }
      
      return result;
    };
    
    const allMembers = flattenBinaryTree(binaryTree);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = allMembers.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        members: paginatedMembers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(allMembers.length / limit),
          total: allMembers.length
        }
      }
    });

  } catch (error) {
    console.error('Team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get team tree structure (admin-like format)
router.get('/team-tree', auth, async (req, res) => {
  try {
    const { maxLevel = 15 } = req.query;
    const userId = req.user._id;
    
    // Get user info
    const user = await User.findById(userId).select('_id userId firstName lastName username email referralCode totalEarnings totalWithdrawn isActive level position registrationDate walletAddress');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get team tree structure
    const teamTree = await MLMService.getTeamTree(userId, parseInt(maxLevel));
    
    // Get team stats
    const teamStats = await MLMService.getTeamStats(userId);
    
    // Format user info like admin
    const userInfo = {
      _id: user._id,
      userId: user.userId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      referralCode: user.referralCode,
      totalEarnings: user.totalEarnings || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
      isActive: user.isActive,
      level: user.level || 1,
      position: user.position || 'root',
      registrationDate: user.registrationDate,
      walletAddress: user.walletAddress
    };
    
    // Format stats
    const stats = {
      totalUsers: teamStats?.totalTeamMembers || 0,
      activeUsers: teamStats?.directReferrals || 0,
      totalEarnings: user.totalEarnings || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
      maxLevel: parseInt(maxLevel)
    };
    
    res.json({
      success: true,
      data: {
        tree: teamTree || [],
        userInfo: userInfo,
        stats: stats
      }
    });

  } catch (error) {
    console.error('Team tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get referral tree structure (showing all referrals in left-right format)
router.get('/referral-tree', auth, async (req, res) => {
  try {
    const { maxLevel = 15 } = req.query;
    
    // Get referral tree structure
    const referralTree = await MLMService.getReferralTree(req.user._id, parseInt(maxLevel));
    
    if (!referralTree) {
      return res.json({
        success: true,
        data: null,
        message: 'No referral data available'
      });
    }
    
    res.json({
      success: true,
      data: referralTree
    });

  } catch (error) {
    console.error('Referral tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get earnings history
router.get('/earnings', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const earningsData = await MLMService.getEarningsHistory(
      req.user._id, 
      parseInt(page), 
      parseInt(limit)
    );
    
    res.json({
      success: true,
      data: earningsData
    });

  } catch (error) {
    console.error('Earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get referral links
router.get('/referral-links', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const referralLinks = {
      direct: `${baseUrl}/auth/register?ref=${user.referralCode}`,
      whatsapp: `https://wa.me/?text=Join%20our%20crypto%20MLM%20platform!%20Use%20my%20referral%20code:%20${user.referralCode}%20Register%20at:%20${baseUrl}/auth/register?ref=${user.referralCode}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${baseUrl}/auth/register?ref=${user.referralCode}`)}`,
      twitter: `https://twitter.com/intent/tweet?text=Join%20our%20crypto%20MLM%20platform!%20Use%20my%20referral%20code:%20${user.referralCode}&url=${encodeURIComponent(`${baseUrl}/auth/register?ref=${user.referralCode}`)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(`${baseUrl}/auth/register?ref=${user.referralCode}`)}&text=Join%20our%20crypto%20MLM%20platform!%20Use%20my%20referral%20code:%20${user.referralCode}`
    };
    
    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        links: referralLinks
      }
    });

  } catch (error) {
    console.error('Referral links error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const earningsData = await MLMService.calculateBinaryEarnings(req.user._id);
    
    // Get monthly earnings
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const monthlyEarnings = await MLMService.getEarningsHistory(req.user._id, 1, 100);
    const thisMonthEarnings = monthlyEarnings.earnings.filter(earning => 
      new Date(earning.createdAt) >= currentMonth
    );
    
    const monthlyTotal = thisMonthEarnings.reduce((sum, earning) => sum + earning.amount, 0);
    
    res.json({
      success: true,
      data: {
        totalEarnings: user.totalEarnings,
        totalWithdrawn: user.totalWithdrawn,
        availableBalance: earningsData.availableBalance,
        monthlyEarnings: monthlyTotal,
        teamStats: earningsData.teamStats,
        levelEarnings: earningsData.levelEarnings,
        totalActualEarnings: earningsData.totalActualEarnings,
        totalMaxPotential: earningsData.totalMaxPotential,
        registrationDate: user.createdAt
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get detailed team statistics for debugging - OPTIMIZED VERSION
router.get('/team-stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Execute all independent operations in parallel for better performance
    const [
      directReferrals,
      totalTeamMembers,
      actualDirectReferrals,
      teamByLevel
    ] = await Promise.all([
      // Get direct referrals count
      User.countDocuments({ sponsor: userId }),
      
      // Get total team members count using optimized method
      MLMService.getTotalTeamMembers(userId),
      
      // Get actual direct referrals for verification
      User.find({ sponsor: userId }).select('firstName lastName username'),
      
      // Get team members by level using aggregation (much faster)
      User.aggregate([
        {
          $match: { sponsor: userId }
        },
        {
          $graphLookup: {
            from: 'users',
            startWith: '$_id',
            connectFromField: '_id',
            connectToField: 'sponsor',
            as: 'teamMembers',
            maxDepth: 15
          }
        },
        {
          $project: {
            level: 1,
            teamMembers: 1
          }
        }
      ])
    ]);

    // Process team by level from aggregation result
    const processedTeamByLevel = {};
    for (let level = 1; level <= 15; level++) {
      processedTeamByLevel[level] = 0;
    }
    
    // Count team members by level from aggregation
    teamByLevel.forEach(member => {
      if (member.teamMembers && member.teamMembers.length > 0) {
        member.teamMembers.forEach(teamMember => {
          const memberLevel = teamMember.level || 1;
          if (memberLevel >= 1 && memberLevel <= 15) {
            processedTeamByLevel[memberLevel]++;
          }
        });
      }
    });
    
    res.json({
      success: true,
      data: {
        directReferrals,
        totalTeamMembers,
        teamByLevel: processedTeamByLevel,
        teamTree: 'Tree structure available (optimized)',
        actualDirectReferrals: actualDirectReferrals.map(u => ({
          id: u._id,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'No name',
          username: u.username || 'No username'
        })),
        debug: {
          userId: userId.toString(),
          sponsorField: 'sponsor',
          query: { sponsor: userId },
          optimized: true
        }
      }
    });

  } catch (error) {
    console.error('Team stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all team members (including indirect referrals)
router.get('/all-team', auth, async (req, res) => {
  try {
    const { level = 15, page = 1, limit = 100 } = req.query;
    
    // Get all team members (direct + indirect)
    const allMembers = await MLMService.getAllTeamMembers(req.user._id, parseInt(level));
    
    // Paginate results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMembers = allMembers.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        members: paginatedMembers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(allMembers.length / limit),
          total: allMembers.length
        }
      }
    });

  } catch (error) {
    console.error('All team error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get level-wise team statistics
router.get('/level-stats', auth, async (req, res) => {
  try {
    const levelStats = await MLMService.getLevelWiseTeamStats(req.user._id);
    
    if (!levelStats) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get level statistics'
      });
    }
    
    res.json({
      success: true,
      data: levelStats
    });

  } catch (error) {
    console.error('Level stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get missed wallet info separately for better performance
router.get('/missed-wallet', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get missed wallet info
    const missedWalletInfo = await MLMService.getMissedWalletInfo(userId);
    
    res.json({
      success: true,
      data: missedWalletInfo
    });
  } catch (error) {
    console.error('Missed wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get level-wise member distribution with available slots
router.get('/level-distribution', auth, async (req, res) => {
  try {
    const levelDistribution = await MLMService.getLevelWiseMemberDistribution(req.user._id);
    
    if (!levelDistribution) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get level distribution'
      });
    }
    
    res.json({
      success: true,
      data: levelDistribution
    });

  } catch (error) {
    console.error('Level distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get missed wallet information for user
router.get('/missed-wallet', auth, async (req, res) => {
  try {
    const missedWalletInfo = await MLMService.getMissedWalletInfo(req.user._id);
    
    res.json({
      success: true,
      data: missedWalletInfo
    });

  } catch (error) {
    console.error('Missed wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Process missed wallet earnings for user
router.post('/process-missed-wallet', auth, async (req, res) => {
  try {
    const earnings = await MLMService.processMissedWalletEarnings(req.user._id);
    
    res.json({
      success: true,
      message: `Processed ${earnings.length} missed wallet earnings`,
      data: {
        earningsProcessed: earnings.length,
        totalAmount: earnings.reduce((sum, earning) => sum + earning.amount, 0)
      }
    });

  } catch (error) {
    console.error('Process missed wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get detailed missed wallet info for user
router.get('/missed-wallet-detailed', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const detailedMissedWalletInfo = await MLMService.getDetailedMissedWalletInfo(userId);
    
    res.json({
      success: true,
      data: detailedMissedWalletInfo
    });
  } catch (error) {
    console.error('Detailed missed wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Force update user level (admin only)
router.post('/force-update-level', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Force update the user's level
    const updatedLevel = await MLMService.forceUpdateUserLevel(userId);
    
    res.json({
      success: true,
      message: 'User level updated successfully',
      data: {
        userId: userId,
        updatedLevel: updatedLevel
      }
    });

  } catch (error) {
    console.error('Force update level error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update all user levels (admin only)
router.post('/update-all-levels', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Update all user levels
    await MLMService.updateUserLevels();
    
    res.json({
      success: true,
      message: 'All user levels updated successfully'
    });

  } catch (error) {
    console.error('Update all levels error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;