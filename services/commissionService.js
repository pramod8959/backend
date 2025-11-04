const User = require('../models/User');
const Commission = require('../models/Commission');
const Earning = require('../models/Earning');

/**
 * INCOME STRUCTURE FOR $20 PACKAGE
 * ================================
 * 
 * DIRECT REFERRAL: $2 (10%)
 * - Get $2 instantly for every direct referral
 * - This is the fastest way to start earning
 * 
 * LEVEL INCOME: $1 per level (5% each)
 * - Earn 5% bonus on each level up to 15 levels deep
 * - Creates a powerful residual income stream
 * - $1 × 15 levels = $15 total (75%)
 * 
 * CREATOR BONUS: $2 (10%)
 * - Goes to system admin/creator
 * 
 * DEVELOPMENT & PROMOTION: $1 (5%)
 * - Goes to development fund
 * 
 * LEVEL UNLOCKING CRITERIA:
 * Direct Referrals → Levels Unlocked
 * 2 → 4 levels
 * 5 → 5 levels
 * 6 → 6 levels
 * ...continuing up to...
 * 15 → 15 levels
 * 
 * BONUS: Full 15 levels auto-unlock when team size reaches 100
 * 
 * Total: $2 + $15 + $2 + $1 = $20 (100%)
 */

class CommissionService {
  
  /**
   * Calculate unlocked levels based on direct referrals count
   * @param {number} directReferrals - Number of direct referrals
   * @param {boolean} teamFullyBuilt - Whether the team size reached 100
   * @returns {number} Number of unlocked levels
   */
  static calculateUnlockedLevels(directReferrals, teamFullyBuilt = false) {
    // Bonus: if user's team size reaches 100, auto unlock all 15 levels
    if (teamFullyBuilt) {
      return 15;
    }

    // Level unlocking criteria based on direct referrals
    // Direct Referrals → Levels Unlocked
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
    if (directReferrals >= 2) return 4; // 2 direct referrals unlock 4 levels
    
    return 0; // No levels unlocked without at least 2 direct referrals
  }

  /**
   * Check if a user's team size has reached 100 members (auto-unlock bonus)
   * @param {string} userId - User ID to check
   * @returns {boolean} True if team has 100+ members
   */
  static async isTeamFullyBuilt(userId) {
    try {
      const totalTeamSize = await this.getTotalTeamSize(userId);
      return totalTeamSize >= 100; // Auto-unlock at 100 team members
    } catch (error) {
      console.error('Error checking team size:', error);
      return false;
    }
  }

  /**
   * Get number of team members at a specific level
   * @param {string} userId - Root user ID
   * @param {number} targetLevel - Target level to count
   * @returns {number} Number of members at that level
   */
  static async getMembersAtLevel(userId, targetLevel) {
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
    
    try {
      const members = await getTeamAtLevel(userId, 1);
      return members.length;
    } catch (error) {
      console.error('Error getting members at level:', error);
      return 0;
    }
  }

  /**
   * Get direct referrals count for a user
   * @param {string} userId - User ID
   * @returns {number} Number of direct referrals
   */
  static async getDirectReferralsCount(userId) {
    try {
      return await User.countDocuments({ sponsor: userId });
    } catch (error) {
      console.error('Error getting direct referrals count:', error);
      return 0;
    }
  }

  /**
   * Get upline chain up to 15 levels
   * @param {string} userId - Starting user ID
   * @returns {Array} Array of upline users with their levels
   */
  static async getUplineChain(userId) {
    const uplineChain = [];
    let currentUser = await User.findById(userId).select('sponsor firstName lastName userId walletAddress');
    let level = 1;
    
    while (currentUser && currentUser.sponsor && level <= 15) {
      const sponsorUser = await User.findById(currentUser.sponsor)
        .select('_id sponsor firstName lastName userId walletAddress totalEarnings');
      
      if (!sponsorUser) break;
      
      // Get sponsor's direct referrals count and team status
      const directReferralsCount = await this.getDirectReferralsCount(sponsorUser._id);
      const teamFullyBuilt = await this.isTeamFullyBuilt(sponsorUser._id);
      const unlockedLevels = this.calculateUnlockedLevels(directReferralsCount, teamFullyBuilt);
      
      uplineChain.push({
        user: sponsorUser,
        level: level,
        directReferralsCount,
        unlockedLevels,
        teamFullyBuilt,
        canReceiveCommission: level <= unlockedLevels
      });
      
      currentUser = sponsorUser;
      level++;
    }
    
    return uplineChain;
  }

