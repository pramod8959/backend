const express = require('express');
const User = require('../models/User');
const Earning = require('../models/Earning');
const Commission = require('../models/Commission');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Helper function to calculate unlocked levels based on direct referrals
const calculateUnlockedLevels = (directReferrals, teamFullyBuilt = false) => {
  if (teamFullyBuilt) {
    return 15; // Auto unlock all levels if team is fully built
  }

  if (directReferrals >= 15) return 15;
  if (directReferrals >= 14) return 14;
  if (directReferrals >= 13) return 13;
  if (directReferrals >= 12) return 12;
  if (directReferrals >= 11) return 11;
  if (directReferrals >= 10) return 10;
  if (directReferrals >= 9) return 9;
  if (directReferrals >= 8) return 8;
  if (directReferrals >= 7) return 7;
  if (directReferrals >= 6) return 6;
  if (directReferrals >= 5) return 5;
  if (directReferrals >= 2) return 4; // 2 direct referrals unlock levels 1-4
  
  return 0; // No levels unlocked
};

// Helper function to get direct referrals count
const getDirectReferralsCount = async (userId) => {
  try {
    const count = await User.countDocuments({ sponsor: userId });
    return count;
  } catch (error) {
    console.error('Error counting direct referrals:', error);
    return 0;
  }
};

// Helper function to check if team is fully built (15 levels completely filled)
const isTeamFullyBuilt = async (userId, currentLevel = 1, maxLevel = 15) => {
  if (currentLevel > maxLevel) return true;
  
  const expectedMembersAtLevel = Math.pow(2, currentLevel); // 2^level
  const actualMembersAtLevel = await getMembersAtLevel(userId, currentLevel);
  
  if (actualMembersAtLevel < expectedMembersAtLevel) {
    return false;
  }
  
  // Recursively check next level
  return await isTeamFullyBuilt(userId, currentLevel + 1, maxLevel);
};

// Helper function to get members at specific level
const getMembersAtLevel = async (userId, targetLevel) => {
  const getTeamAtLevel = async (currentUserId, currentLevel) => {
    if (currentLevel === targetLevel) {
      return [currentUserId];
    }
    
    if (currentLevel > targetLevel) {
      return [];
    }
    
    const directReferrals = await User.find({ sponsor: currentUserId }).select('_id');
    let members = [];
    
    for (const referral of directReferrals) {
      const subMembers = await getTeamAtLevel(referral._id, currentLevel + 1);
      members = members.concat(subMembers);
    }
    
    return members;
  };
  
  const members = await getTeamAtLevel(userId, 1);
  return members.length;
};

// Helper function to get actual earnings from database
const getActualEarnings = async (userId) => {
  try {
    // Get earnings from Earning collection
    const earnings = await Earning.find({ user: userId });
    const commissions = await Commission.find({ toUser: userId });
    
    // Calculate totals by type
    const directReferralEarnings = earnings
      .filter(e => e.type === 'direct_referral')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const levelEarnings = earnings
      .filter(e => e.type === 'level_earning')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const creatorBonusEarnings = earnings
      .filter(e => e.type === 'creator_fee')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const otherEarnings = earnings
      .filter(e => !['direct_referral', 'level_earning', 'creator_fee'].includes(e.type))
      .reduce((sum, e) => sum + e.amount, 0);
      
    // Add commission records
    const directCommissions = commissions
      .filter(c => c.commissionType === 'direct_referral')
      .reduce((sum, c) => sum + c.amount, 0);
      
    const levelCommissions = commissions
      .filter(c => c.commissionType === 'level_income')
      .reduce((sum, c) => sum + c.amount, 0);
      
    const creatorCommissions = commissions
      .filter(c => c.commissionType === 'creator_bonus')
      .reduce((sum, c) => sum + c.amount, 0);
      
    const otherCommissions = commissions
      .filter(c => !['direct_referral', 'level_income', 'creator_bonus'].includes(c.commissionType))
      .reduce((sum, c) => sum + c.amount, 0);
    
    const totalFromDirectReferrals = directReferralEarnings + directCommissions;
    const totalFromLevels = levelEarnings + levelCommissions;
    const totalFromCreatorBonus = creatorBonusEarnings + creatorCommissions;
    const totalFromOther = otherEarnings + otherCommissions;
    const totalActual = totalFromDirectReferrals + totalFromLevels + totalFromCreatorBonus + totalFromOther;
    
    return {
      fromDirectReferrals: totalFromDirectReferrals,
      fromLevelEarnings: totalFromLevels,
      fromCreatorBonus: totalFromCreatorBonus,
      fromOtherSources: totalFromOther,
      totalActualEarnings: totalActual,
      recordsCount: {
        earnings: earnings.length,
        commissions: commissions.length
      }
    };
  } catch (error) {
    console.error('Error getting actual earnings:', error);
    return {
      fromDirectReferrals: 0,
      fromLevelEarnings: 0,
      fromCreatorBonus: 0,
      fromOtherSources: 0,
      totalActualEarnings: 0,
      recordsCount: { earnings: 0, commissions: 0 }
    };
  }
};

// Build tree structure recursively
const buildUserTree = async (userId, currentLevel = 1, maxLevel = 15, processedUsers = new Set()) => {
  // Prevent infinite loops
  if (processedUsers.has(userId.toString())) {
    return null;
  }
  
  if (currentLevel > maxLevel) {
    return null;
  }
  
  processedUsers.add(userId.toString());
  
  try {
    const user = await User.findById(userId)
      .select('userId firstName lastName walletAddress totalEarnings totalWithdrawn isActive level position createdAt')
      .lean();
    
    if (!user) return null;
    
    // Get direct referrals
    const directReferrals = await User.find({ sponsor: userId })
      .select('_id userId firstName lastName walletAddress totalEarnings totalWithdrawn isActive level position createdAt')
      .sort({ createdAt: 1 })
      .lean();
    
    // Calculate user stats
    const directReferralsCount = directReferrals.length;
    const teamFullyBuilt = await isTeamFullyBuilt(userId);
    const unlockedLevels = calculateUnlockedLevels(directReferralsCount, teamFullyBuilt);
    
    // Build children tree
    const children = [];
    for (const referral of directReferrals) {
      const childTree = await buildUserTree(referral._id, currentLevel + 1, maxLevel, new Set(processedUsers));
      if (childTree) {
        children.push(childTree);
      }
    }
    
    return {
      id: user._id,
      userId: user.userId,
      firstName: user.firstName || 'Unknown',
      lastName: user.lastName || 'User',
      walletAddress: user.walletAddress,
      totalEarnings: user.totalEarnings || 0,
      totalWithdrawn: user.totalWithdrawn || 0,
      isActive: user.isActive,
      level: user.level,
      position: user.position,
      createdAt: user.createdAt,
      
      // MLM specific data
      directReferralsCount,
      unlockedLevels,
      teamFullyBuilt,
      maxPossibleLevels: 15,
      currentTreeLevel: currentLevel,
      
      // Tree structure
      children: children,
      hasChildren: children.length > 0,
      childrenCount: children.length,
      
      // Earnings data (actual from database)
      earningsBreakdown: await getActualEarnings(user._id)
    };
    
  } catch (error) {
    console.error('Error building user tree:', error);
    return null;
  }
};

// Calculate total team size recursively
const calculateTotalTeamSize = (userTree) => {
  if (!userTree || !userTree.children) return 0;
  
  let totalSize = userTree.children.length; // Direct referrals
  
  for (const child of userTree.children) {
    totalSize += calculateTotalTeamSize(child); // Add indirect referrals
  }
  
  return totalSize;
};