  /**
   * Main function to distribute commission when a new user registers
   * @param {string} newUserId - ID of the newly registered user
   * @returns {Object} Distribution result with details
   */
  static async distributeCommission(newUserId) {
    try {
      console.log(`💰 Starting commission distribution for new user: ${newUserId}`);
      
      // Get the new user details
      const newUser = await User.findById(newUserId)
        .select('userId firstName lastName sponsor walletAddress');
      
      if (!newUser) {
        throw new Error('New user not found');
      }
      
      if (!newUser.sponsor) {
        console.log('ℹ️ User has no sponsor, no commissions to distribute');
        return {
          success: true,
          message: 'No sponsor found, no commissions distributed',
          totalDistributed: 0,
          commissions: []
        };
      }
      
      // Get upline chain (up to 15 levels)
      const uplineChain = await this.getUplineChain(newUserId);
      console.log(`📈 Found ${uplineChain.length} users in upline chain`);
      
      const commissions = [];
      let totalDistributed = 0;
      
      // Process each upline user
      for (const uplineEntry of uplineChain) {
        const { user: uplineUser, level, directReferralsCount, unlockedLevels, canReceiveCommission } = uplineEntry;
        
        // Determine commission amount based on income structure
        let commissionAmount = 0;
        let commissionType = '';
        
        if (level === 1) {
          // Direct referral bonus: $2 (10% of $20)
          commissionAmount = 2;
          commissionType = 'direct_referral';
        } else {
          // Level income: $1 per level (5% each)
          // Earn 5% bonus on each level up to 15 levels deep
          if (canReceiveCommission) {
            commissionAmount = 1; // Flat $1 for all levels 2-15
            commissionType = 'level_income';
          }
        }
        
        // Only process if there's a commission to give
        if (commissionAmount > 0) {
          try {
            // Create commission record
            const commission = new Commission({
              fromUser: newUserId,
              toUser: uplineUser._id,
              level: level,
              amount: commissionAmount,
              commissionType: commissionType,
              description: level === 1 
                ? `Direct referral bonus ($2) from ${newUser.userId}`
                : `Level ${level} income ($1) from ${newUser.userId}`,
              status: 'paid',
              triggerRegistration: newUserId,
              metadata: {
                directReferralsCount,
                unlockedLevels,
                teamSize: await this.getTotalTeamSize(uplineUser._id),
                calculationDate: new Date()
              }
            });
            
            await commission.save();
            
            // Update user's total earnings
            await User.findByIdAndUpdate(uplineUser._id, {
              $inc: { totalEarnings: commissionAmount }
            });
            
            // Create earning record for tracking
            const earning = new Earning({
              user: uplineUser._id,
              fromUser: newUserId,
              level: level,
              amount: commissionAmount,
              commissionRate: level === 1 ? 10 : 5, // 10% for direct, 5% for each level
              description: commission.description,
              type: level === 1 ? 'direct_referral' : 'level_income',
              status: 'completed',
              paymentMethod: 'USDT' // Default
            });
            
            await earning.save();
            
            commissions.push({
              recipientId: uplineUser._id,
              recipientUserId: uplineUser.userId,
              recipientName: `${uplineUser.firstName || ''} ${uplineUser.lastName || ''}`.trim(),
              level: level,
              amount: commissionAmount,
              type: commissionType,
              canReceive: canReceiveCommission,
              directReferrals: directReferralsCount,
              unlockedLevels: unlockedLevels
            });
            
            totalDistributed += commissionAmount;
            
            console.log(`✅ Level ${level}: $${commissionAmount} → ${uplineUser.userId} (${commissionType})`);
            
          } catch (error) {
            console.error(`❌ Error creating commission for level ${level}:`, error);
          }
        } else {
          console.log(`⏭️ Level ${level}: $0 → ${uplineUser.userId} (level not unlocked)`);
          
          // Still track in commissions array for reporting
          commissions.push({
            recipientId: uplineUser._id,
            recipientUserId: uplineUser.userId,
            recipientName: `${uplineUser.firstName || ''} ${uplineUser.lastName || ''}`.trim(),
            level: level,
            amount: 0,
            type: 'level_income',
            canReceive: canReceiveCommission,
            reason: 'Level not unlocked',
            directReferrals: directReferralsCount,
            unlockedLevels: unlockedLevels
          });
        }
      }
      
      // Handle Creator Bonus (10% = $2) - goes to the root admin
      await this.distributeCreatorBonus(newUserId, 2, commissions);
      totalDistributed += 2;
      
      // Handle Development & Promotion (5% = $1) - goes to development fund
      await this.distributeDevelopmentBonus(newUserId, 1, commissions);
      totalDistributed += 1;
      
      console.log(`💰 Commission distribution completed. Total distributed: $${totalDistributed}`);
      
      return {
        success: true,
        message: `Commission distributed successfully for ${newUser.userId}`,
        newUser: {
          id: newUser._id,
          userId: newUser.userId,
          name: `${newUser.firstName || ''} ${newUser.lastName || ''}`.trim()
        },
        totalDistributed,
        commissionsCount: commissions.filter(c => c.amount > 0).length,
        uplineLevels: uplineChain.length,
        commissions,
        distributionDate: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error in commission distribution:', error);
      return {
        success: false,
        message: 'Commission distribution failed',
        error: error.message,
        totalDistributed: 0,
        commissions: []
      };
    }
  }

  /**
   * Distribute Creator Bonus to the root admin (system creator)
   * @param {string} newUserId - ID of the newly registered user
   * @param {number} amount - Creator bonus amount ($2)
   * @param {Array} commissions - Commission tracking array
   */
  static async distributeCreatorBonus(newUserId, amount, commissions) {
    try {
      // Find the root admin (creator of the system)
      const admin = await User.findOne({ isAdmin: true }).select('_id userId firstName lastName walletAddress');
      
      if (!admin) {
        console.log('⚠️ No admin found for creator bonus');
        return;
      }
      
      const newUser = await User.findById(newUserId).select('userId');
      
      // Create commission record for creator bonus
      const commission = new Commission({
        fromUser: newUserId,
        toUser: admin._id,
        level: 0, // Special level for creator bonus
        amount: amount,
        commissionType: 'creator_bonus',
        description: `Creator bonus from ${newUser.userId} registration`,
        status: 'paid',
        triggerRegistration: newUserId,
        metadata: {
          bonusType: 'creator',
          percentage: 10,
          packageAmount: 20,
          calculationDate: new Date()
        }
      });
      
      await commission.save();
      
      // Update admin's total earnings
      await User.findByIdAndUpdate(admin._id, {
        $inc: { totalEarnings: amount }
      });
      
      // Create earning record
      const earning = new Earning({
        user: admin._id,
        fromUser: newUserId,
        level: 0,
        amount: amount,
        commissionRate: 10,
        description: commission.description,
        type: 'creator_bonus',
        status: 'completed',
        paymentMethod: 'USDT'
      });
      
      await earning.save();
      
      commissions.push({
        recipientId: admin._id,
        recipientUserId: admin.userId,
        recipientName: `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
        level: 0,
        amount: amount,
        type: 'creator_bonus',
        canReceive: true,
        reason: 'Creator bonus (10%)'
      });
      
      console.log(`✅ Creator Bonus: $${amount} → ${admin.userId} (creator_bonus)`);
      
    } catch (error) {
      console.error('❌ Error distributing creator bonus:', error);
    }
  }

  /**
   * Distribute Development & Promotion bonus to development fund
   * @param {string} newUserId - ID of the newly registered user
   * @param {number} amount - Development bonus amount ($1)
   * @param {Array} commissions - Commission tracking array
   */
  static async distributeDevelopmentBonus(newUserId, amount, commissions) {
    try {
      // This goes to a special development fund account or can be tracked separately
      // For now, we'll create a special commission record for tracking
      const newUser = await User.findById(newUserId).select('userId');
      
      // Create commission record for development bonus (no specific recipient)
      const commission = new Commission({
        fromUser: newUserId,
        toUser: null, // No specific user - goes to development fund
        level: -1, // Special level for development fund
        amount: amount,
        commissionType: 'development_bonus',
        description: `Development & Promotion fund from ${newUser.userId} registration`,
        status: 'paid',
        triggerRegistration: newUserId,
        metadata: {
          bonusType: 'development',
          percentage: 5,
          packageAmount: 20,
          fundPurpose: 'Development & Promotion',
          calculationDate: new Date()
        }
      });
      
      await commission.save();
      
      commissions.push({
        recipientId: null,
        recipientUserId: 'DEVELOPMENT_FUND',
        recipientName: 'Development & Promotion Fund',
        level: -1,
        amount: amount,
        type: 'development_bonus',
        canReceive: true,
        reason: 'Development & Promotion (5%)'
      });
      
      console.log(`✅ Development Bonus: $${amount} → Development Fund (development_bonus)`);
      
    } catch (error) {
      console.error('❌ Error distributing development bonus:', error);
    }
  }

  /**
   * Get total team size for a user
   * @param {string} userId - User ID
   * @returns {number} Total team size
   */
  static async getTotalTeamSize(userId) {
    try {
      let totalSize = 0;
      
      // Count all descendants up to 15 levels
      for (let level = 1; level <= 15; level++) {
        const membersAtLevel = await this.getMembersAtLevel(userId, level);
        totalSize += membersAtLevel;
      }
      
      return totalSize;
    } catch (error) {
      console.error('Error calculating total team size:', error);
      return 0;
    }
  }

  /**
   * Get commission summary for a user
   * @param {string} userId - User ID
   * @returns {Object} Commission summary
   */
  static async getCommissionSummary(userId) {
    try {
      const totalCommissions = await Commission.getTotalCommissions(userId);
      const commissionBreakdown = await Commission.getCommissionBreakdown(userId);
      const recentCommissions = await Commission.getRecentCommissions(userId, 10);
      
      return {
        total: totalCommissions[0] || { totalAmount: 0, totalCommissions: 0 },
        breakdown: commissionBreakdown,
        recent: recentCommissions,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting commission summary:', error);
      return null;
    }
  }

  /**
   * Calculate potential earnings for all 15 levels (theoretical maximum)
   * @returns {Object} Potential earnings breakdown
   */
  static calculateMaxPotentialEarnings() {
    const breakdown = {};
    let totalPotential = 0;
    
    for (let level = 1; level <= 15; level++) {
      const membersAtLevel = Math.pow(2, level); // 2^level
      const commissionPerMember = level === 1 ? 2 : 1; // $2 for level 1, $1 for others
      const levelEarnings = membersAtLevel * commissionPerMember;
      
      breakdown[`level${level}`] = {
        level,
        expectedMembers: membersAtLevel,
        commissionPerMember,
        totalEarnings: levelEarnings
      };
      
      totalPotential += levelEarnings;
    }
    
    return {
      breakdown,
      totalMaxPotential: totalPotential, // $65,536 total
      currency: 'USDT',
      note: 'Maximum theoretical earnings if all 15 levels are completely filled'
    };
  }
}

module.exports = CommissionService;