// Get user tree structure
router.get('/tree/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    const maxLevels = parseInt(req.query.levels) || 15;
    const includeStats = req.query.stats === 'true';
    
    // Verify user exists and current user has permission to view
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if current user can view this tree (admin or self or team member)
    const currentUser = await User.findById(req.user._id);
    const canView = currentUser.isAdmin || 
                    targetUserId === req.user._id.toString() ||
                    await isInUpline(req.user._id, targetUserId);
    
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user tree'
      });
    }
    
    console.log(`🌳 Building tree for user ${targetUser.userId} (${maxLevels} levels)`);
    
    // Build the tree structure
    const userTree = await buildUserTree(targetUserId, 1, maxLevels);
    
    if (!userTree) {
      return res.status(404).json({
        success: false,
        message: 'Could not build user tree'
      });
    }
    
    // Calculate additional statistics if requested
    let statistics = {};
    if (includeStats) {
      const totalTeamSize = calculateTotalTeamSize(userTree);
      const directReferrals = userTree.directReferralsCount;
      const indirectReferrals = totalTeamSize - directReferrals;
      
      statistics = {
        totalTeamSize,
        directReferrals,
        indirectReferrals,
        unlockedLevels: userTree.unlockedLevels,
        maxPossibleLevels: 15,
        teamFullyBuilt: userTree.teamFullyBuilt,
        levelsProgress: `${userTree.unlockedLevels}/15`,
        earningsPotential: {
          fromDirectReferrals: directReferrals * 2,
          fromIndirectReferrals: indirectReferrals * 1,
          totalPossible: (directReferrals * 2) + (indirectReferrals * 1)
        },
        levelBreakdown: await getLevelBreakdown(targetUserId, maxLevels)
      };
    }
    
    res.json({
      success: true,
      message: 'User tree retrieved successfully',
      data: {
        tree: userTree,
        statistics: includeStats ? statistics : undefined,
        metadata: {
          requestedBy: req.user._id,
          targetUser: {
            id: targetUser._id,
            userId: targetUser.userId,
            name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim()
          },
          maxLevels,
          generatedAt: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting user tree:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while building user tree',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get level breakdown (how many users at each level)
const getLevelBreakdown = async (userId, maxLevels = 15) => {
  const breakdown = {};
  
  for (let level = 1; level <= maxLevels; level++) {
    const membersCount = await getMembersAtLevel(userId, level);
    const expectedMembers = Math.pow(2, level);
    
    breakdown[`level${level}`] = {
      currentMembers: membersCount,
      expectedMembers: expectedMembers,
      fillPercentage: expectedMembers > 0 ? ((membersCount / expectedMembers) * 100).toFixed(2) : 0,
      isComplete: membersCount >= expectedMembers
    };
  }
  
  return breakdown;
};

// Helper function to check if user is in upline
const isInUpline = async (userId, potentialUplineId) => {
  try {
    let currentUser = await User.findById(userId).select('sponsor');
    let level = 0;
    const maxLevels = 15;
    
    while (currentUser && currentUser.sponsor && level < maxLevels) {
      if (currentUser.sponsor.toString() === potentialUplineId) {
        return true;
      }
      currentUser = await User.findById(currentUser.sponsor).select('sponsor');
      level++;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking upline:', error);
    return false;
  }
};

// Get simplified tree (for performance)
router.get('/tree-simple/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    const maxDepth = parseInt(req.query.depth) || 3; // Limit depth for performance
    
    const buildSimpleTree = async (userId, currentDepth = 1) => {
      if (currentDepth > maxDepth) return null;
      
      const user = await User.findById(userId)
        .select('userId firstName lastName totalEarnings isActive')
        .lean();
      
      if (!user) return null;
      
      const directReferrals = await User.find({ sponsor: userId })
        .select('_id userId firstName lastName totalEarnings isActive')
        .limit(10) // Limit children for performance
        .lean();
      
      const children = [];
      for (const referral of directReferrals.slice(0, 6)) { // Max 6 children for simple view
        const child = await buildSimpleTree(referral._id, currentDepth + 1);
        if (child) children.push(child);
      }
      
      return {
        id: user._id,
        userId: user.userId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        totalEarnings: user.totalEarnings || 0,
        isActive: user.isActive,
        children,
        hasMoreChildren: directReferrals.length > 6,
        totalDirectReferrals: directReferrals.length
      };
    };
    
    const simpleTree = await buildSimpleTree(targetUserId);
    
    res.json({
      success: true,
      message: 'Simple user tree retrieved successfully',
      data: {
        tree: simpleTree,
        metadata: {
          maxDepth,
          isSimplified: true,
          generatedAt: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting simple tree:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while building simple tree'
    });
  }
});

// Get team statistics only
router.get('/stats/:userId?', auth, async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user._id;
    
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const directReferralsCount = await getDirectReferralsCount(targetUserId);
    const teamFullyBuilt = await isTeamFullyBuilt(targetUserId);
    const unlockedLevels = calculateUnlockedLevels(directReferralsCount, teamFullyBuilt);
    const levelBreakdown = await getLevelBreakdown(targetUserId);
    
    // Calculate total team size across all levels
    let totalTeamSize = 0;
    for (let level = 1; level <= 15; level++) {
      const membersAtLevel = await getMembersAtLevel(targetUserId, level);
      totalTeamSize += membersAtLevel;
    }
    
    const stats = {
      user: {
        id: user._id,
        userId: user.userId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        totalEarnings: user.totalEarnings || 0,
        totalWithdrawn: user.totalWithdrawn || 0
      },
      team: {
        directReferrals: directReferralsCount,
        totalTeamSize,
        unlockedLevels,
        maxPossibleLevels: 15,
        teamFullyBuilt,
        levelsProgress: `${unlockedLevels}/15`
      },
      earnings: {
        fromDirectReferrals: directReferralsCount * 2,
        fromIndirectReferrals: (totalTeamSize - directReferralsCount) * 1,
        totalPossible: (directReferralsCount * 2) + ((totalTeamSize - directReferralsCount) * 1),
        actualEarnings: user.totalEarnings || 0
      },
      levelBreakdown,
      generatedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: stats
    });
    
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating statistics'
    });
  }
});

module.exports = router;