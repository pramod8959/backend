const User = require('../models/User');
const Earning = require('../models/Earning');
const MissedLevelEarning = require('../models/MissedLevelEarning');

// Simple in-memory cache for level stats
const levelStatsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache invalidation helper
const invalidateUserCache = (userId) => {
  const cacheKey = `levelStats_${userId}`;
  levelStatsCache.delete(cacheKey);
  console.log(`Cache invalidated for user: ${userId}`);
};

class MLMService {
  // MLM Configuration based on income distribution chart
  static MLM_CONFIG = {
    REGISTRATION_FEE: 20, // USDT
    MAX_LEVELS: 15, // Maximum earning levels
  
    DIRECT_REFERRAL_BONUS: 2, // $2 (10%)
    LEVEL_BONUS_TOTAL: 15, // $15 (75%) - distributed across 15 levels
    CREATOR_BONUS: 2, // $2 (10%)
    DEVELOPMENT_PROMOTION: 1, // $1 (5%)
    
    // Indirect earnings (5% of $20 = $1)
    INDIRECT_EARNING_PERCENTAGE: 5, // 5% for indirect referrals
    INDIRECT_EARNING_AMOUNT: 1, // $1 per indirect referral
    
    // Level unlocking criteria (direct referrals required)
    LEVEL_CRITERIA: {
      1: 2,   // Need 2 direct referrals to unlock level 1
      2: 2,   // Need 2 direct referrals to unlock levels 2-4
      3: 2,   // Auto-unlock with 2 direct referrals
      4: 2,   // Auto-unlock with 2 direct referrals
      5: 5,   // Need 5 direct referrals to unlock level 5
      6: 6,   // Need 6 direct referrals
      7: 7,   // Need 7 direct referrals
      8: 8,   // Need 8 direct referrals
      9: 9,   // Need 9 direct referrals
      10: 10, // Need 10 direct referrals
      11: 11, // Need 11 direct referrals
      12: 12, // Need 12 direct referrals
      13: 13, // Need 13 direct referrals
      14: 14, // Need 14 direct referrals
      15: 15  // Need 15 direct referrals
    },
    
    // Level-wise earnings (distribute $15 across 15 levels - $1 per level)
    LEVEL_EARNINGS: {
      1: 1,      // $1 per member at level 1
      2: 1,      // $1 per member at level 2
      3: 1,      // $1 per member at level 3
      4: 1,      // $1 per member at level 4
      5: 1,      // $1 per member at level 5
      6: 1,      // $1 per member at level 6
      7: 1,      // $1 per member at level 7
      8: 1,      // $1 per member at level 8
      9: 1,      // $1 per member at level 9
      10: 1,     // $1 per member at level 10
      11: 1,     // $1 per member at level 11
      12: 1,     // $1 per member at level 12
      13: 1,     // $1 per member at level 13
      14: 1,     // $1 per member at level 14
      15: 1      // $1 per member at level 15
    },
    
    // Team size per level (2^n)
    TEAM_SIZE_PER_LEVEL: {
      1: 2,      // 2 members
      2: 4,      // 4 members
      3: 8,      // 8 members
      4: 16,     // 16 members
      5: 32,     // 32 members
      6: 64,     // 64 members
      7: 128,    // 128 members
      8: 256,    // 256 members
      9: 512,    // 512 members
      10: 1024,  // 1,024 members
      11: 2048,  // 2,048 members
      12: 4096,  // 4,096 members
      13: 8192,  // 8,192 members
      14: 16384, // 16,384 members
      15: 32768  // 32,768 members
    }
  };

  // Generate referral code (now uses wallet address)
  static generateReferralCode(walletAddress) {
    if (!walletAddress) {
      throw new Error('Wallet address is required for referral code generation');
    }
    return walletAddress.toLowerCase();
  }

  // Find next available node position in the tree
  static async findNextAvailableNode(sponsorId) {
    try {
     
      
      // Get sponsor
      const sponsor = await User.findById(sponsorId);
      if (!sponsor) {
        throw new Error('Sponsor not found');
      }

    

      // Check if sponsor has left child
      if (!sponsor.leftChild) {
      
        return {
          parentId: sponsorId,
          position: 'left',
          level: sponsor.level + 1
        };
      }

      // Check if sponsor has right child
      if (!sponsor.rightChild) {
       
        return {
          parentId: sponsorId,
          position: 'right',
          level: sponsor.level + 1
        };
      }

  
      // If both children exist, find next available node in the tree
      const result = await this.findNextAvailableNodeInTree(sponsorId);
     
      return result;
    } catch (error) {
      console.error('Error finding next available node:', error);
      throw error;
    }
  }

  // Recursively find next available node in the tree
  static async findNextAvailableNodeInTree(startUserId) {
    try {
      // Use BFS to find the first available position
      const queue = [startUserId];
      const visited = new Set();

      while (queue.length > 0) {
        const currentUserId = queue.shift();
        
        if (visited.has(currentUserId.toString())) {
          continue;
        }
        visited.add(currentUserId.toString());

        const currentUser = await User.findById(currentUserId);
        if (!currentUser) continue;

        // Check left child
        if (!currentUser.leftChild) {
          return {
            parentId: currentUserId,
            position: 'left',
            level: currentUser.level + 1
          };
        }

        // Check right child
        if (!currentUser.rightChild) {
          return {
            parentId: currentUserId,
            position: 'right',
            level: currentUser.level + 1
          };
        }

        // Add children to queue for next level
        if (currentUser.leftChild) {
          queue.push(currentUser.leftChild);
        }
        if (currentUser.rightChild) {
          queue.push(currentUser.rightChild);
        }
      }

      // If no available position found, create a fallback position
    
      
      // Get the admin user as fallback
      const adminUser = await User.findOne({ isAdmin: true });
      if (adminUser) {
      
        return {
          parentId: adminUser._id,
          position: 'left', // Always use left position for fallback
          level: adminUser.level + 1
        };
      }
      
      // If no admin found, this is a critical error
      throw new Error('No admin user found for fallback position');
    } catch (error) {
      console.error('Error finding next available node in tree:', error);
      throw error;
    }
  }

  // Update parent's child reference
  static async updateParentChildReference(parentId, childId, position) {
    try {
      const updateField = position === 'left' ? 'leftChild' : 'rightChild';
      await User.findByIdAndUpdate(parentId, { [updateField]: childId });
    } catch (error) {
      console.error('Error updating parent child reference:', error);
      throw error;
    }
  }

  // Get tree structure for a user
  static async getTreeStructure(userId, maxLevel = 15) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const buildTree = async (currentUser, currentLevel = 1) => {
        if (currentLevel > maxLevel) return null;

        const treeData = {
          _id: currentUser._id,
          userId: currentUser.userId,
          username: currentUser.username,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          walletAddress: currentUser.walletAddress,
          level: currentUser.level,
          position: currentUser.position,
          totalEarnings: currentUser.totalEarnings,
          isActive: currentUser.isActive,
          leftChild: null,
          rightChild: null,
          children: []
        };

        // Get left child
        if (currentUser.leftChild) {
          const leftChild = await User.findById(currentUser.leftChild);
          if (leftChild) {
            treeData.leftChild = await buildTree(leftChild, currentLevel + 1);
            treeData.children.push(treeData.leftChild);
          }
        }

        // Get right child
        if (currentUser.rightChild) {
          const rightChild = await User.findById(currentUser.rightChild);
          if (rightChild) {
            treeData.rightChild = await buildTree(rightChild, currentLevel + 1);
            treeData.children.push(treeData.rightChild);
          }
        }

        return treeData;
      };

      return await buildTree(user);
    } catch (error) {
      console.error('Error getting tree structure:', error);
      throw error;
    }
  }

  // Get tree statistics
  static async getTreeStatistics(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const stats = {
        totalMembers: 0,
        leftSideMembers: 0,
        rightSideMembers: 0,
        levels: {},
        totalEarnings: 0
      };

      const calculateStats = async (currentUser, level = 1) => {
        if (level > 15) return;

        stats.totalMembers++;
        stats.totalEarnings += currentUser.totalEarnings || 0;

        if (!stats.levels[level]) {
          stats.levels[level] = 0;
        }
        stats.levels[level]++;

        if (currentUser.position === 'left') {
          stats.leftSideMembers++;
        } else if (currentUser.position === 'right') {
          stats.rightSideMembers++;
        }

        // Recursively calculate for children
        if (currentUser.leftChild) {
          const leftChild = await User.findById(currentUser.leftChild);
          if (leftChild) {
            await calculateStats(leftChild, level + 1);
          }
        }

        if (currentUser.rightChild) {
          const rightChild = await User.findById(currentUser.rightChild);
          if (rightChild) {
            await calculateStats(rightChild, level + 1);
          }
        }
      };

      await calculateStats(user);

      return stats;
    } catch (error) {
      console.error('Error getting tree statistics:', error);
      throw error;
    }
  }

  // Register new user with MLM structure
  static async registerUser(userData) {
    try {
      const { sponsorCode, walletAddress, paymentTxHash, paymentMethod } = userData;
      
      // Generate referral code from wallet address
      const referralCode = this.generateReferralCode(walletAddress);

      // Find sponsor by wallet address (referral code)
      let sponsor = null;
      if (sponsorCode) {
        sponsor = await User.findOne({ referralCode: sponsorCode.toLowerCase() });
      }
      
      // If no sponsor found, use admin as sponsor
      if (!sponsor) {
        sponsor = await User.findOne({ isAdmin: true });
        if (!sponsor) {
          throw new Error('Admin account not found. Please contact support.');
        }
        
        // Ensure admin has proper structure
        if (!sponsor.level) {
          sponsor.level = 0; // Admin should be at level 0
          await sponsor.save();
         
        }
        
       
      }

      // Find next available node position in the tree
      let nodePosition = await this.findNextAvailableNode(sponsor._id);
      if (!nodePosition) {
        
        // Fallback: create position under admin
        const adminUser = await User.findOne({ isAdmin: true });
        if (!adminUser) {
          throw new Error('No admin user found for fallback');
        }
        
        // Create a simple fallback position
        nodePosition = {
          parentId: adminUser._id,
          position: 'left',
          level: 1
        };
        
       
      }

      // Create new user
      const newUser = new User({
        referralCode,
        sponsorCode: sponsorCode || (sponsor ? sponsor.referralCode : null),
        sponsor: nodePosition.parentId,
        position: nodePosition.position,
        level: nodePosition.level,
        walletAddress: walletAddress.toLowerCase(),
        paymentTxHash,
        paymentMethod: paymentMethod || 'USDT',
        isActive: true,
        registrationDate: new Date()
      });

      await newUser.save();

      // Update parent's child reference
      await this.updateParentChildReference(nodePosition.parentId, newUser._id, nodePosition.position);

      // Process MLM earnings
      if (sponsor) {
        await this.processMLMEarnings(newUser._id, sponsor._id, paymentTxHash);
      }

      // Process missed wallet earnings for all affected users after new registration
      try {
       
        await this.processMissedWalletAfterRegistration(newUser._id, sponsor ? sponsor._id : null);
      } catch (error) {
        console.error('Error processing missed wallet after registration:', error);
        // Don't fail registration if missed wallet processing fails
      }

      // Process missed level earnings for sponsor and their chain based on direct referrals
      if (sponsor) {
        try {
         
          
          // Check and create missed level earnings for sponsor
          await this.checkAndCreateMissedLevelEarnings(sponsor._id);
          
          // Check level completion and transfer for sponsor
          for (let level = 1; level <= 15; level++) {
            await this.checkLevelCompletionAndTransfer(sponsor._id, level);
          }
          
          // Check for sponsor's sponsor (up the chain)
          if (sponsor.sponsor) {
            await this.checkAndCreateMissedLevelEarnings(sponsor.sponsor);
            for (let level = 1; level <= 15; level++) {
              await this.checkLevelCompletionAndTransfer(sponsor.sponsor, level);
            }
          }
          
        
          await this.processAllMissedLevelEarnings();
          
          
          await this.deepProcessAllUsersAfterRegistration(newUser._id, sponsor._id);
          
        } catch (error) {
          console.error('Error processing missed level earnings after registration:', error);
          // Don't fail registration if missed level processing fails
        }
      }

      return {
        success: true,
        user: newUser,
        message: 'User registered successfully'
      };

    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  // Process MLM earnings based on income distribution chart
  static async processMLMEarnings(newUserId, sponsorId, paymentTxHash) {
    try {
      const newUser = await User.findById(newUserId);
      const sponsor = await User.findById(sponsorId);
      
      if (!newUser || !sponsor) {
        throw new Error('User or sponsor not found');
      }

      const registrationFee = this.MLM_CONFIG.REGISTRATION_FEE;
      const earnings = [];
      const admin = await User.findOne({ isAdmin: true });

    

      // 1. Direct Referral Bonus ($2 - 10%)
      const directReferralBonus = this.MLM_CONFIG.DIRECT_REFERRAL_BONUS;
      
      earnings.push({
        userId: sponsorId,
        amount: directReferralBonus,
        type: 'direct_referral',
        level: 1,
        description: `Direct referral bonus ($${directReferralBonus} - 10%)`,
        referralId: newUserId,
        paymentTxHash,
        commissionRate: 10,
        paymentMethod: 'USDT'
      });

      // 2. Level-based earnings for all eligible users in the chain
      const levelEarnings = await this.calculateLevelBasedEarnings(
        newUserId, 
        sponsorId, 
        registrationFee, 
        paymentTxHash
      );
      earnings.push(...levelEarnings);

      // 2.5. Auto-transfer pending missed earnings for newly unlocked levels
      await this.autoTransferMissedEarnings(sponsorId, newUserId, paymentTxHash);

      // 3. Creator Bonus ($2 - 10%) - Always goes to admin
      const creatorBonus = this.MLM_CONFIG.CREATOR_BONUS;
      
      if (admin && creatorBonus > 0) {
        earnings.push({
          userId: admin._id,
          amount: creatorBonus,
          type: 'creator_fee',
          level: 1,
          description: 'Creator bonus ($2 - 10%)',
          referralId: newUserId,
          paymentTxHash,
          commissionRate: 10,
          paymentMethod: 'USDT'
        });
      }

      // 4. Development & Promotion ($1 - 5%) - Always goes to admin
      const developmentPromotion = this.MLM_CONFIG.DEVELOPMENT_PROMOTION;
      
      if (admin && developmentPromotion > 0) {
        earnings.push({
          userId: admin._id,
          amount: developmentPromotion,
          type: 'promotional_bonus',
          level: 1,
          description: 'Development & promotion ($1 - 5%)',
          referralId: newUserId,
          paymentTxHash,
          commissionRate: 5,
          paymentMethod: 'USDT'
        });
      }

      // 5. Process missed wallet earnings for admin (real-time)
      if (admin) {
        const missedWalletEarnings = await this.processRealTimeMissedWalletEarnings(
          newUserId, 
          sponsorId, 
          admin._id, 
          paymentTxHash
        );
        earnings.push(...missedWalletEarnings);
      }


      // Save all earnings
      for (const earning of earnings) {
        await this.createEarning(earning);
      }

      // Update user earnings
      await this.updateUserEarnings(earnings);

      // Update levels for all affected users
      await this.updateUserLevels(newUserId);

     

      // Check and create missed level earnings for sponsor and their chain
      if (sponsorId) {
        try {
          console.log(`🔄 Checking missed level earnings for sponsor chain after new registration`);
          await this.checkAndCreateMissedLevelEarnings(sponsorId);
          
          // Check level completion and transfer for sponsor
          for (let level = 1; level <= 15; level++) {
            await this.checkLevelCompletionAndTransfer(sponsorId, level);
          }
          
          
          await this.deepProcessAllUsersAfterRegistration(newUserId, sponsorId);
        } catch (error) {
          console.error('Error processing missed level earnings after registration:', error);
          // Don't fail registration if missed level processing fails
        }
      }

      return earnings;

    } catch (error) {
      console.error('Error processing MLM earnings:', error);
      throw error;
    }
  }


  // Calculate level-based earnings for all users in the chain
  static async calculateLevelBasedEarnings(newUserId, sponsorId, registrationFee, paymentTxHash) {
    const earnings = [];
    
    try {
      // Get the new user
      const newUser = await User.findById(newUserId);
      if (!newUser) return earnings;
      
      // Get all users in the chain from sponsor to admin (EXCLUDE the new user)
      const chainUsers = await this.getSponsorChain(sponsorId);
      
     
      
      // Process earnings for each user in the sponsor chain
      for (let i = 0; i < chainUsers.length; i++) {
        const chainUser = chainUsers[i];
        
        // Calculate the level for this user based on their position in the chain
        // Level 1 = direct sponsor, Level 2 = sponsor's sponsor, etc.
        const earningLevel = i + 1;
        
        // Check if user has unlocked this level based on their direct referrals
        const isLevelUnlocked = await this.isLevelUnlocked(chainUser._id, earningLevel);
        
      
        
        if (earningLevel <= 15) {
          // Calculate earning based on level - $1 per member at this level
          const levelEarningPerMember = this.MLM_CONFIG.LEVEL_EARNINGS[earningLevel] || 0;
          
          if (levelEarningPerMember > 0) {
            // CRITICAL: Only process earnings if level is unlocked
            if (isLevelUnlocked) {
              // Check if this level has already been transferred from missed earnings
              const transferredMissedEarning = await MissedLevelEarning.findOne({
                user: chainUser._id,
                level: earningLevel,
                status: 'transferred',
                amount: 0
              });
              
              // Skip regular earning if missed earning was already transferred
              if (transferredMissedEarning) {
                console.log(`Skipping regular earning for user ${chainUser.walletAddress} level ${earningLevel} - already transferred from missed earnings`);
                continue;
              }
              
              // Get the actual number of members at this level for this user
              const membersAtLevel = await this.getMembersCountAtLevel(chainUser._id, earningLevel);
              const levelEarning = Math.floor(membersAtLevel * levelEarningPerMember); // $1 per member, whole numbers only
              
            
              
              if (levelEarning > 0) {
                // Level is unlocked - credit immediately
                let earningType = 'level_earning';
                let description = `Level ${earningLevel} earning (${membersAtLevel} members × $${levelEarningPerMember})`;
                
                // Check if this is a missed wallet scenario
                const isMissedWallet = await this.checkMissedWalletScenario(chainUser._id, newUserId);
                
                if (isMissedWallet) {
                  earningType = 'missed_wallet';
                  description = `Missed wallet - Level ${earningLevel} earning (${membersAtLevel} members × $${levelEarningPerMember})`;
                }
                
                earnings.push({
                  userId: chainUser._id,
                  amount: levelEarning,
                  type: earningType,
                  level: earningLevel,
                  description: description,
                  referralId: newUserId,
                  paymentTxHash,
                  commissionRate: (levelEarning / registrationFee) * 100,
                  paymentMethod: 'USDT'
                });
                
                console.log(`Level earning: User ${chainUser.walletAddress} (level ${earningLevel}) gets $${levelEarning} from ${newUser.walletAddress}'s registration (${membersAtLevel} members × $${levelEarningPerMember})`);
              }
            } else {
              // Level is not unlocked - store accumulated locked earnings
              // This will be shown to user and transferred when level unlocks
              const membersAtLevel = await this.getMembersCountAtLevel(chainUser._id, earningLevel);
              
              // Locked amount = TOTAL members at this level (including this new registration)
              const lockedAmount = membersAtLevel * levelEarningPerMember;
              
            
              
              if (lockedAmount > 0) {
                // Update or create locked earning
                try {
                  const result = await this.updateLockedMissedEarning(chainUser._id, earningLevel, lockedAmount);
                  if (result) {
                    console.log(`      ✅ Locked earning updated/stored`);
                  } else {
                    console.log(`      ⚠️  Locked earning update returned null`);
                  }
                } catch (error) {
                  console.error(`      ❌ Error storing locked earning:`, error.message);
                }
              }
            }
          }
        }
      }
      
      return earnings;
    } catch (error) {
      console.error('Error in calculateLevelBasedEarnings:', error);
      return earnings;
    }
  }

  // Deep process all users for level unlocks and earnings after new user registration
  static async deepProcessAllUsersAfterRegistration(newUserId, sponsorId) {
    try {
     
      
      // Get all users in the system (excluding admin)
      const allUsers = await User.find({ isAdmin: false, isActive: true });
     
      
      let totalProcessed = 0;
      let totalCredited = 0;
      
      for (const user of allUsers) {
        try {
         
          
          // Get direct referrals count
          const directReferralsCount = await User.countDocuments({ 
            sponsor: user._id, 
            isAdmin: { $ne: true } 
          });
          
        
          
          // Check all 15 levels for this user
          for (let level = 1; level <= 15; level++) {
            const requiredDirectRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level] || 0;
            const isLevelUnlocked = directReferralsCount >= requiredDirectRefs;
            
            if (isLevelUnlocked) {
              // Level is unlocked - check if user needs immediate credit
              await this.checkLevelCompletionAndTransfer(user._id, level);
              totalCredited++;
            }
          }
          
          totalProcessed++;
        } catch (error) {
          console.error(`Error deep processing user ${user.userId}:`, error);
        }
      }
      
     
      
    } catch (error) {
      console.error('Error in deep process all users after registration:', error);
    }
  }

  // Get all users in the chain from a user to admin
  static async getUserChain(userId) {
    const chain = [];
    let currentUserId = userId;
    
    while (currentUserId) {
      const user = await User.findById(currentUserId);
      if (!user) break;
      
      chain.push(user);
      
      // Move to sponsor
      currentUserId = user.sponsor;
      
      // Prevent infinite loop
      if (chain.length > 20) break;
    }
    
    return chain;
  }

  // Get the count of members at a specific level for a user - FIXED VERSION
  static async getMembersCountAtLevel(userId, level) {
    try {
      if (level === 1) {
        // Level 1 = direct referrals (users who used this user's referral code)
        const user = await User.findById(userId);
        if (!user) return 0;
        return await User.countDocuments({ sponsorCode: user.referralCode });
      } else {
        // Level 2+ = use getTeamMembersAtLevel for accurate counting
        const teamMembers = await this.getTeamMembersAtLevel(userId, level);
        return teamMembers.length;
      }
    } catch (error) {
      console.error('Error getting members count at level:', error);
      return 0;
    }
  }

  // Helper function to get the level of a member relative to a user
  static async getMemberLevel(userId, memberId) {
    try {
      let level = 1;
      let currentUserId = memberId;
      
      while (currentUserId && currentUserId.toString() !== userId.toString()) {
        const user = await User.findById(currentUserId);
        if (!user || !user.sponsor) break;
        
        currentUserId = user.sponsor;
        level++;
      }
      
      return currentUserId && currentUserId.toString() === userId.toString() ? level : 0;
    } catch (error) {
      console.error('Error getting member level:', error);
      return 0;
    }
  }

  // Get all users in the sponsor chain (from sponsor to admin, excluding the new user)
  static async getSponsorChain(sponsorId) {
    const chain = [];
    let currentUserId = sponsorId;
    
    while (currentUserId) {
      const user = await User.findById(currentUserId);
      if (!user) break;
      
      chain.push(user);
      
      // Move to sponsor
      currentUserId = user.sponsor;
      
      // Prevent infinite loop
      if (chain.length > 20) break;
    }
    
    return chain;
  }

  // Auto-transfer pending missed earnings when levels get unlocked
  static async autoTransferMissedEarnings(sponsorId, newUserId, paymentTxHash) {
    try {
      
      
      // Get all users in the sponsor chain
      const chainUsers = await this.getSponsorChain(sponsorId);
      
      for (let i = 0; i < chainUsers.length; i++) {
        const chainUser = chainUsers[i];
        const earningLevel = i + 1;
        
        // Check if this level is now unlocked
        const isLevelUnlocked = await this.isLevelUnlocked(chainUser._id, earningLevel);
        
        if (isLevelUnlocked) {
          // Find pending missed earnings for this level
          const pendingMissedEarnings = await MissedLevelEarning.find({
            user: chainUser._id,
            level: earningLevel,
            status: 'pending'
          });
          
          if (pendingMissedEarnings.length > 0) {
          
            
            for (const missedEarning of pendingMissedEarnings) {
              // Check if earning already exists for this level to prevent duplicates
              const existingEarning = await Earning.findOne({
                user: chainUser._id,
                level: earningLevel,
                type: 'level_earning'
              });
              
              if (!existingEarning) {
                // Create regular earning for the missed amount
                const newEarning = new Earning({
                  user: chainUser._id,
                  fromUser: newUserId,
                  type: 'level_earning',
                  amount: missedEarning.amount,
                  description: `Level ${earningLevel} missed earning transferred: $${missedEarning.amount}`,
                  status: 'confirmed',
                  level: earningLevel,
                  commissionRate: 100,
                  paymentMethod: 'USDT',
                  txHash: paymentTxHash
                });
                
                await newEarning.save();
                console.log(`   ✅ Transferred $${missedEarning.amount} for level ${earningLevel}`);
              } else {
                console.log(`   ⚠️  Level ${earningLevel} earning already exists, skipping transfer`);
              }
              
              // Mark missed earning as transferred
              await MissedLevelEarning.findByIdAndUpdate(missedEarning._id, {
                status: 'transferred',
                amount: 0
              });
            }
            
            // Update user's total earnings
            await this.updateUserTotalEarnings(chainUser._id);
          }
        }
      }
    } catch (error) {
      console.error('Error in autoTransferMissedEarnings:', error);
    }
  }

  // Update user's total earnings from database
  static async updateUserTotalEarnings(userId) {
    try {
      const earnings = await Earning.find({ user: userId });
      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
      
      await User.findByIdAndUpdate(userId, {
        totalEarnings: totalEarnings,
        exactEarning: totalEarnings
      });
      
      console.log(`Updated total earnings for user ${userId}: $${totalEarnings}`);
    } catch (error) {
      console.error('Error updating user total earnings:', error);
    }
  }

  // Validate earnings calculation for a user
  static async validateUserEarnings(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return { isValid: false, error: 'User not found' };
      
      // Get direct referrals count
      const directReferralsCount = await this.getValidatedDirectReferralsCount(userId);
      
      // Calculate correct earnings
      let correctDirectEarnings = directReferralsCount * this.MLM_CONFIG.DIRECT_REFERRAL_BONUS;
      let correctLevelEarnings = 0;
      
      // Calculate level earnings for unlocked levels only
      for (let level = 1; level <= this.MLM_CONFIG.MAX_LEVELS; level++) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
        const isUnlocked = directReferralsCount >= requiredRefs;
        
        if (isUnlocked) {
          try {
            const teamMembers = await this.getTeamMembersAtLevel(userId, level);
            const levelEarning = teamMembers.length * 1; // $1 per member per level
            correctLevelEarnings += levelEarning;
          } catch (error) {
            console.log(`Error calculating level ${level} earnings: ${error.message}`);
          }
        }
      }
      
      const correctTotalEarnings = correctDirectEarnings + correctLevelEarnings;
      const currentEarnings = user.totalEarnings || 0;
      const difference = Math.abs(correctTotalEarnings - currentEarnings);
      
      return {
        isValid: difference < 0.01,
        currentEarnings,
        correctEarnings: correctTotalEarnings,
        difference,
        directReferralsCount,
        directEarnings: correctDirectEarnings,
        levelEarnings: correctLevelEarnings
      };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  // Fix existing users' missed earnings and total earnings - DISABLED TO PREVENT INCORRECT EARNINGS
  static async fixExistingUsersEarnings() {
    try {
      console.log('⚠️  fixExistingUsersEarnings is DISABLED to prevent incorrect earnings calculation');
      console.log('   Use comprehensiveEarningsFix.js script instead for manual fixes');
      return;
      
      // DISABLED CODE - This was causing incorrect earnings
      /*
      console.log('🔧 Fixing existing users earnings...');
      
      const users = await User.find({ isAdmin: { $ne: true } });
      
      for (const user of users) {
        console.log(`\n👤 Processing user: ${user.userId}`);
        
        // Get direct referrals count
        const directReferrals = await User.find({ sponsorCode: user.referralCode });
        const directRefsCount = directReferrals.length;
        
        console.log(`   Direct referrals: ${directRefsCount}`);
        
        // First, clean up duplicate earnings
        await this.cleanupDuplicateEarnings(user._id);
        
        // Fix wrong level earnings (move locked level earnings to missed earnings)
        await this.fixWrongLevelEarnings(user._id, directRefsCount);
        
        // Fix missing level earnings for unlocked levels
        await this.fixMissingLevelEarnings(user._id, directRefsCount);
        
        // Check for pending missed earnings that should be transferred
        for (let level = 1; level <= 15; level++) {
          const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
          
          if (directRefsCount >= requiredRefs) {
            const pendingMissedEarnings = await MissedLevelEarning.find({
              user: user._id,
              level: level,
              status: 'pending'
            });
            
            if (pendingMissedEarnings.length > 0) {
              console.log(`   ✅ Level ${level} unlocked - transferring ${pendingMissedEarnings.length} missed earnings`);
              
              for (const missedEarning of pendingMissedEarnings) {
                // Check if earning already exists for this level
                const existingEarning = await Earning.findOne({
                  user: user._id,
                  level: level,
                  type: 'level_earning'
                });
                
                if (!existingEarning) {
                  // Create regular earning only if it doesn't exist
                  const newEarning = new Earning({
                    user: user._id,
                    fromUser: user._id,
                    type: 'level_earning',
                    amount: missedEarning.amount,
                    description: `Level ${level} missed earning transferred: $${missedEarning.amount}`,
                    status: 'confirmed',
                    level: level,
                    commissionRate: 100,
                    paymentMethod: 'USDT'
                  });
                  
                  await newEarning.save();
                  console.log(`     ✅ Transferred $${missedEarning.amount} for level ${level}`);
                } else {
                  console.log(`     ⚠️  Level ${level} earning already exists, skipping transfer`);
                }
                
                // Mark as transferred
                await MissedLevelEarning.findByIdAndUpdate(missedEarning._id, {
                  status: 'transferred',
                  amount: 0
                });
              }
            }
          }
        }
        
        // Update total earnings
        await this.updateUserTotalEarnings(user._id);
        
        console.log(`   ✅ Updated total earnings for ${user.userId}`);
      }
      
      console.log('\n✅ All existing users earnings fixed!');
      */
    } catch (error) {
      console.error('Error fixing existing users earnings:', error);
    }
  }

  // Fix wrong level earnings - move locked level earnings to missed earnings
  static async fixWrongLevelEarnings(userId, directRefsCount) {
    try {
      console.log(`   🔍 Checking for wrong level earnings...`);
      
      // Get all level earnings for this user
      const levelEarnings = await Earning.find({
        user: userId,
        type: 'level_earning'
      });
      
      for (const earning of levelEarnings) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[earning.level];
        const isLevelUnlocked = directRefsCount >= requiredRefs;
        
        if (!isLevelUnlocked) {
          console.log(`   ⚠️  Level ${earning.level} earning $${earning.amount} should be missed (need ${requiredRefs}, have ${directRefsCount})`);
          
          // Check if missed earning already exists
          const existingMissedEarning = await MissedLevelEarning.findOne({
            user: userId,
            level: earning.level,
            status: 'pending'
          });
          
          if (!existingMissedEarning) {
            // Create missed earning
            const missedEarning = new MissedLevelEarning({
              user: userId,
              userId: userId, // Add userId field for validation
              level: earning.level,
              amount: earning.amount,
              description: `Level ${earning.level} missed earning: $${earning.amount}`,
              status: 'pending',
              createdAt: new Date()
            });
            
            await missedEarning.save();
            console.log(`     ✅ Created Level ${earning.level} missed earning: $${earning.amount}`);
          } else {
            console.log(`     ⚠️  Level ${earning.level} missed earning already exists`);
          }
          
          // Delete the wrong earning
          await Earning.findByIdAndDelete(earning._id);
          console.log(`     🗑️  Deleted wrong Level ${earning.level} earning: $${earning.amount}`);
        } else {
          console.log(`     ✅ Level ${earning.level} earning $${earning.amount} is correct`);
        }
      }
    } catch (error) {
      console.error('Error fixing wrong level earnings:', error);
    }
  }

  // Fix missing level earnings for unlocked levels
  static async fixMissingLevelEarnings(userId, directRefsCount) {
    try {
      console.log(`   🔍 Checking for missing level earnings...`);
      
      // Check each level for missing earnings
      for (let level = 1; level <= 15; level++) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
        
        if (directRefsCount >= requiredRefs) {
          // Level is unlocked, check if earning exists
          const existingEarning = await Earning.findOne({
            user: userId,
            level: level,
            type: 'level_earning'
          });
          
          if (!existingEarning) {
            // Calculate correct earning for this level
            try {
              const teamMembers = await this.getTeamMembersAtLevel(userId, level);
              const levelEarning = teamMembers.length * 1; // $1 per member
              
              if (levelEarning > 0) {
                const newEarning = new Earning({
                  user: userId,
                  fromUser: userId,
                  type: 'level_earning',
                  amount: levelEarning,
                  description: `Level ${level} earning: ${teamMembers.length} members × $1 = $${levelEarning}`,
                  status: 'confirmed',
                  level: level,
                  commissionRate: 100,
                  paymentMethod: 'USDT'
                });
                
                await newEarning.save();
                console.log(`     ✅ Created missing Level ${level} earning: $${levelEarning}`);
              }
            } catch (error) {
              console.log(`     ⚠️  Error creating Level ${level} earning: ${error.message}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fixing missing level earnings:', error);
    }
  }

  // Clean up duplicate earnings for a user
  static async cleanupDuplicateEarnings(userId) {
    try {
      console.log(`   🧹 Cleaning up duplicate earnings for user ${userId}`);
      
      // Get all level earnings grouped by level
      const levelEarnings = await Earning.find({
        user: userId,
        type: 'level_earning'
      });
      
      const levelGroups = {};
      levelEarnings.forEach(earning => {
        if (!levelGroups[earning.level]) {
          levelGroups[earning.level] = [];
        }
        levelGroups[earning.level].push(earning);
      });
      
      // Check for duplicates and remove them
      for (const [level, earnings] of Object.entries(levelGroups)) {
        if (earnings.length > 1) {
          console.log(`     ⚠️  Found ${earnings.length} duplicate earnings for level ${level}`);
          
          // Keep the first one, delete the rest
          const toKeep = earnings[0];
          const toDelete = earnings.slice(1);
          
          for (const duplicate of toDelete) {
            await Earning.findByIdAndDelete(duplicate._id);
            console.log(`     🗑️  Deleted duplicate earning: Level ${level}, Amount $${duplicate.amount}`);
          }
        }
      }
      
      // Clean up duplicate direct referral earnings
      const directEarnings = await Earning.find({
        user: userId,
        type: 'direct_referral'
      });
      
      if (directEarnings.length > 1) {
        console.log(`     ⚠️  Found ${directEarnings.length} duplicate direct referral earnings`);
        
        // Keep the first one, delete the rest
        const toKeep = directEarnings[0];
        const toDelete = directEarnings.slice(1);
        
        for (const duplicate of toDelete) {
          await Earning.findByIdAndDelete(duplicate._id);
          console.log(`     🗑️  Deleted duplicate direct referral earning: $${duplicate.amount}`);
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up duplicate earnings:', error);
    }
  }

  // Check if a level is unlocked for a user based on VALIDATED direct referrals
  static async isLevelUnlocked(userId, level) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;
      
      // Admin can always earn from all levels
      if (user.isAdmin) return true;
      
      // Get validated direct referrals count
      const directReferralsCount = await this.getValidatedDirectReferralsCount(userId);
      
      console.log(`🔍 Checking level ${level} unlock for user ${user.userId}: ${directReferralsCount} validated direct referrals`);
      
      // Check criteria based on direct referrals for all levels
      const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
      if (directReferralsCount >= requiredRefs) {
        console.log(`✅ Level ${level} unlocked: User has ${directReferralsCount} direct referrals (required: ${requiredRefs})`);
        return true;
      }
      
      console.log(`❌ Level ${level} locked: User has ${directReferralsCount} direct referrals (required: ${requiredRefs})`);
      return false;
    } catch (error) {
      console.error('Error checking level unlock:', error);
      return false;
    }
  }

  // Check if this is a missed wallet scenario
  static async checkMissedWalletScenario(userId, newUserId) {
    try {
      // This is a missed wallet scenario if:
      // 1. User doesn't have a wallet address
      // 2. User's level is higher than what they should be earning from
      // 3. User has missed previous earning opportunities
      
      const user = await User.findById(userId);
      if (!user) return false;
      
      // Check if user has wallet address
      if (!user.walletAddress) {
        return true;
      }
      
      // Check if user's current level is higher than their earning level
      const currentLevel = user.level || 1;
      const earningLevel = await this.getUserEarningLevel(userId);
      
      if (currentLevel > earningLevel) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking missed wallet scenario:', error);
      return false;
    }
  }

  // Process real-time missed wallet earnings for admin when new user registers
  static async processRealTimeMissedWalletEarnings(newUserId, sponsorId, adminId, paymentTxHash) {
    try {
      const earnings = [];
      
      // Get the sponsor chain for this new user
      const sponsorChain = await this.getSponsorChain(sponsorId);
      
      // Find admin's position in the sponsor chain
      let adminPosition = -1;
      for (let i = 0; i < sponsorChain.length; i++) {
        if (sponsorChain[i]._id.toString() === adminId.toString()) {
          adminPosition = i + 1; // Level 1, 2, 3, etc.
          break;
        }
      }
      
      console.log(`Admin position in sponsor chain: ${adminPosition}`);
      
      if (adminPosition > 0) {
        // Check what admin has already earned from this new user
        const existingEarnings = await Earning.find({
          user: adminId,
          fromUser: newUserId,
          type: { $in: ['level_earning', 'missed_wallet'] }
        });
        
        const existingTotal = existingEarnings.reduce((sum, e) => sum + e.amount, 0);
        const expectedEarning = 1; // $1 per level
        
        console.log(`Admin existing earnings from new user: $${existingTotal}`);
        console.log(`Admin expected earning: $${expectedEarning}`);
        
        if (existingTotal < expectedEarning) {
          const missedAmount = expectedEarning - existingTotal;
          
          const missedEarning = {
            userId: adminId,
            amount: missedAmount,
            type: 'missed_wallet',
            level: adminPosition,
            description: `Missed wallet - Level ${adminPosition} earning from new user ($${missedAmount})`,
            fromUser: newUserId,
            paymentTxHash: paymentTxHash,
            commissionRate: (missedAmount / this.MLM_CONFIG.REGISTRATION_FEE) * 100,
            paymentMethod: 'USDT'
          };
          
          earnings.push(missedEarning);
          console.log(`Created real-time missed wallet earning: $${missedAmount} for level ${adminPosition}`);
        } else {
          console.log(`Admin already has sufficient earnings from new user`);
        }
      } else {
        console.log(`Admin not in sponsor chain for new user`);
      }
      
      return earnings;
    } catch (error) {
      console.error('Error processing real-time missed wallet earnings:', error);
      return [];
    }
  }


  // Process missed wallet earnings after new user registration
  static async processMissedWalletAfterRegistration(newUserId, sponsorId) {
    try {
      console.log(`\n🔄 Processing missed wallet after registration for new user: ${newUserId}`);
      
      const affectedUsers = new Set();
      
      // 1. Add sponsor to affected users
      if (sponsorId) {
        affectedUsers.add(sponsorId.toString());
        
        // 2. Add sponsor's sponsor chain (up to 15 levels)
        const sponsorChain = await this.getSponsorChain(sponsorId);
        sponsorChain.forEach(user => {
          if (user._id.toString() !== newUserId.toString()) {
            affectedUsers.add(user._id.toString());
          }
        });
      }
      
      // 3. Add admin if not already in the chain
      const admin = await User.findOne({ isAdmin: true });
      if (admin) {
        affectedUsers.add(admin._id.toString());
      }
      
      console.log(`   Affected users: ${affectedUsers.size}`);
      
      // 4. Process missed wallet for all affected users
      let totalProcessed = 0;
      let totalAmount = 0;
      
      for (const userId of affectedUsers) {
        try {
          const user = await User.findById(userId);
          if (!user || user.isAdmin) {
            continue; // Skip admin users
          }
          
          const processedEarnings = await this.processMissedWalletEarnings(userId);
          if (processedEarnings.length > 0) {
            totalProcessed += processedEarnings.length;
            totalAmount += processedEarnings.reduce((sum, earning) => sum + earning.amount, 0);
            console.log(`   ✅ ${user.username}: ${processedEarnings.length} missed wallet earnings`);
          }
        } catch (error) {
          console.error(`   ❌ Error processing ${userId}:`, error.message);
        }
      }
      
      console.log(`   📊 Total processed: ${totalProcessed} missed wallet earnings, $${totalAmount.toFixed(2)}`);
      return { totalProcessed, totalAmount };
      
    } catch (error) {
      console.error('Error processing missed wallet after registration:', error);
      return { totalProcessed: 0, totalAmount: 0 };
    }
  }

  // Process missed wallet earnings for users who missed previous opportunities - IMPROVED VERSION
  static async processMissedWalletEarnings(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found for missed wallet processing');
        return [];
      }
      
      // Skip admin users - they don't participate in missed wallet system
      if (user.isAdmin) {
        console.log(`Admin user ${user.username} - skipping missed wallet processing`);
        return [];
      }
      
      console.log(`\n💰 Processing missed wallet earnings for: ${user.username} (User)`);
      
      const earnings = [];
      const admin = await User.findOne({ isAdmin: true });
      
      // Get user's earning level (for reference, but calculateMissedEarnings will determine unlocked levels)
      const earningLevel = await this.getUserEarningLevel(userId);
      console.log(`   User earning level: ${earningLevel}`);
      
      // Check if user has missed any earning opportunities (now uses proper level unlocking logic)
      const missedEarnings = await this.calculateMissedEarnings(userId, earningLevel);
      
      if (missedEarnings.length > 0) {
        console.log(`   ✅ Found ${missedEarnings.length} missed wallet opportunities`);
        
        // Create missed wallet earnings with better validation
        for (const missedEarning of missedEarnings) {
          // Double-check that this earning doesn't already exist
          const existingEarning = await Earning.findOne({
            user: userId,
            level: missedEarning.level,
            type: 'missed_wallet',
            amount: missedEarning.amount
          });
          
          if (existingEarning) {
            console.log(`   ⚠️  Skipping duplicate missed wallet earning for level ${missedEarning.level}`);
            continue;
          }
          
          const earning = {
            userId: userId,
            amount: missedEarning.amount,
            type: 'missed_wallet',
            level: missedEarning.level,
            description: `Missed wallet - Level ${missedEarning.level} earning ($${missedEarning.amount}) from ${missedEarning.membersCount} members`,
            referralId: null,
            paymentTxHash: 'MISSED_WALLET_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            commissionRate: (missedEarning.amount / this.MLM_CONFIG.REGISTRATION_FEE) * 100,
            paymentMethod: 'USDT',
            status: 'completed',
            processedAt: new Date(),
            metadata: {
              membersCount: missedEarning.membersCount,
              expectedTotal: missedEarning.expectedTotal,
              alreadyEarned: missedEarning.alreadyEarned,
              members: missedEarning.members || []
            }
          };
          
          earnings.push(earning);
          console.log(`   ✅ Created missed wallet earning: Level ${missedEarning.level}, Amount: $${missedEarning.amount}`);
        }
        
        // Save missed wallet earnings
        if (earnings.length > 0) {
          console.log(`   💾 Saving ${earnings.length} missed wallet earnings...`);
          
          for (const earning of earnings) {
            try {
              await this.createEarning(earning);
              console.log(`     ✅ Saved: Level ${earning.level}, $${earning.amount}`);
            } catch (error) {
              console.error(`     ❌ Failed to save earning for level ${earning.level}:`, error.message);
            }
          }
          
          // Update user earnings
          try {
            await this.updateUserEarnings(earnings);
            console.log(`   ✅ Updated user earnings successfully`);
          } catch (error) {
            console.error(`   ❌ Failed to update user earnings:`, error.message);
          }
        }
      } else {
        console.log(`   ℹ️  No missed wallet earnings found for user ${user.username}`);
      }
      
      console.log(`   📊 Total processed: ${earnings.length} missed wallet earnings`);
      return earnings;
    } catch (error) {
      console.error('Error processing missed wallet earnings:', error);
      return [];
    }
  }

  // Calculate missed earnings for a user - IMPROVED VERSION
  static async calculateMissedEarnings(userId, earningLevel) {
    try {
      const missedEarnings = [];
      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found for missed earnings calculation');
        return [];
      }
      
      console.log(`\n🔍 Calculating missed earnings for: ${user.username} (${user.isAdmin ? 'Admin' : 'User'})`);
      
      // Get direct referrals count
      const directReferralsCount = await User.countDocuments({ sponsor: userId });
      console.log(`   Direct referrals: ${directReferralsCount}`);
      
      // Determine which levels are actually unlocked based on proper criteria
      let unlockedLevels = [];
      
      if (user.isAdmin) {
        // Admin doesn't participate in missed wallet system
        console.log(`   Admin user - skipping missed wallet calculation`);
        return [];
      } else {
        // Regular users: use consistent level unlocking logic
        for (let level = 1; level <= 15; level++) {
          // Use the same logic as isLevelUnlocked function
          const isUnlocked = await this.isLevelUnlocked(userId, level);
          
          if (isUnlocked) {
            unlockedLevels.push(level);
          }
        }
        console.log(`   User unlocked levels: ${unlockedLevels.join(',')}`);
      }
      
      // Calculate missed earnings for each unlocked level
      for (const level of unlockedLevels) {
        const membersAtLevel = await this.getTeamMembersAtLevel(userId, level);
        const levelEarning = this.MLM_CONFIG.LEVEL_EARNINGS[level] || 0;
        
        console.log(`   Level ${level}: ${membersAtLevel.length} members, $${levelEarning} per member`);
        
        if (levelEarning > 0 && membersAtLevel.length > 0) {
          // Check existing earnings for this level (both level_earning and missed_wallet)
          const existingEarnings = await Earning.find({
            user: userId,
            level: level,
            type: { $in: ['level_earning', 'missed_wallet', 'direct_referral'] }
          });
          
          const totalEarned = existingEarnings.reduce((sum, earning) => sum + earning.amount, 0);
          const expectedEarnings = Math.floor(levelEarning * membersAtLevel.length); // Whole numbers only
          
          console.log(`     Expected: $${expectedEarnings}, Already earned: $${totalEarned}`);
          
          if (totalEarned < expectedEarnings) {
            const missedAmount = Math.floor(expectedEarnings - totalEarned); // Whole numbers only
            
            // Additional validation: Check if this is a legitimate missed earning
            const isLegitimateMissedEarning = await this.validateMissedEarning(userId, level, membersAtLevel, existingEarnings);
            
            if (isLegitimateMissedEarning) {
              missedEarnings.push({
                level: level,
                amount: missedAmount,
                membersCount: membersAtLevel.length,
                expectedTotal: expectedEarnings,
                alreadyEarned: totalEarned,
                members: membersAtLevel.map(m => ({
                  id: m._id,
                  username: m.username,
                  firstName: m.firstName,
                  lastName: m.lastName
                }))
              });
              
              console.log(`     ✅ MISSED: $${missedAmount} for level ${level}`);
            } else {
              console.log(`     ⚠️  Skipped: Not a legitimate missed earning`);
            }
          } else {
            console.log(`     ✅ Sufficient earnings already exist`);
          }
        }
      }
      
      console.log(`   Total missed earnings found: ${missedEarnings.length}`);
      return missedEarnings;
    } catch (error) {
      console.error('Error calculating missed earnings:', error);
      return [];
    }
  }

  // Validate if a missed earning is legitimate
  static async validateMissedEarning(userId, level, membersAtLevel, existingEarnings) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;
      
      // Admin users don't participate in missed wallet system
      if (user.isAdmin) {
        return false;
      }
      
      // Regular users: original validation logic
      // Check if user has been active (has team members)
      if (membersAtLevel.length === 0) {
        return false;
      }
      
      // Check if this is a recent addition (members joined recently)
      const recentMembers = membersAtLevel.filter(member => {
        const joinDate = new Date(member.createdAt || member.registrationDate);
        const daysSinceJoin = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceJoin > 1; // Members joined more than 1 day ago
      });
      
      if (recentMembers.length === 0) {
        return false;
      }
      
      // Check if existing earnings are from a different time period
      const existingEarningsFromMembers = existingEarnings.filter(earning => {
        return membersAtLevel.some(member => 
          earning.referralId && earning.referralId.toString() === member._id.toString()
        );
      });
      
      // If no existing earnings from these specific members, it's a missed earning
      return existingEarningsFromMembers.length === 0;
    } catch (error) {
      console.error('Error validating missed earning:', error);
      return false;
    }
  }

  // Calculate indirect earnings for team members (5%) - DEPRECATED, use calculateLevelBasedEarnings
  static async calculateIndirectEarnings(newUserId, sponsorId, registrationFee, paymentTxHash) {
    const earnings = [];
    
    try {
      // Get the new user
      const newUser = await User.findById(newUserId);
      if (!newUser || !newUser.sponsor) return earnings;
      
      // Find the direct referral who brought this new user
      const directReferral = await User.findById(newUser.sponsor);
      if (!directReferral || !directReferral.sponsor) return earnings;
      
      // The indirect earning goes to the sponsor of the direct referral
      // So if User3 is sponsored by User2, and User2 is sponsored by User1,
      // then User1 should get the indirect earning
      const indirectEarningUserId = directReferral.sponsor;
      
      // Calculate indirect earning (5% of $20 = $1)
      const indirectEarning = this.MLM_CONFIG.INDIRECT_EARNING_AMOUNT;
      
      // Get the level of the user who should receive indirect earnings
      const indirectEarningLevel = await this.getUserLevel(indirectEarningUserId);
      
      console.log(`Indirect earning: User ${indirectEarningUserId} (level ${indirectEarningLevel}) gets $${indirectEarning} from ${directReferral.walletAddress}'s referral of ${newUser.walletAddress}`);
      
      // The sponsor of the direct referral gets earnings from this indirect referral
      earnings.push({
        userId: indirectEarningUserId,
        amount: indirectEarning,
        type: 'indirect_referral',
        level: indirectEarningLevel,
        description: `Indirect earning from ${directReferral.walletAddress}'s referral ($${indirectEarning} - 5%)`,
        referralId: newUserId,
        paymentTxHash,
        commissionRate: this.MLM_CONFIG.INDIRECT_EARNING_PERCENTAGE,
        paymentMethod: 'USDT'
      });
      
      return earnings;
    } catch (error) {
      console.error('Error in calculateIndirectEarnings:', error);
      return earnings;
    }
  }



  // Get validated direct referrals list (same logic as getValidatedDirectReferralsCount but returns list)
  static async getValidatedDirectReferralsList(userId) {
    try {
      console.log(`🔍 Getting validated direct referrals list for user: ${userId}`);
      
      // Get sponsor's referral code for validation
      const sponsor = await User.findById(userId).select('referralCode userId');
      if (!sponsor) {
        console.log(`❌ Sponsor not found for userId: ${userId}`);
        return [];
      }

      console.log(`📋 Sponsor referral code: ${sponsor.referralCode}`);

      // Method 1: Get users who have this user as sponsor
      const claimedReferrals = await User.find({ sponsor: userId }).select('firstName lastName username email userId sponsorCode createdAt position totalEarnings').sort({ position: 1, createdAt: 1 });
      console.log(`📊 Found ${claimedReferrals.length} users with sponsor: ${userId}`);

      // Method 2: Get users who used this sponsor's referral code (case-insensitive)
      const referralCodeUsers = await User.find({ 
        $or: [
          { sponsorCode: sponsor.referralCode },
          { sponsorCode: { $regex: new RegExp(`^${sponsor.referralCode}$`, 'i') } }
        ]
      }).select('firstName lastName username email userId sponsorCode createdAt position totalEarnings totalWithdrawn isActive walletAddress referralCode').sort({ position: 1, createdAt: 1 });
      console.log(`📊 Found ${referralCodeUsers.length} users with sponsorCode: ${sponsor.referralCode}`);

      // Method 3: Use referralCodeUsers as primary source (all users who used this referral code)
      const validatedReferrals = [];
      const seenIds = new Set(); // Track seen user IDs to prevent duplicates
      
      // Get sponsor creation date for validation
      const sponsorUser = await User.findById(userId).select('createdAt');
      
      for (const ref of referralCodeUsers) {
        // Skip if we've already processed this user
        if (seenIds.has(ref._id.toString())) {
          console.log(`⏭️ Skipping duplicate user: ${ref.firstName} ${ref.lastName} (@${ref.username})`);
          continue;
        }
        
        // Check if user was registered after sponsor
        const isRegisteredAfterSponsor = sponsorUser && ref.createdAt > sponsorUser.createdAt;
        
        // Check if user has correct sponsorCode (case-insensitive)
        const hasCorrectSponsorCode = ref.sponsorCode && sponsor.referralCode && 
          ref.sponsorCode.toLowerCase() === sponsor.referralCode.toLowerCase();
        
        // Check if user has this sponsor as their sponsor field (direct child)
        const hasCorrectSponsorField = ref.sponsor && ref.sponsor.toString() === userId.toString();
        
        console.log(`🔍 Validating referral: ${ref.firstName} ${ref.lastName} (@${ref.username})`);
        console.log(`   - userId: ${ref.userId || 'Not Set'}`);
        console.log(`   - sponsorCode: ${ref.sponsorCode}`);
        console.log(`   - sponsor.referralCode: ${sponsor.referralCode}`);
        console.log(`   - hasCorrectSponsorCode: ${hasCorrectSponsorCode}`);
        console.log(`   - isRegisteredAfterSponsor: ${isRegisteredAfterSponsor}`);
        console.log(`   - hasCorrectSponsorField: ${hasCorrectSponsorField}`);
        
        // Accept if user used this referral code and registered after sponsor
        if (hasCorrectSponsorCode && isRegisteredAfterSponsor) {
          validatedReferrals.push(ref);
          seenIds.add(ref._id.toString());
          console.log(`✅ Validated referral: ${ref.firstName} ${ref.lastName} (@${ref.username}) - Method: ReferralCode`);
        } else if (hasCorrectSponsorField && isRegisteredAfterSponsor) {
          validatedReferrals.push(ref);
          seenIds.add(ref._id.toString());
          console.log(`✅ Validated referral: ${ref.firstName} ${ref.lastName} (@${ref.username}) - Method: DirectChild`);
        } else {
          console.log(`❌ Invalid referral: ${ref.firstName} ${ref.lastName} (@${ref.username}) - Validation failed`);
        }
      }
      
      console.log(`🎯 Final validated referrals list count: ${validatedReferrals.length}`);
      
      return validatedReferrals;
    } catch (error) {
      console.error('❌ Error getting validated direct referrals list:', error);
      return [];
    }
  }

  // Debug function to check validation for specific user
  static async debugUserValidation(userId) {
    try {
      console.log(`🔍 DEBUG: Checking validation for user: ${userId}`);
      
      // Get user by userId instead of _id
      const user = await User.findOne({ userId: userId });
      if (!user) {
        console.log(`❌ User not found with userId: ${userId}`);
        return { error: 'User not found' };
      }
      
      console.log(`📋 Found user: ${user.userId} (${user.firstName} ${user.lastName})`);
      console.log(`📋 User referralCode: ${user.referralCode}`);
      console.log(`📋 User _id: ${user._id}`);
      
      // Get users who have this user as sponsor
      const claimedReferrals = await User.find({ sponsor: user._id }).select('firstName lastName username email userId sponsorCode createdAt sponsor');
      console.log(`📊 Found ${claimedReferrals.length} users with sponsor: ${user._id}`);
      
      // Get users who used this sponsor's referral code
      const referralCodeUsers = await User.find({ 
        $or: [
          { sponsorCode: user.referralCode },
          { sponsorCode: { $regex: new RegExp(`^${user.referralCode}$`, 'i') } }
        ]
      }).select('firstName lastName username email userId sponsorCode createdAt sponsor');
      console.log(`📊 Found ${referralCodeUsers.length} users with sponsorCode: ${user.referralCode}`);
      
      // Detailed validation for each claimed referral
      const validationResults = [];
      for (const claimedRef of claimedReferrals) {
        const hasCorrectSponsorCode = claimedRef.sponsorCode && user.referralCode && 
          claimedRef.sponsorCode.toLowerCase() === user.referralCode.toLowerCase();
        
        const existsInReferralCodeUsers = referralCodeUsers.some(ref => ref._id.toString() === claimedRef._id.toString());
        
        const isFallbackValid = !claimedRef.sponsorCode && existsInReferralCodeUsers;
        
        const isRegisteredAfterSponsor = user.createdAt && claimedRef.createdAt > user.createdAt;
        
        const hasCorrectSponsorField = claimedRef.sponsor && claimedRef.sponsor.toString() === user._id.toString();
        
        const isValid = (hasCorrectSponsorCode && existsInReferralCodeUsers) || 
                       (isFallbackValid && isRegisteredAfterSponsor) ||
                       (hasCorrectSponsorField && isRegisteredAfterSponsor);
        
        validationResults.push({
          userId: claimedRef.userId,
          firstName: claimedRef.firstName,
          lastName: claimedRef.lastName,
          username: claimedRef.username,
          sponsorCode: claimedRef.sponsorCode,
          sponsor: claimedRef.sponsor,
          createdAt: claimedRef.createdAt,
          hasCorrectSponsorCode,
          existsInReferralCodeUsers,
          isFallbackValid,
          isRegisteredAfterSponsor,
          hasCorrectSponsorField,
          isValid
        });
        
        console.log(`🔍 ${claimedRef.userId}: isValid=${isValid}, sponsorCode=${claimedRef.sponsorCode}, sponsor=${claimedRef.sponsor}`);
      }
      
      return {
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          referralCode: user.referralCode,
          _id: user._id,
          createdAt: user.createdAt
        },
        claimedReferrals: claimedReferrals.length,
        referralCodeUsers: referralCodeUsers.length,
        validationResults
      };
    } catch (error) {
      console.error('❌ Debug validation error:', error);
      return { error: error.message };
    }
  }

  // Get validated direct referrals count (same logic as in users.js)
  static async getValidatedDirectReferralsCount(userId) {
    try {
      console.log(`🔍 Validating direct referrals for user: ${userId}`);
      
      // Get sponsor's referral code for validation
      const sponsor = await User.findById(userId).select('referralCode userId');
      if (!sponsor) {
        console.log(`❌ Sponsor not found for userId: ${userId}`);
        return 0;
      }

      console.log(`📋 Sponsor referral code: ${sponsor.referralCode}`);

      // Method 1: Get users who have this user as sponsor
      const claimedReferrals = await User.find({ sponsor: userId }).select('firstName lastName username email userId sponsorCode createdAt');
      console.log(`📊 Found ${claimedReferrals.length} users with sponsor: ${userId}`);

      // Method 2: Get users who used this sponsor's referral code (case-insensitive)
      const referralCodeUsers = await User.find({ 
        $or: [
          { sponsorCode: sponsor.referralCode },
          { sponsorCode: { $regex: new RegExp(`^${sponsor.referralCode}$`, 'i') } }
        ]
      }).select('firstName lastName username email userId sponsorCode createdAt');
      console.log(`📊 Found ${referralCodeUsers.length} users with sponsorCode: ${sponsor.referralCode}`);

      // Method 3: Use referralCodeUsers as primary source (more reliable)
      const validatedReferrals = [];
      const processedIds = new Set();
      
      // Process referralCodeUsers first (most reliable)
      for (const refUser of referralCodeUsers) {
        if (!processedIds.has(refUser._id.toString())) {
          // Additional validation: Check if user was registered after sponsor
          const sponsorUser = await User.findById(userId).select('createdAt');
          const isRegisteredAfterSponsor = sponsorUser && refUser.createdAt > sponsorUser.createdAt;
          
          if (isRegisteredAfterSponsor) {
            validatedReferrals.push(refUser);
            processedIds.add(refUser._id.toString());
            console.log(`✅ Validated referral: ${refUser.firstName} ${refUser.lastName} (@${refUser.username}) - Method: ReferralCode`);
          } else {
            console.log(`❌ Invalid referral: ${refUser.firstName} ${refUser.lastName} (@${refUser.username}) - Registered before sponsor`);
          }
        }
      }
      
      // Process claimedReferrals as backup (for users who might have sponsor field but missing sponsorCode)
      for (const claimedRef of claimedReferrals) {
        if (!processedIds.has(claimedRef._id.toString())) {
          // Check if this user also has the correct sponsorCode (case-insensitive)
          const hasCorrectSponsorCode = claimedRef.sponsorCode && sponsor.referralCode && 
            claimedRef.sponsorCode.toLowerCase() === sponsor.referralCode.toLowerCase();
          
          // Additional validation: Check if user was registered after sponsor
          const sponsorUser = await User.findById(userId).select('createdAt');
          const isRegisteredAfterSponsor = sponsorUser && claimedRef.createdAt > sponsorUser.createdAt;
          
          // Enhanced validation: Check if user has this sponsor as their sponsor field
          const hasCorrectSponsorField = claimedRef.sponsor && claimedRef.sponsor.toString() === userId.toString();
          
          if ((hasCorrectSponsorCode && isRegisteredAfterSponsor) ||
              (hasCorrectSponsorField && isRegisteredAfterSponsor)) {
            validatedReferrals.push(claimedRef);
            processedIds.add(claimedRef._id.toString());
            console.log(`✅ Validated referral: ${claimedRef.firstName} ${claimedRef.lastName} (@${claimedRef.username}) - Method: ${hasCorrectSponsorCode ? 'Standard' : 'SponsorField'}`);
          } else {
            console.log(`❌ Invalid referral: ${claimedRef.firstName} ${claimedRef.lastName} (@${claimedRef.username}) - All validation failed`);
          }
        }
      }
      
      console.log(`🎯 Final validated referrals count: ${validatedReferrals.length}`);
      
      return validatedReferrals.length;
    } catch (error) {
      console.error('❌ Error validating direct referrals:', error);
      return 0;
    }
  }

  // Get user's current level based on direct referrals ONLY
  static async getUserLevel(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return 1;
      
      // Admin is always level 1
      if (user.isAdmin) return 1;
      
      // Get direct referrals count using validation function
      const directReferralsCount = await this.getValidatedDirectReferralsCount(userId);
      
      console.log(`🔍 User ${user.userId}: ${directReferralsCount} validated direct referrals`);
      
      // Check level unlocking criteria based ONLY on direct referrals
      let maxUnlockedLevel = 1;
      
      // Check all levels based on LEVEL_CRITERIA
      for (let level = 1; level <= 15; level++) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
        if (directReferralsCount >= requiredRefs) {
          maxUnlockedLevel = level;
          console.log(`✅ User ${user.userId}: Unlocked level ${level} with ${directReferralsCount} direct referrals (required: ${requiredRefs})`);
        }
      }
      
      // Update user's level in database if it has changed
      const currentLevel = user.level || 1;
      if (maxUnlockedLevel > currentLevel) {
        await User.findByIdAndUpdate(userId, { level: maxUnlockedLevel });
        console.log(`📈 User ${user.userId}: Level updated from ${currentLevel} to ${maxUnlockedLevel}`);
      }
      
      return maxUnlockedLevel;
    } catch (error) {
      console.error('Error getting user level:', error);
      return 1;
    }
  }

  // Get user's earning level (different from current level)
  static async getUserEarningLevel(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return 1;
      
      // Admin can earn from all levels
      if (user.isAdmin) return 15;
      
      // Get direct referrals count
      const directReferralsCount = await User.countDocuments({ sponsor: userId });
      
      // Calculate earning level based on referrals
      let earningLevel = 1;
      
      // Special case: 2 direct referrals unlock levels 2-4
      if (directReferralsCount >= 2) {
        earningLevel = 4;
      }
      
      // Special case: Full 15 levels auto-unlock when team size reaches 100
      const totalTeamSize = await this.getTotalTeamSize(userId);
      if (totalTeamSize >= 100) {
        earningLevel = 15;
      } else {
        // Check other criteria
        for (let level = 5; level <= 15; level++) {
          const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
          if (directReferralsCount >= requiredRefs) {
            earningLevel = level;
          }
        }
      }
      
      return earningLevel;
    } catch (error) {
      console.error('Error getting user earning level:', error);
      return 1;
    }
  }

  // Get total team size (all levels)
  static async getTotalTeamSize(userId) {
    try {
      const allMembers = await this.getAllTeamMembers(userId, 15);
      return allMembers.length;
    } catch (error) {
      console.error('Error getting total team size:', error);
      return 0;
    }
  }

  // Check if binary tree is complete at given level
  static async isBinaryTreeComplete(userId, level) {
    try {
      const requiredTeamSize = this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[level];
      if (!requiredTeamSize) return false;
      
      // Get total team members at this level and below
      const teamMembers = await this.getTeamMembersAtLevel(userId, level);
      
      return teamMembers.length >= requiredTeamSize;
    } catch (error) {
      console.error('Error checking binary tree completion:', error);
      return false;
    }
  }

  // Get team members at specific level - IMPROVED VERSION
  static async getTeamMembersAtLevel(userId, targetLevel) {
    try {
      const members = [];
      const visited = new Set(); // Prevent infinite loops
      const queue = [{ userId, level: 0, path: [] }];
      
      while (queue.length > 0) {
        const { userId: currentUserId, level, path } = queue.shift();
        
        // Prevent infinite loops
        if (visited.has(currentUserId.toString())) {
          continue;
        }
        visited.add(currentUserId.toString());
        
        if (level === targetLevel) {
          const user = await User.findById(currentUserId);
          if (user && !user.isAdmin) { // Don't include admin in team members
            members.push({
              ...user.toObject(),
              path: path, // Include path for debugging
              level: level
            });
          }
        } else if (level < targetLevel) {
          // Get direct referrals using sponsorCode field (correct field)
          const currentUser = await User.findById(currentUserId);
          if (!currentUser) continue;
          
          const directReferrals = await User.find({ 
            sponsorCode: currentUser.referralCode,
            isAdmin: { $ne: true } // Exclude admin users
          }).sort({ createdAt: 1 }); // Sort by creation time for consistent ordering
          
          for (let i = 0; i < directReferrals.length; i++) {
            const referral = directReferrals[i];
            const newPath = [...path, {
              userId: referral._id,
              username: referral.username,
              position: i === 0 ? 'left' : 'right' // First referral is left, second is right
            }];
            
            queue.push({ 
              userId: referral._id, 
              level: level + 1,
              path: newPath
            });
          }
        }
      }
      
      return members;
    } catch (error) {
      console.error('Error getting team members at level:', error);
      return [];
    }
  }

  // Create earning record
  static async createEarning(earningData) {
    try {
      const earning = new Earning({
        user: earningData.userId,
        fromUser: earningData.fromUser || earningData.referralId,
        amount: earningData.amount,
        type: earningData.type,
        level: earningData.level || 1, // Ensure minimum level is 1
        description: earningData.description,
        commissionRate: earningData.commissionRate || 0,
        paymentMethod: earningData.paymentMethod || 'USDT',
        txHash: earningData.paymentTxHash,
        status: 'completed'
      });

      await earning.save();
      return earning;
    } catch (error) {
      console.error('Error creating earning:', error);
      throw error;
    }
  }

  // Update user earnings
  static async updateUserEarnings(earnings) {
    try {
      const userEarnings = {};
      
      // Group earnings by user
      for (const earning of earnings) {
        if (!userEarnings[earning.userId]) {
          userEarnings[earning.userId] = 0;
        }
        userEarnings[earning.userId] += earning.amount;
      }

      // Update each user's total earnings
      for (const [userId, totalAmount] of Object.entries(userEarnings)) {
        await User.findByIdAndUpdate(userId, {
          $inc: { totalEarnings: totalAmount }
        });
      }

    } catch (error) {
      console.error('Error updating user earnings:', error);
      throw error;
    }
  }

  // Update user levels based on tree structure
  static async updateUserLevels(newUserId) {
    try {
      console.log('🔄 Updating all user levels...');
      
      // Get all users and update their levels
      const users = await User.find({ isAdmin: false, isActive: true });
      let totalUpdated = 0;
      
      for (const user of users) {
        try {
          const newLevel = await this.getUserLevel(user._id);
          if (user.level !== newLevel) {
            await User.findByIdAndUpdate(user._id, { level: newLevel });
            console.log(`✅ Updated ${user.username || user.userId} level from ${user.level || 1} to ${newLevel}`);
            totalUpdated++;
          }
        } catch (error) {
          console.error(`Error updating level for user ${user.userId}:`, error);
        }
      }
      
      console.log(`📊 Level update completed: ${totalUpdated} users updated`);
    } catch (error) {
      console.error('Error updating user levels:', error);
      throw error;
    }
  }

  // Force update a specific user's level
  static async forceUpdateUserLevel(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      console.log(`🔄 Force updating level for user: ${user.username || user.userId}`);
      
      // Get direct referrals count
      const directReferralsCount = await User.countDocuments({ 
        sponsor: userId, 
        isAdmin: { $ne: true } 
      });
      
      console.log(`   Direct Referrals: ${directReferralsCount}`);
      console.log(`   Current Level: ${user.level || 1}`);
      
      // Calculate correct level
      let correctLevel = 1;
      
      // Special case: 2 direct referrals unlock levels 2-4
      if (directReferralsCount >= 2) {
        correctLevel = 4;
      }
      
      // Check levels 5-15
      for (let level = 5; level <= 15; level++) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
        if (directReferralsCount >= requiredRefs) {
          correctLevel = level;
        } else {
          break;
        }
      }
      
      console.log(`   Correct Level: ${correctLevel}`);
      
      // Force update the level
      await User.findByIdAndUpdate(userId, { level: correctLevel });
      
      console.log(`✅ Force updated ${user.username || user.userId} level to ${correctLevel}`);
      
      return correctLevel;
    } catch (error) {
      console.error('Error force updating user level:', error);
      throw error;
    }
  }

  // Get user's direct referrals (left-right combination)
  static async getDirectReferrals(userId) {
    try {
      const directReferrals = await User.find({ sponsor: userId })
        .select('_id userId firstName lastName username referralCode registrationDate walletAddress totalEarnings')
        .sort({ registrationDate: 1 }); // Left to right order

      return {
        count: directReferrals.length,
        referrals: directReferrals
      };
    } catch (error) {
      console.error('Error getting direct referrals:', error);
      throw error;
    }
  }

  // Find empty nodes in the tree structure for placing additional referrals
  static findEmptyNodes(node, currentLevel = 0, maxLevel = 15) {
    const emptyNodes = [];
    
    if (!node || currentLevel >= maxLevel) {
      return emptyNodes;
    }
    
    // If node has no left child, it's an empty spot
    if (!node.leftChild) {
      emptyNodes.push({
        parentId: node._id,
        parentUserId: node.userId,
        position: 'left',
        level: currentLevel + 1,
        path: `${node.userId} -> LEFT`
      });
    }
    
    // If node has no right child, it's an empty spot
    if (!node.rightChild) {
      emptyNodes.push({
        parentId: node._id,
        parentUserId: node.userId,
        position: 'right',
        level: currentLevel + 1,
        path: `${node.userId} -> RIGHT`
      });
    }
    
    // Recursively find empty nodes in children
    if (node.leftChild) {
      emptyNodes.push(...this.findEmptyNodes(node.leftChild, currentLevel + 1, maxLevel));
    }
    if (node.rightChild) {
      emptyNodes.push(...this.findEmptyNodes(node.rightChild, currentLevel + 1, maxLevel));
    }
    
    return emptyNodes;
  }

  // Place a node in the tree structure at the specified empty node location
  static placeNodeInTree(rootNode, emptyNode, newNode) {
    if (!rootNode || !emptyNode) return false;
    
    // Find the parent node by traversing the tree
    const findParentNode = (node, targetParentId) => {
      if (!node) return null;
      
      if (node._id.toString() === targetParentId.toString()) {
        return node;
      }
      
      // Search in left subtree
      if (node.leftChild) {
        const leftResult = findParentNode(node.leftChild, targetParentId);
        if (leftResult) return leftResult;
      }
      
      // Search in right subtree
      if (node.rightChild) {
        const rightResult = findParentNode(node.rightChild, targetParentId);
        if (rightResult) return rightResult;
      }
      
      return null;
    };
    
    const parentNode = findParentNode(rootNode, emptyNode.parentId);
    
    if (parentNode) {
      if (emptyNode.position === 'left') {
        parentNode.leftChild = newNode;
        parentNode.leftChildId = newNode.userId;
        console.log(`✅ Placed ${newNode.firstName} ${newNode.lastName} as LEFT child of ${parentNode.userId}`);
      } else if (emptyNode.position === 'right') {
        parentNode.rightChild = newNode;
        parentNode.rightChildId = newNode.userId;
        console.log(`✅ Placed ${newNode.firstName} ${newNode.lastName} as RIGHT child of ${parentNode.userId}`);
      }
      return true;
    }
    
    console.log(`❌ Could not find parent node for ${emptyNode.parentUserId}`);
    return false;
  }

  // Get all team members (direct + indirect) organized by levels
  static async getAllTeamMembers(userId, maxLevel = 15) {
    try {
      console.log(`Getting all team members for user: ${userId}`);
      
      // Get the user first to get their referral code
      const user = await User.findById(userId).select('referralCode');
      if (!user) return [];
      
      // Get all users who are part of this user's team tree
      const allUsers = await User.find({
        $or: [
          { sponsor: userId }, // Direct referrals
          { sponsorCode: user.referralCode } // Users who used this referral code
        ]
      }).select('firstName lastName username email userId sponsorCode sponsor createdAt totalEarnings totalWithdrawn isActive walletAddress referralCode').sort({ createdAt: 1 });

      console.log(`Found ${allUsers.length} potential team members`);

      // Organize members by tree levels
      const membersByLevel = {};
      
      // Initialize all levels
      for (let level = 1; level <= maxLevel; level++) {
        membersByLevel[level] = [];
      }

      // Process each user and assign tree level
      for (const user of allUsers) {
        let treeLevel = 1; // Default level
        let isDirectReferral = false;
        
        // Check if this is a direct referral
        if (user.sponsor && user.sponsor.toString() === userId.toString()) {
          isDirectReferral = true;
          treeLevel = 1;
        } else {
          // Calculate tree level based on sponsor chain
          treeLevel = await this.calculateTreeLevel(userId, user._id);
        }

        if (treeLevel <= maxLevel) {
          membersByLevel[treeLevel].push({
            _id: user._id,
            userId: user.userId,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            username: user.username || '',
            email: user.email || '',
            walletAddress: user.walletAddress || '',
            referralCode: user.referralCode || '',
            totalEarnings: user.totalEarnings || 0,
            totalWithdrawn: user.totalWithdrawn || 0,
            isActive: user.isActive || false,
            createdAt: user.createdAt ? user.createdAt : new Date(),
            sponsorCode: user.sponsorCode || '',
            sponsor: user.sponsor,
            treeLevel: treeLevel,
            isDirectReferral: isDirectReferral,
            position: membersByLevel[treeLevel].length < 2 ? 
              (membersByLevel[treeLevel].length === 0 ? 'left' : 'right') : 'additional'
          });
        }
      }

      // Flatten all members
      const allMembers = [];
      for (let level = 1; level <= maxLevel; level++) {
        allMembers.push(...membersByLevel[level]);
      }

      console.log(`Organized ${allMembers.length} members across ${maxLevel} levels`);
      return allMembers;
    } catch (error) {
      console.error('Error getting all team members:', error);
      return [];
    }
  }

  // Get all team members with complete nested tree structure (recursive approach)
  static async getAllTeamMembersWithNestedLevels(userId, maxLevel = 15) {
    try {
      console.log(`Getting complete nested tree for user: ${userId}`);
      
      const allMembers = [];
      const processedUsers = new Set(); // To avoid duplicates
      
      // Recursive function to traverse the entire tree
      const traverseTree = async (currentUserId, currentLevel, parentUserId = null) => {
        if (currentLevel > maxLevel) return;
        
        // Get direct referrals of current user
        const directReferrals = await this.getValidatedDirectReferralsList(currentUserId);
        console.log(`Level ${currentLevel}: Found ${directReferrals.length} direct referrals for user ${currentUserId}`);
        
        for (const referral of directReferrals) {
          if (!processedUsers.has(referral._id.toString())) {
            const isDirectReferral = (currentLevel === 1);
            
            allMembers.push({
              _id: referral._id,
              userId: referral.userId,
              firstName: referral.firstName || '',
              lastName: referral.lastName || '',
              username: referral.username || '',
              email: referral.email || '',
              walletAddress: referral.walletAddress || '',
              referralCode: referral.referralCode || '',
              totalEarnings: referral.totalEarnings || 0,
              totalWithdrawn: referral.totalWithdrawn || 0,
              isActive: referral.isActive || false,
              createdAt: referral.createdAt ? referral.createdAt : new Date(),
              sponsorCode: referral.sponsorCode || '',
              sponsor: referral.sponsor,
              isDirectReferral: isDirectReferral,
              nestedLevel: currentLevel,
              parentUserId: parentUserId
            });
            
            processedUsers.add(referral._id.toString());
            console.log(`Added ${isDirectReferral ? 'Direct' : 'Indirect'} member ${referral.userId} to level ${currentLevel}`);
            
            // Recursively traverse this user's referrals
            await traverseTree(referral._id, currentLevel + 1, currentUserId);
          }
        }
      };
      
      // Start traversal from the root user
      await traverseTree(userId, 1);
      
      // Sort by nested level first, then by join time within each level
      allMembers.sort((a, b) => {
        if (a.nestedLevel !== b.nestedLevel) {
          return a.nestedLevel - b.nestedLevel;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
      
      console.log(`Complete tree traversal: ${allMembers.length} total members`);
      console.log(`Direct referrals: ${allMembers.filter(m => m.isDirectReferral).length}`);
      console.log(`Indirect referrals: ${allMembers.filter(m => !m.isDirectReferral).length}`);
      
      // Log level distribution
      const levelCounts = {};
      allMembers.forEach(member => {
        levelCounts[member.nestedLevel] = (levelCounts[member.nestedLevel] || 0) + 1;
      });
      console.log('Complete level distribution:', levelCounts);
      
      return allMembers;
    } catch (error) {
      console.error('Error getting complete nested tree:', error);
      return [];
    }
  }

  // Calculate nested level for a user based on their position in the tree
  static async calculateNestedLevel(rootUserId, targetUserId, maxDepth = 15) {
    try {
      let currentUserId = targetUserId;
      let level = 1;
      
      while (level <= maxDepth) {
        const user = await User.findById(currentUserId).select('sponsor');
        if (!user || !user.sponsor) {
          break;
        }
        
        // If we found the root user, this is the level
        if (user.sponsor.toString() === rootUserId.toString()) {
          return level;
        }
        
        // Move up the tree
        currentUserId = user.sponsor;
        level++;
      }
      
      return level; // Return calculated level
    } catch (error) {
      console.error('Error calculating nested level:', error);
      return 1;
    }
  }

  // Calculate tree level for a user based on sponsor chain
  static async calculateTreeLevel(rootUserId, targetUserId, maxDepth = 15) {
    try {
      let currentUserId = targetUserId;
      let level = 1;
      
      while (level <= maxDepth) {
        const user = await User.findById(currentUserId).select('sponsor');
        if (!user || !user.sponsor) {
          break;
        }
        
        if (user.sponsor.toString() === rootUserId.toString()) {
          return level;
        }
        
        currentUserId = user.sponsor;
        level++;
      }
      
      return level; // Return calculated level
    } catch (error) {
      console.error('Error calculating tree level:', error);
      return 1;
    }
  }

  // Get the starting index for direct referrals in a specific level
  static getDirectReferralStartIndex(level) {
    const TEAM_SIZE_PER_LEVEL = {
      1: 2,      // 2 members
      2: 4,      // 4 members
      3: 8,      // 8 members
      4: 16,     // 16 members
      5: 32,     // 32 members
      6: 64,     // 64 members
      7: 128,    // 128 members
      8: 256,    // 256 members
      9: 512,    // 512 members
      10: 1024,  // 1,024 members
      11: 2048,  // 2,048 members
      12: 4096,  // 4,096 members
      13: 8192,  // 8,192 members
      14: 16384, // 16,384 members
      15: 32768  // 32,768 members
    };
    
    let startIndex = 0;
    for (let i = 1; i < level; i++) {
      startIndex += TEAM_SIZE_PER_LEVEL[i] || 0;
    }
    return startIndex;
  }

  // Get comprehensive level-wise member distribution
  static async getLevelWiseMemberDistribution(userId, maxLevel = 15) {
    try {
      console.log(`Getting level-wise member distribution for user ID: ${userId}`);
      
      const user = await User.findById(userId);
      if (!user) {
        console.log(`User not found for ID: ${userId}`);
        return null;
      }

      console.log(`Found user: ${user.userId}`);
      
      console.log('Creating level distribution...');
      
      // Create level-wise distribution
      const levelDistribution = {};
      const TEAM_SIZE_PER_LEVEL = {
        1: 2,      // 2 members
        2: 4,      // 4 members
        3: 8,      // 8 members
        4: 16,     // 16 members
        5: 32,     // 32 members
        6: 64,     // 64 members
        7: 128,    // 128 members
        8: 256,    // 256 members
        9: 512,    // 512 members
        10: 1024,  // 1,024 members
        11: 2048,  // 2,048 members
        12: 4096,  // 4,096 members
        13: 8192,  // 8,192 members
        14: 16384, // 16,384 members
        15: 32768  // 32,768 members
      };

      console.log('Initializing levels...');

      // Get all team members with proper nested tree level calculation
      const allTeamMembers = await this.getAllTeamMembersWithNestedLevels(userId, maxLevel);
      console.log(`Found ${allTeamMembers.length} total team members`);
      
      // Initialize all levels with empty arrays
      for (let level = 1; level <= maxLevel; level++) {
        levelDistribution[level] = {
          level: level,
          capacity: TEAM_SIZE_PER_LEVEL[level] || 0,
          currentMembers: 0,
          availableSlots: TEAM_SIZE_PER_LEVEL[level] || 0,
          isFull: false,
          directMembers: 0,
          indirectMembers: 0,
          members: []
        };
      }
      
      // Distribute members across levels based on their actual tree structure
      // Group members by their nested level
      const membersByNestedLevel = {};
      allTeamMembers.forEach(member => {
        const level = member.nestedLevel;
        if (!membersByNestedLevel[level]) {
          membersByNestedLevel[level] = [];
        }
        membersByNestedLevel[level].push(member);
      });
      
      console.log(`Distributing members by actual tree structure:`, Object.keys(membersByNestedLevel).map(level => `Level ${level}: ${membersByNestedLevel[level].length} members`).join(', '));
      
      // Distribute members level by level based on their actual tree position
      // But respect level capacity limits
      let overflowMembers = [];
      
      for (let level = 1; level <= maxLevel; level++) {
        const capacity = TEAM_SIZE_PER_LEVEL[level] || 0;
        const membersAtThisLevel = membersByNestedLevel[level] || [];
        let levelMembers = [];
        
        // Combine current level members with overflow from previous level
        const allMembersForThisLevel = [...membersAtThisLevel, ...overflowMembers];
        overflowMembers = []; // Reset overflow
        
        // Add members up to capacity
        for (let i = 0; i < Math.min(allMembersForThisLevel.length, capacity); i++) {
          const member = allMembersForThisLevel[i];
          levelMembers.push({
            _id: member._id,
            userId: member.userId,
            firstName: member.firstName,
            lastName: member.lastName,
            username: member.username,
            email: member.email,
            walletAddress: member.walletAddress,
            referralCode: member.referralCode,
            totalEarnings: member.totalEarnings || 0,
            totalWithdrawn: member.totalWithdrawn || 0,
            isActive: member.isActive,
            createdAt: member.createdAt,
            registrationDate: member.createdAt,
            treeLevel: level,
            position: levelMembers.length < 2 ? 
              (levelMembers.length === 0 ? 'left' : 'right') : 'additional',
            parentPosition: member.parentUserId,
            isDirectReferral: member.isDirectReferral,
            directReferralsCount: member.directReferrals || 0
          });
          console.log(`Added ${member.isDirectReferral ? 'Direct' : 'Indirect'} member ${member.userId} to level ${level}`);
        }
        
        // If there are remaining members, move them to overflow for next level
        if (allMembersForThisLevel.length > capacity) {
          overflowMembers = allMembersForThisLevel.slice(capacity);
          console.log(`Moving ${overflowMembers.length} members from level ${level} to overflow for next level`);
        }
        
        // Update level distribution
        levelDistribution[level].members = levelMembers;
      }
      
      // Update level statistics based on actual tree structure
      for (let level = 1; level <= maxLevel; level++) {
        const levelData = levelDistribution[level];
        const directCount = levelData.members.filter(m => m.isDirectReferral).length;
        const indirectCount = levelData.members.filter(m => !m.isDirectReferral).length;
        
        // Update counts based on actual tree structure
        levelData.currentMembers = levelData.members.length;
        levelData.directMembers = directCount;
        levelData.indirectMembers = indirectCount;
        
        // Calculate available slots (capacity - current members)
        levelData.availableSlots = Math.max(0, levelData.capacity - levelData.currentMembers);
        levelData.isFull = levelData.currentMembers >= levelData.capacity;
        
        console.log(`Level ${level}: ${directCount} direct, ${indirectCount} indirect members (${levelData.currentMembers}/${levelData.capacity}) - Available slots: ${levelData.availableSlots}`);
      }

      console.log('Creating result object...');

      // Get direct referrals count
      const directReferralsCount = allTeamMembers.filter(m => m.isDirectReferral).length;
      
      const result = {
        userId: user.userId,
        totalDirectReferrals: directReferralsCount,
        totalTeamMembers: allTeamMembers.length,
        levelDistribution: levelDistribution,
        directReferrals: allTeamMembers.filter(m => m.isDirectReferral).map(ref => ({
          _id: ref._id,
          userId: ref.userId,
          firstName: ref.firstName,
          lastName: ref.lastName,
          username: ref.username,
          email: ref.email,
          walletAddress: ref.walletAddress,
          referralCode: ref.referralCode,
          totalEarnings: ref.totalEarnings || 0,
          totalWithdrawn: ref.totalWithdrawn || 0,
          isActive: ref.isActive,
          createdAt: ref.createdAt,
          registrationDate: ref.createdAt,
          position: ref.position
        }))
      };

      console.log('Final result:', {
        userId: result.userId,
        totalDirectReferrals: result.totalDirectReferrals,
        totalTeamMembers: result.totalTeamMembers,
        hasLevelDistribution: !!result.levelDistribution,
        hasDirectReferrals: !!result.directReferrals,
        levelDistributionKeys: result.levelDistribution ? Object.keys(result.levelDistribution) : 'null',
        directReferralsLength: result.directReferrals ? result.directReferrals.length : 'null'
      });

      return result;
    } catch (error) {
      console.error('Error getting level-wise member distribution:', error);
      throw error;
    }
  }

  // Get level-wise member details for a specific level
  static async getLevelWiseMemberDetails(userId, level) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      console.log(`Getting level ${level} member details for user ${user.userId}`);

      // Get level capacity
      const TEAM_SIZE_PER_LEVEL = {
        1: 2,      // 2 members
        2: 4,      // 4 members
        3: 8,      // 8 members
        4: 16,     // 16 members
        5: 32,     // 32 members
        6: 64,     // 64 members
        7: 128,    // 128 members
        8: 256,    // 256 members
        9: 512,    // 512 members
        10: 1024,  // 1,024 members
        11: 2048,  // 2,048 members
        12: 4096,  // 4,096 members
        13: 8192,  // 8,192 members
        14: 16384, // 16,384 members
        15: 32768  // 32,768 members
      };
      const levelCapacity = TEAM_SIZE_PER_LEVEL[level] || 0;
      
      // Get all team members for proper level distribution
      const allTeamMembers = await this.getAllTeamMembers(userId, level);
      
      // Get direct referrals
      const directReferrals = await this.getValidatedDirectReferralsList(userId);
      
      // Get members for this specific level from all team members
      let levelMembers = allTeamMembers.filter(member => member.treeLevel === level);
      
      // Remove duplicates by _id to prevent same member appearing multiple times
      const uniqueLevelMembers = [];
      const seenIds = new Set();
      
      for (const member of levelMembers) {
        if (!seenIds.has(member._id.toString())) {
          seenIds.add(member._id.toString());
          uniqueLevelMembers.push(member);
        }
      }
      
      levelMembers = uniqueLevelMembers;
      
      // For level 1, ensure we have the first 2 direct referrals
      if (level === 1) {
        const firstTwoDirectReferrals = directReferrals.slice(0, levelCapacity);
        levelMembers = firstTwoDirectReferrals.map((ref, index) => ({
          _id: ref._id,
          userId: ref.userId || '',
          firstName: ref.firstName || '',
          lastName: ref.lastName || '',
          username: ref.username || '',
          email: ref.email || '',
          walletAddress: ref.walletAddress || '',
          referralCode: ref.referralCode || '',
          totalEarnings: ref.totalEarnings || 0,
          totalWithdrawn: ref.totalWithdrawn || 0,
          isActive: ref.isActive || false,
          createdAt: ref.createdAt,
          treeLevel: 1,
          position: index < 2 ? (index === 0 ? 'left' : 'right') : 'additional',
          isDirectReferral: true,
          directReferralsCount: ref.directReferralsCount || 0
        }));
      } else {
        // For other levels, get direct referrals that should be in this level
        const startIndex = this.getDirectReferralStartIndex(level);
        const endIndex = startIndex + levelCapacity;
        const directReferralsForThisLevel = directReferrals.slice(startIndex, endIndex);
        
        levelMembers = directReferralsForThisLevel.map((ref, index) => ({
          _id: ref._id,
          userId: ref.userId || '',
          firstName: ref.firstName || '',
          lastName: ref.lastName || '',
          username: ref.username || '',
          email: ref.email || '',
          walletAddress: ref.walletAddress || '',
          referralCode: ref.referralCode || '',
          totalEarnings: ref.totalEarnings || 0,
          totalWithdrawn: ref.totalWithdrawn || 0,
          isActive: ref.isActive || false,
          createdAt: ref.createdAt,
          treeLevel: level,
          position: index < 2 ? (index === 0 ? 'left' : 'right') : 'additional',
          isDirectReferral: true,
          directReferralsCount: ref.directReferralsCount || 0
        }));
      }
      
      // Add indirect members for this level (only if there's space)
      const indirectMembersForLevel = allTeamMembers.filter(member => 
        member.treeLevel === level && !member.isDirectReferral
      );
      
      // Only add indirect members if there's space in the level
      const availableSpace = levelCapacity - levelMembers.length;
      const indirectMembersToAdd = indirectMembersForLevel.slice(0, availableSpace);
      
      console.log(`Level ${level}: Adding ${indirectMembersToAdd.length} indirect members (${indirectMembersForLevel.length} available, ${availableSpace} space)`);
      levelMembers = levelMembers.concat(indirectMembersToAdd);
      
      // Final deduplication to ensure no duplicates
      const finalMembers = [];
      const finalSeenIds = new Set();
      
      for (const member of levelMembers) {
        if (!finalSeenIds.has(member._id.toString())) {
          finalSeenIds.add(member._id.toString());
          finalMembers.push(member);
        }
      }
      
      levelMembers = finalMembers;
      
      const directCount = levelMembers.filter(m => m.isDirectReferral).length;
      const indirectCount = levelMembers.filter(m => !m.isDirectReferral).length;
      
      // Get all indirect referrals for the response with proper field mapping
      // Fetch fresh data from database to ensure createdAt is available
      const indirectMemberIds = allTeamMembers
        .filter(member => !directReferrals.some(direct => direct._id.toString() === member._id.toString()))
        .map(member => member._id);
      
      const allIndirectReferrals = await User.find({
        _id: { $in: indirectMemberIds }
      }).select('firstName lastName username email userId sponsorCode sponsor createdAt totalEarnings totalWithdrawn isActive walletAddress referralCode');
      
      // Map to proper format with treeLevel and position from allTeamMembers
      const mappedIndirectReferrals = allIndirectReferrals.map(ref => {
        const teamMember = allTeamMembers.find(m => m._id.toString() === ref._id.toString());
        return {
          _id: ref._id,
          userId: ref.userId || '',
          firstName: ref.firstName || '',
          lastName: ref.lastName || '',
          username: ref.username || '',
          email: ref.email || '',
          walletAddress: ref.walletAddress || '',
          referralCode: ref.referralCode || '',
          totalEarnings: ref.totalEarnings || 0,
          totalWithdrawn: ref.totalWithdrawn || 0,
          isActive: ref.isActive || false,
          createdAt: ref.createdAt,
          treeLevel: teamMember ? teamMember.treeLevel : 1,
          position: teamMember ? teamMember.position : ''
        };
      });

      return {
        level: level,
        capacity: levelCapacity,
        currentMembers: levelMembers.length,
        availableSlots: Math.max(0, levelCapacity - (directCount + indirectCount)),
        isFull: (directCount + indirectCount) >= levelCapacity,
        directMembers: directCount,
        indirectMembers: indirectCount,
        members: levelMembers.map(member => ({
          _id: member._id,
          userId: member.userId || '',
          firstName: member.firstName || '',
          lastName: member.lastName || '',
          username: member.username || '',
          email: member.email || '',
          walletAddress: member.walletAddress || '',
          referralCode: member.referralCode || '',
          totalEarnings: member.totalEarnings || 0,
          totalWithdrawn: member.totalWithdrawn || 0,
          isActive: member.isActive || false,
          createdAt: member.createdAt,
          registrationDate: member.createdAt,
          treeLevel: member.treeLevel,
          position: member.position || '',
          isDirectReferral: member.isDirectReferral || false,
          directReferralsCount: member.directReferralsCount || 0
        })),
        directReferrals: directReferrals.map(ref => ({
          _id: ref._id,
          userId: ref.userId || '',
          firstName: ref.firstName || '',
          lastName: ref.lastName || '',
          username: ref.username || '',
          email: ref.email || '',
          walletAddress: ref.walletAddress || '',
          referralCode: ref.referralCode || '',
          totalEarnings: ref.totalEarnings || 0,
          totalWithdrawn: ref.totalWithdrawn || 0,
          isActive: ref.isActive || false,
          createdAt: ref.createdAt,
          registrationDate: ref.createdAt,
          position: ref.position || ''
        })),
        indirectReferrals: mappedIndirectReferrals.map(ref => ({
          ...ref,
          registrationDate: ref.createdAt
        }))
      };
    } catch (error) {
      console.error('Error getting level-wise member details:', error);
      throw error;
    }
  }

  // Get team members up to a specific level
  static async getTeamMembersUpToLevel(userId, maxLevel) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      console.log(`Getting team members up to level ${maxLevel} for user ${user.userId}`);

      // Get all team members using aggregation
      const teamMembers = await User.aggregate([
        {
          $match: {
            $or: [
              { sponsor: userId },
              { sponsorCode: user.referralCode }
            ]
          }
        },
        {
          $addFields: {
            treeLevel: {
              $cond: {
                if: { $eq: ["$sponsor", userId] },
                then: 1,
                else: {
                  $cond: {
                    if: { $eq: ["$sponsorCode", user.referralCode] },
                    then: 1,
                    else: 0
                  }
                }
              }
            }
          }
        },
        {
          $sort: { createdAt: 1 }
        }
      ]);

      // Calculate tree levels for all members
      const membersWithLevels = [];
      const processedIds = new Set();

      // Add direct referrals first
      const directReferrals = teamMembers.filter(member => 
        member.sponsor && member.sponsor.toString() === userId.toString()
      );

      for (const directRef of directReferrals) {
        if (!processedIds.has(directRef._id.toString())) {
          membersWithLevels.push({
            ...directRef,
            treeLevel: 1,
            position: membersWithLevels.length < 2 ? (membersWithLevels.length === 0 ? 'left' : 'right') : 'additional',
            isDirectReferral: true
          });
          processedIds.add(directRef._id.toString());
        }
      }

      // Add indirect referrals level by level
      let currentLevel = 1;
      while (currentLevel < maxLevel) {
        const currentLevelMembers = membersWithLevels.filter(member => member.treeLevel === currentLevel);
        
        for (const member of currentLevelMembers) {
          const memberReferrals = teamMembers.filter(ref => 
            ref.sponsor && ref.sponsor.toString() === member._id.toString() &&
            !processedIds.has(ref._id.toString())
          );

          for (const ref of memberReferrals) {
            const nextLevel = currentLevel + 1;
            const nextLevelMembers = membersWithLevels.filter(m => m.treeLevel === nextLevel);
            
            membersWithLevels.push({
              ...ref,
              treeLevel: nextLevel,
              position: nextLevelMembers.length < 2 ? 
                (nextLevelMembers.length === 0 ? 'left' : 'right') : 'additional',
              isDirectReferral: false
            });
            processedIds.add(ref._id.toString());
          }
        }
        
        currentLevel++;
      }

      return membersWithLevels;
    } catch (error) {
      console.error('Error getting team members up to level:', error);
      throw error;
    }
  }

  // Get user's team tree in proper binary structure (top-bottom, left-right)
  static async getBinaryTeamTree(userId, maxLevel = 15) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      console.log(`Building binary team tree for user ${user.userId} with max level ${maxLevel}`);

      // Initialize tree structure
      const binaryTree = {
        user: {
          _id: user._id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          email: user.email,
          walletAddress: user.walletAddress,
          position: user.position,
          totalEarnings: user.totalEarnings || 0,
          totalWithdrawn: user.totalWithdrawn || 0,
          isActive: user.isActive,
          createdAt: user.createdAt,
          registrationDate: user.createdAt,
          level: await this.getUserLevel(userId),
          referralCode: user.referralCode,
          directReferrals: []
        },
        tree: null, // Root node
        levels: [], // Level-wise structure
        totalMembers: 0,
        totalEarnings: 0,
        levelStats: {}
      };

      // Get validated direct referrals
      const validatedDirectReferrals = await this.getValidatedDirectReferralsList(userId);
      console.log(`User ${user.userId} has ${validatedDirectReferrals.length} validated direct referrals`);

      // Store direct referrals in user object
      binaryTree.user.directReferrals = validatedDirectReferrals.map(ref => ({
        _id: ref._id,
        userId: ref.userId,
        firstName: ref.firstName,
        lastName: ref.lastName,
        username: ref.username,
        position: ref.position,
        totalEarnings: ref.totalEarnings || 0,
        createdAt: ref.createdAt
      }));

      // Build binary tree recursively with proper handling of additional referrals
      const buildBinaryNode = async (currentUserId, currentLevel = 0, parentPosition = null) => {
        if (currentLevel >= maxLevel) {
          console.log(`Max level ${maxLevel} reached for user ${currentUserId}`);
          return null;
        }

        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
          console.log(`User not found: ${currentUserId}`);
          return null;
        }

        // Get user's MLM level and direct referrals
        const userMLMLevel = await this.getUserLevel(currentUserId);
        const userDirectReferrals = await this.getValidatedDirectReferralsCount(currentUserId);

        const node = {
          _id: currentUser._id,
          userId: currentUser.userId,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          username: currentUser.username,
          email: currentUser.email,
          walletAddress: currentUser.walletAddress,
          position: currentUser.position,
          totalEarnings: currentUser.totalEarnings || 0,
          totalWithdrawn: currentUser.totalWithdrawn || 0,
          isActive: currentUser.isActive,
          createdAt: currentUser.createdAt,
          registrationDate: currentUser.createdAt,
          level: userMLMLevel,
          referralCode: currentUser.referralCode,
          directReferrals: userDirectReferrals,
          treeLevel: currentLevel,
          parentPosition: parentPosition,
          leftChild: null,
          rightChild: null,
          leftChildId: null,
          rightChildId: null,
          additionalChildren: [] // Store additional referrals here
        };

        // Get validated direct referrals for this user
        const userDirectReferralsList = await this.getValidatedDirectReferralsList(currentUserId);
        console.log(`User ${currentUser.userId} at level ${currentLevel} has ${userDirectReferralsList.length} direct referrals`);

        // Sort referrals by creation date to maintain order
        const sortedReferrals = userDirectReferralsList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Assign positions to referrals based on order
        sortedReferrals.forEach((ref, index) => {
          if (index === 0) {
            ref.position = 'left';
          } else if (index === 1) {
            ref.position = 'right';
          } else {
            ref.position = 'additional';
          }
        });

        // Find left and right children (first 2 referrals)
        const leftChild = sortedReferrals[0]; // First referral
        const rightChild = sortedReferrals[1]; // Second referral

        // Note: Additional referrals (3rd, 4th, etc.) will be handled at root level
        // They will be placed in empty nodes of the tree structure

        // Recursively build left subtree
        if (leftChild) {
          console.log(`Building LEFT subtree for user ${currentUser.userId} -> ${leftChild.userId}`);
          node.leftChild = await buildBinaryNode(leftChild._id, currentLevel + 1, 'left');
          node.leftChildId = leftChild.userId;
        }

        // Recursively build right subtree
        if (rightChild) {
          console.log(`Building RIGHT subtree for user ${currentUser.userId} -> ${rightChild.userId}`);
          node.rightChild = await buildBinaryNode(rightChild._id, currentLevel + 1, 'right');
          node.rightChildId = rightChild.userId;
        }

        console.log(`Completed building node for user ${currentUser.userId} at level ${currentLevel}`);
        return node;
      };

      // Build the root node
      binaryTree.tree = await buildBinaryNode(userId, 0, 'root');

      // Handle additional referrals by placing them in empty nodes
      const additionalReferrals = validatedDirectReferrals.slice(2); // 3rd, 4th, etc.
      
      if (additionalReferrals.length > 0) {
        console.log(`\n=== Placing ${additionalReferrals.length} additional referrals in empty nodes ===`);
        
        // Find all empty nodes in the tree
        const emptyNodes = this.findEmptyNodes(binaryTree.tree, 0, maxLevel);
        console.log(`Found ${emptyNodes.length} empty nodes in the tree`);
        
        // Place additional referrals in empty nodes
        for (let i = 0; i < additionalReferrals.length && i < emptyNodes.length; i++) {
          const additionalRef = additionalReferrals[i];
          const emptyNode = emptyNodes[i];
          
          console.log(`Placing ${additionalRef.firstName} ${additionalRef.lastName} (@${additionalRef.username}) in empty node: ${emptyNode.path}`);
          
          // Create a new node for the additional referral
          const additionalNode = {
            _id: additionalRef._id,
            userId: additionalRef.userId,
            firstName: additionalRef.firstName,
            lastName: additionalRef.lastName,
            username: additionalRef.username,
            email: additionalRef.email,
            walletAddress: additionalRef.walletAddress,
            position: additionalRef.position,
            totalEarnings: additionalRef.totalEarnings || 0,
            totalWithdrawn: additionalRef.totalWithdrawn || 0,
            isActive: additionalRef.isActive,
            createdAt: additionalRef.createdAt,
            registrationDate: additionalRef.createdAt,
            level: await this.getUserLevel(additionalRef._id),
            referralCode: additionalRef.referralCode,
            directReferrals: await this.getValidatedDirectReferralsCount(additionalRef._id),
            treeLevel: emptyNode.level,
            parentPosition: emptyNode.position,
            leftChild: null,
            rightChild: null,
            leftChildId: null,
            rightChildId: null,
            additionalChildren: []
          };
          
          // Place the node in the tree structure
          this.placeNodeInTree(binaryTree.tree, emptyNode, additionalNode);
        }
        
        console.log(`Successfully placed ${Math.min(additionalReferrals.length, emptyNodes.length)} additional referrals in empty nodes`);
      }

      // Build level-wise structure for easy access
      const buildLevels = (node, level = 0) => {
        if (!node) return;

        // Initialize level array if it doesn't exist
        if (!binaryTree.levels[level]) {
          binaryTree.levels[level] = [];
        }

        // Add node to level
        binaryTree.levels[level].push({
          _id: node._id,
          userId: node.userId,
          firstName: node.firstName,
          lastName: node.lastName,
          username: node.username,
          level: node.level,
          directReferrals: node.directReferrals,
          totalEarnings: node.totalEarnings,
          treeLevel: node.treeLevel,
          parentPosition: node.parentPosition,
          leftChildId: node.leftChildId,
          rightChildId: node.rightChildId,
          additionalChildren: node.additionalChildren || []
        });

        // Recursively process children
        if (node.leftChild) {
          buildLevels(node.leftChild, level + 1);
        }
        if (node.rightChild) {
          buildLevels(node.rightChild, level + 1);
        }
      };

      // Build level-wise structure
      buildLevels(binaryTree.tree);

      // Calculate statistics
      for (let level = 0; level < binaryTree.levels.length; level++) {
        const levelNodes = binaryTree.levels[level];
        const levelEarning = this.MLM_CONFIG.LEVEL_EARNINGS[level + 1] || 0;
        const totalEarningAtLevel = levelNodes.length * levelEarning;

        binaryTree.levelStats[level + 1] = {
          level: level + 1,
          totalNodes: levelNodes.length,
          levelEarning: levelEarning,
          totalEarning: totalEarningAtLevel,
          users: levelNodes
        };

        binaryTree.totalMembers += levelNodes.length;
        binaryTree.totalEarnings += totalEarningAtLevel;

        console.log(`Level ${level + 1}: ${levelNodes.length} nodes, earning: $${totalEarningAtLevel}`);
      }

      console.log(`Binary tree build completed: ${binaryTree.totalMembers} total members, $${binaryTree.totalEarnings} total earnings`);
      return binaryTree;
    } catch (error) {
      console.error('Error getting binary team tree:', error);
      throw error;
    }
  }

  // Get user's team tree organized by levels with proper binary structure
  static async getTeamTree(userId, maxLevel = 15) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      console.log(`Building team tree for user ${user.userId} with max level ${maxLevel}`);

      // Build proper binary tree structure recursively
      const buildBinaryTree = async (currentUserId, currentLevel = 0, parentPosition = null) => {
        if (currentLevel >= maxLevel) {
          console.log(`Max level ${maxLevel} reached for user ${currentUserId}`);
          return null;
        }

        const currentUser = await User.findById(currentUserId);
        if (!currentUser) {
          console.log(`User not found: ${currentUserId}`);
          return null;
        }

        // Get user's actual level in the MLM system
        const userMLMLevel = await this.getUserLevel(currentUserId);
        
        // Get team size at this level
        const teamSizeAtLevel = this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[userMLMLevel] || 0;
        const isTreeComplete = await this.isBinaryTreeComplete(currentUserId, userMLMLevel);

        const node = {
          _id: currentUser._id,
          userId: currentUser.userId,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          username: currentUser.username,
          email: currentUser.email,
          walletAddress: currentUser.walletAddress,
          position: currentUser.position,
          totalEarnings: currentUser.totalEarnings || 0,
          totalWithdrawn: currentUser.totalWithdrawn || 0,
          isActive: currentUser.isActive,
          createdAt: currentUser.createdAt,
          registrationDate: currentUser.createdAt,
          level: userMLMLevel,
          treeLevel: currentLevel,
          referralCode: currentUser.referralCode,
          teamSizeAtLevel,
          isTreeComplete,
          levelEarning: this.MLM_CONFIG.LEVEL_EARNINGS[userMLMLevel] || 0,
          leftChild: null,
          rightChild: null,
          directReferrals: []
        };

        // Get VALIDATED direct referrals only
        const validatedDirectReferrals = await this.getValidatedDirectReferralsList(currentUserId);
        
        console.log(`User ${currentUser.userId} has ${validatedDirectReferrals.length} VALIDATED direct referrals at level ${currentLevel}`);

        // Build proper binary tree structure with all validated referrals
        if (validatedDirectReferrals.length > 0) {
          // Sort referrals by creation date to maintain order
          const sortedReferrals = validatedDirectReferrals.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
          
          // Find left and right children based on position
          const leftChild = sortedReferrals.find(ref => ref.position === 'left');
          const rightChild = sortedReferrals.find(ref => ref.position === 'right');
          
          // If no position assigned, assign left/right based on order
          let leftAssigned = !!leftChild;
          let rightAssigned = !!rightChild;
          
          // Assign positions to referrals without positions
          for (const ref of sortedReferrals) {
            if (!ref.position) {
              if (!leftAssigned) {
                ref.position = 'left';
                leftAssigned = true;
                console.log(`Assigned LEFT position to ${ref.userId} (${ref.firstName} ${ref.lastName})`);
              } else if (!rightAssigned) {
                ref.position = 'right';
                rightAssigned = true;
                console.log(`Assigned RIGHT position to ${ref.userId} (${ref.firstName} ${ref.lastName})`);
              }
            }
          }
          
          // Get final left and right children
          const finalLeftChild = sortedReferrals.find(ref => ref.position === 'left');
          const finalRightChild = sortedReferrals.find(ref => ref.position === 'right');
          
          // Recursively build left subtree
          if (finalLeftChild) {
            console.log(`Building LEFT subtree for user ${currentUser.userId} -> ${finalLeftChild.userId}`);
            node.leftChild = await buildBinaryTree(finalLeftChild._id, currentLevel + 1, 'left');
          }
          
          // Recursively build right subtree
          if (finalRightChild) {
            console.log(`Building RIGHT subtree for user ${currentUser.userId} -> ${finalRightChild.userId}`);
            node.rightChild = await buildBinaryTree(finalRightChild._id, currentLevel + 1, 'right');
          }
          
          // Handle additional referrals (more than 2) - assign them positions
          const additionalReferrals = sortedReferrals.filter(ref => 
            ref.position !== 'left' && ref.position !== 'right'
          );
          
          if (additionalReferrals.length > 0) {
            console.log(`Found ${additionalReferrals.length} additional VALIDATED referrals for user ${currentUser.userId}`);
            
            // Assign positions to additional referrals
            for (let i = 0; i < additionalReferrals.length; i++) {
              const additionalRef = additionalReferrals[i];
              
              // Assign positions based on order (left, right, left, right, etc.)
              if (i % 2 === 0) {
                additionalRef.position = 'left';
                console.log(`Assigned LEFT position to additional referral ${additionalRef.userId} (${additionalRef.firstName} ${additionalRef.lastName})`);
              } else {
                additionalRef.position = 'right';
                console.log(`Assigned RIGHT position to additional referral ${additionalRef.userId} (${additionalRef.firstName} ${additionalRef.lastName})`);
              }
            }
            
            // Note: In a true binary tree, additional referrals would be placed under existing children
            // For now, we'll store them in directReferrals with their assigned positions
            // The tree structure will show them as direct referrals with proper positioning
          }
        }

        // Store ALL VALIDATED direct referrals for reference (including additional ones)
        node.directReferrals = validatedDirectReferrals.map(ref => ({
          _id: ref._id,
          userId: ref.userId,
          firstName: ref.firstName,
          lastName: ref.lastName,
          username: ref.username,
          position: ref.position,
          totalEarnings: ref.totalEarnings || 0,
          createdAt: ref.createdAt
        }));
        
        console.log(`Stored ${node.directReferrals.length} direct referrals for user ${currentUser.userId}`);

        console.log(`Completed building node for user ${currentUser.userId} at level ${currentLevel}`);
        return node;
      };

      const result = await buildBinaryTree(userId);
      console.log('Team tree build completed');
      return result;
    } catch (error) {
      console.error('Error getting team tree:', error);
      throw error;
    }
  }

  // Get users at specific level
  static async getUsersAtLevel(userId, targetLevel) {
    try {
      if (targetLevel === 1) {
        return await User.find({ sponsor: userId });
      }

      const users = [];
      const queue = [{ userId, level: 0 }];

      while (queue.length > 0) {
        const { userId: currentUserId, level } = queue.shift();
        
        if (level === targetLevel - 1) {
          const directReferrals = await User.find({ sponsor: currentUserId });
          users.push(...directReferrals);
        } else if (level < targetLevel - 1) {
          const directReferrals = await User.find({ sponsor: currentUserId });
          for (const referral of directReferrals) {
            queue.push({ userId: referral._id, level: level + 1 });
          }
        }
      }

      return users;
    } catch (error) {
      console.error('Error getting users at level:', error);
      return [];
    }
  }

  // Get user's earnings summary
  static async getEarningsSummary(userId) {
    try {
      const earnings = await Earning.find({ user: userId });
      
      // Get team statistics
      const directReferrals = await User.countDocuments({ sponsor: userId });
      const totalTeamMembers = await this.getTotalTeamMembers(userId);
      const totalLevels = await this.getUserMaxLevel(userId);

      const summary = {
        totalEarnings: 0,
        directEarnings: 0,
        // indirectEarnings: 0,
        levelEarnings: {},
        recentEarnings: [],
        directReferrals,
        totalTeamMembers,
        totalLevels
      };

      for (const earning of earnings) {
        summary.totalEarnings += earning.amount;
        
        if (earning.type === 'direct_referral') {
          summary.directEarnings += earning.amount;
        } else if (earning.type === 'indirect_referral') {
          // summary.indirectEarnings += earning.amount;
          
          if (!summary.levelEarnings[earning.level]) {
            summary.levelEarnings[earning.level] = 0;
          }
          summary.levelEarnings[earning.level] += earning.amount;
        }
      }

      // Get recent earnings (last 10)
      summary.recentEarnings = earnings
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map(earning => ({
          amount: earning.amount,
          type: earning.type,
          level: earning.level,
          description: earning.description,
          date: earning.createdAt
        }));

      return summary;
    } catch (error) {
      console.error('Error getting earnings summary:', error);
      throw error;
    }
  }

  // Get admin's 15 direct SDs
  static async getAdminDirectSDs() {
    try {
      const admin = await User.findOne({ isAdmin: true });
      if (!admin) return [];

      const directSDs = await User.find({ sponsor: admin._id })
        .select('referralCode registrationDate walletAddress')
        .sort({ registrationDate: 1 })
        .limit(15);

      return directSDs;
    } catch (error) {
      console.error('Error getting admin direct SDs:', error);
      return [];
    }
  }

  // Get binary tree structure (for backward compatibility)
  static async getBinaryTree(userId, maxLevel = 5) {
    try {
      return await this.getTeamTree(userId, maxLevel);
    } catch (error) {
      console.error('Error getting binary tree:', error);
      throw error;
    }
  }

  // Get referral tree structure
  static async getReferralTree(userId, maxLevel = 5) {
    try {
      return await this.getTeamTree(userId, maxLevel);
    } catch (error) {
      console.error('Error getting referral tree:', error);
      throw error;
    }
  }

  // Calculate binary earnings (for backward compatibility)
  static async calculateBinaryEarnings(userId) {
    try {
      const earningsSummary = await this.getEarningsSummary(userId);
      
      return {
        availableBalance: earningsSummary.totalEarnings,
        teamStats: {
          totalMembers: earningsSummary.totalTeamMembers,
          directReferrals: earningsSummary.directReferrals,
          totalLevels: earningsSummary.totalLevels
        },
        levelEarnings: earningsSummary.levelEarnings,
        totalActualEarnings: earningsSummary.totalEarnings,
        totalMaxPotential: earningsSummary.totalEarnings * 2 // Placeholder calculation
      };
    } catch (error) {
      console.error('Error calculating binary earnings:', error);
      throw error;
    }
  }

  // Get earnings history
  static async getEarningsHistory(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      const earnings = await Earning.find({ user: userId })
        .populate('fromUser', 'walletAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Earning.countDocuments({ user: userId });

      return {
        earnings,
        pagination: {
          current: page,
          total: total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting earnings history:', error);
      throw error;
    }
  }

  // Get total team members count
  static async getTotalTeamMembers(userId) {
    try {
      let count = 0;
      const queue = [userId];
      
      while (queue.length > 0) {
        const currentUserId = queue.shift();
        const directReferrals = await User.find({ sponsor: currentUserId });
        count += directReferrals.length;
        
        for (const referral of directReferrals) {
          queue.push(referral._id);
        }
      }
      
      return count;
    } catch (error) {
      console.error('Error getting total team members:', error);
      return 0;
    }
  }

  // Get user's maximum level in team
  static async getUserMaxLevel(userId) {
    try {
      let maxLevel = 0;
      const queue = [{ userId, level: 0 }];
      
      while (queue.length > 0) {
        const { userId: currentUserId, level } = queue.shift();
        maxLevel = Math.max(maxLevel, level);
        
        const directReferrals = await User.find({ sponsor: currentUserId });
        for (const referral of directReferrals) {
          queue.push({ userId: referral._id, level: level + 1 });
        }
      }
      
      return maxLevel;
    } catch (error) {
      console.error('Error getting user max level:', error);
      return 0;
    }
  }

  // Get all indirect referrals (entire team tree)
  static async getAllTeamMembers(userId, maxLevel = 15) {
    try {
      const allMembers = [];
      const queue = [{ userId, level: 0 }];
      
      while (queue.length > 0) {
        const { userId: currentUserId, level } = queue.shift();
        
        if (level > 0) { // Don't include the user themselves
          const user = await User.findById(currentUserId);
          if (user) {
            const userMLMLevel = await this.getUserLevel(currentUserId);
            
            // Calculate actual earnings from Earning model
            const actualEarnings = await this.calculateUserEarnings(currentUserId);
            
            allMembers.push({
              _id: user._id,
              userId: user.userId,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              walletAddress: user.walletAddress,
              referralCode: user.referralCode,
              position: user.position,
              level: userMLMLevel,
              treeLevel: level,
              totalEarnings: actualEarnings,
              isActive: user.isActive,
              joinDate: user.createdAt,
              registrationDate: user.createdAt,
              levelEarning: this.MLM_CONFIG.LEVEL_EARNINGS[userMLMLevel] || 0,
              teamSizeAtLevel: this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[userMLMLevel] || 0
            });
          }
        }
        
        if (level < maxLevel) {
          const directReferrals = await User.find({ sponsor: currentUserId });
          for (const referral of directReferrals) {
            queue.push({ userId: referral._id, level: level + 1 });
          }
        }
      }
      
      return allMembers;
    } catch (error) {
      console.error('Error getting all team members:', error);
      return [];
    }
  }

  // Calculate user's actual earnings from Earning model
  static async calculateUserEarnings(userId) {
    try {
      const Earning = require('../models/Earning');
      const earnings = await Earning.find({ user: userId });
      
      let totalEarnings = 0;
      for (const earning of earnings) {
        totalEarnings += earning.amount || 0;
      }
      
      return totalEarnings;
    } catch (error) {
      console.error('Error calculating user earnings:', error);
      return 0;
    }
  }

  // Recalculate and update all user earnings
  static async recalculateAllUserEarnings() {
    try {
      const users = await User.find({});
      const Earning = require('../models/Earning');
      
      for (const user of users) {
        const earnings = await Earning.find({ user: user._id });
        let totalEarnings = 0;
        
        for (const earning of earnings) {
          totalEarnings += earning.amount || 0;
        }
        
        // Update user's total earnings
        await User.findByIdAndUpdate(user._id, { totalEarnings });
        console.log(`Updated earnings for ${user.walletAddress}: $${totalEarnings}`);
      }
      
      console.log('All user earnings recalculated successfully');
    } catch (error) {
      console.error('Error recalculating user earnings:', error);
      throw error;
    }
  }

  // Comprehensive earnings recalculation with missed wallet handling
  static async recalculateAllEarningsWithMissedWallet() {
    try {
      const users = await User.find({ isAdmin: false });
      const Earning = require('../models/Earning');
      
      console.log(`Recalculating earnings for ${users.length} users...`);
      
      for (const user of users) {
        try {
          // Process missed wallet earnings first
          await this.processMissedWalletEarnings(user._id);
          
          // Recalculate total earnings
          const earnings = await Earning.find({ user: user._id });
          let totalEarnings = 0;
          
          for (const earning of earnings) {
            totalEarnings += earning.amount || 0;
          }
          
          // Update user's total earnings
          await User.findByIdAndUpdate(user._id, { totalEarnings });
          console.log(`Updated earnings for ${user.walletAddress}: $${totalEarnings}`);
          
        } catch (userError) {
          console.error(`Error processing user ${user.walletAddress}:`, userError);
        }
      }
      
      console.log('All user earnings recalculated with missed wallet handling');
    } catch (error) {
      console.error('Error recalculating all earnings:', error);
      throw error;
    }
  }

  // Get level-wise team statistics - OPTIMIZED VERSION WITH CACHING
  static async getLevelWiseTeamStats(userId) {
    try {
      // Check cache first
      const cacheKey = `levelStats_${userId}`;
      const cachedData = levelStatsCache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
        console.log(`Cache hit for level stats: ${userId}`);
        return cachedData.data;
      }

      console.log(`Cache miss for level stats: ${userId}, fetching fresh data...`);
      
      const stats = {
        totalMembers: 0,
        totalEarnings: 0,
        levels: {},
        currentLevel: 0,
        maxUnlockedLevel: 0,
        nextLevelProgress: 0,
        directReferrals: 0,
        availableDirectSlots: 0
      };

      // Execute all independent operations in parallel for better performance
      const [
        currentLevel,
        validatedDirectReferralsCount,
        teamMembersByLevel
      ] = await Promise.all([
        // Get user's current level
        this.getUserLevel(userId),
        
        // Get VALIDATED direct referrals count
        this.getValidatedDirectReferralsCount(userId),
        
        // Get team members by level using optimized aggregation
        this.getTeamMembersByLevelOptimized(userId)
      ]);

      stats.currentLevel = currentLevel;
      stats.directReferrals = validatedDirectReferralsCount;
      
      // Calculate max unlocked level based on VALIDATED direct referrals
      let maxUnlockedLevel = 1;
      if (validatedDirectReferralsCount >= 2) {
        maxUnlockedLevel = 4;
      }
      for (let level = 5; level <= 15; level++) {
        const requiredRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level];
        if (validatedDirectReferralsCount >= requiredRefs) {
          maxUnlockedLevel = level;
        }
      }
      stats.maxUnlockedLevel = maxUnlockedLevel;

      // Calculate available direct slots based on VALIDATED direct referrals
      const maxDirectSlots = 2;
      stats.availableDirectSlots = Math.max(0, maxDirectSlots - validatedDirectReferralsCount);

      // Process team members by level using pre-fetched data
      for (let level = 1; level <= 15; level++) {
        const membersAtLevel = teamMembersByLevel[level] || [];
        const requiredTeamSize = this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[level] || 0;
        const isComplete = membersAtLevel.length >= requiredTeamSize;
        const levelEarning = this.MLM_CONFIG.LEVEL_EARNINGS[level] || 0;
        const availableSlots = Math.max(0, requiredTeamSize - membersAtLevel.length);
        
        stats.levels[level] = {
          members: membersAtLevel.length,
          required: requiredTeamSize,
          availableSlots: availableSlots,
          isComplete,
          earning: levelEarning,
          progress: requiredTeamSize > 0 ? (membersAtLevel.length / requiredTeamSize) * 100 : 0,
          // Add level-wise distribution info
          levelDistribution: {
            currentMembers: membersAtLevel.length,
            maxCapacity: requiredTeamSize,
            availableSlots: availableSlots,
            isUnlocked: level <= maxUnlockedLevel,
            isComplete: isComplete,
          progress: requiredTeamSize > 0 ? (membersAtLevel.length / requiredTeamSize) * 100 : 0
          }
        };
        
        stats.totalMembers += membersAtLevel.length;
        stats.totalEarnings += Math.floor(levelEarning * membersAtLevel.length); // Whole numbers only
      }

      // Calculate next level progress
      if (currentLevel < 15) {
        const nextLevel = currentLevel + 1;
        const nextLevelStats = stats.levels[nextLevel];
        if (nextLevelStats) {
          stats.nextLevelProgress = nextLevelStats.progress;
        }
      }

      // Cache the result
      levelStatsCache.set(cacheKey, {
        data: stats,
        timestamp: Date.now()
      });

      // Clean up old cache entries (keep only last 100 entries)
      if (levelStatsCache.size > 100) {
        const entries = Array.from(levelStatsCache.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        levelStatsCache.clear();
        entries.slice(0, 100).forEach(([key, value]) => {
          levelStatsCache.set(key, value);
        });
      }

      return stats;
    } catch (error) {
      console.error('Error getting level-wise team stats:', error);
      return null;
    }
  }

  // Optimized method to get team members by level using aggregation
  static async getTeamMembersByLevelOptimized(userId) {
    try {
      // Use aggregation pipeline to get all team members with their levels in one query
      const pipeline = [
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
            _id: 1,
            teamMembers: 1
          }
        }
      ];

      const result = await User.aggregate(pipeline);
      
      // Initialize level counts
      const teamMembersByLevel = {};
      for (let level = 1; level <= 15; level++) {
        teamMembersByLevel[level] = [];
      }

      // Process the aggregation result to count members by level
      if (result.length > 0) {
        const allTeamMembers = result[0].teamMembers || [];
        
        // Use BFS to calculate levels efficiently
        const levelMap = new Map();
        const queue = [{ userId, level: 0 }];
        
        while (queue.length > 0) {
          const { userId: currentUserId, level } = queue.shift();
          
          if (level >= 1 && level <= 15) {
            if (!levelMap.has(level)) {
              levelMap.set(level, []);
            }
            levelMap.get(level).push({ _id: currentUserId });
          }
          
          if (level < 15) {
            // Find direct referrals of current user
            const directRefs = allTeamMembers.filter(member => 
              member.sponsor && member.sponsor.toString() === currentUserId.toString()
            );
            
            for (const ref of directRefs) {
              queue.push({ userId: ref._id, level: level + 1 });
            }
          }
        }
        
        // Convert map to array format
        for (let level = 1; level <= 15; level++) {
          teamMembersByLevel[level] = levelMap.get(level) || [];
        }
      }

      return teamMembersByLevel;
    } catch (error) {
      console.error('Error getting team members by level optimized:', error);
      // Fallback to empty structure
      const teamMembersByLevel = {};
      for (let level = 1; level <= 15; level++) {
        teamMembersByLevel[level] = [];
      }
      return teamMembersByLevel;
    }
  }

  // Get optimized team statistics using aggregation
  static async getOptimizedTeamStats(userId) {
    try {
      // Get team members count using aggregation pipeline
      const teamStatsPipeline = [
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
            totalMembers: { $size: '$teamMembers' },
            maxLevel: {
              $max: {
                $map: {
                  input: '$teamMembers',
                  as: 'member',
                  in: '$$member.level'
                }
              }
            }
          }
        }
      ];

      const teamStats = await User.aggregate(teamStatsPipeline);
      
      // Get level-wise earnings using aggregation
      const levelEarningsPipeline = [
        { $match: { user: userId, type: { $in: ['level_earning', 'indirect_referral'] } } },
        {
          $group: {
            _id: '$level',
            totalAmount: { $sum: '$amount' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ];

      const levelEarningsResult = await Earning.aggregate(levelEarningsPipeline);
      
      // Format level earnings
      const levelEarnings = {};
      levelEarningsResult.forEach(earning => {
        levelEarnings[earning._id] = earning.totalAmount;
      });

      return {
        totalMembers: teamStats[0]?.totalMembers || 0,
        maxLevel: teamStats[0]?.maxLevel || 1,
        levelEarnings: levelEarnings
      };

    } catch (error) {
      console.error('Error getting optimized team stats:', error);
      return {
        totalMembers: 0,
        maxLevel: 1,
        levelEarnings: {}
      };
    }
  }

  // Transfer missed wallet earnings to main balance when level is complete
  static async transferMissedWalletToMainBalance(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Get all missed wallet earnings
      const missedWalletEarnings = await Earning.find({
        user: userId,
        type: 'missed_wallet'
      });

      if (missedWalletEarnings.length === 0) return;

      // Calculate total missed wallet amount
      const totalMissedAmount = missedWalletEarnings.reduce((sum, earning) => sum + earning.amount, 0);

      // Update user's total earnings
      await User.findByIdAndUpdate(userId, {
        $inc: { totalEarnings: totalMissedAmount }
      });

      // Delete missed wallet earnings
      await Earning.deleteMany({
        user: userId,
        type: 'missed_wallet'
      });

      // Create a new earning record for the transfer
      await this.createEarning({
        userId: userId,
        amount: totalMissedAmount,
        type: 'level_completion_bonus',
        level: await this.getUserLevel(userId),
        description: `Level completion bonus - Missed wallet transferred to main balance ($${totalMissedAmount})`,
        referralId: null,
        paymentTxHash: 'LEVEL_COMPLETION_' + Date.now(),
        commissionRate: 100,
        paymentMethod: 'USDT'
      });

      console.log(`Transferred $${totalMissedAmount} from missed wallet to main balance for user ${user.username}`);
    } catch (error) {
      console.error('Error transferring missed wallet to main balance:', error);
    }
  }

  // Get missed wallet information for user - UPDATED VERSION
  static async getMissedWalletInfo(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          totalExistingMissed: 0,
          missedEarningsByLevel: [],
          earningLevel: 1,
          message: 'User not found',
          canProcess: false
        };
      }

      // Check if user is admin - admins don't get missed wallet
      if (user.isAdmin) {
        return {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          totalExistingMissed: 0,
          missedEarningsByLevel: [],
          earningLevel: 1,
          message: 'Admin users do not have missed wallet earnings',
          canProcess: false
        };
      }

      // Get user's earning level
      const earningLevel = await this.getUserEarningLevel(userId);
      
      // Check if user has completed their current level
      const currentLevel = await this.getUserLevel(userId);
      const isLevelComplete = await this.isBinaryTreeComplete(userId, currentLevel);
      
      // If level is complete, transfer missed wallet to main balance
      if (isLevelComplete) {
        await this.transferMissedWalletToMainBalance(userId);
      }
      
      // Get existing missed wallet earnings
      const existingMissedEarnings = await Earning.find({
        user: userId,
        type: 'missed_wallet'
      });

      const totalExistingMissed = existingMissedEarnings.reduce((sum, earning) => sum + earning.amount, 0);

      // Calculate new missed earnings using the proper logic
      const missedEarnings = await this.calculateMissedEarnings(userId, earningLevel);
      const totalMissedAmount = missedEarnings.reduce((sum, earning) => sum + earning.amount, 0);

      // Format existing missed earnings by level for display
      const existingMissedByLevel = {};
      existingMissedEarnings.forEach(earning => {
        if (!existingMissedByLevel[earning.level]) {
          existingMissedByLevel[earning.level] = {
            level: earning.level,
            amount: 0,
            membersCount: 0,
            expectedTotal: 0,
            alreadyEarned: 0,
            status: 'processed'
          };
        }
        existingMissedByLevel[earning.level].amount += earning.amount;
        existingMissedByLevel[earning.level].membersCount += 1; // Count as 1 member per earning
      });

      // Format new missed earnings by level
      const newMissedEarningsByLevel = missedEarnings.map(earning => ({
        level: earning.level,
        amount: earning.amount,
        membersCount: earning.membersCount,
        expectedTotal: earning.expectedTotal,
        alreadyEarned: earning.alreadyEarned,
        status: earning.alreadyEarned > 0 ? 'partially_earned' : 'not_earned'
      }));

      // Combine existing and new missed earnings
      const allMissedEarningsByLevel = [
        ...Object.values(existingMissedByLevel),
        ...newMissedEarningsByLevel
      ];

      // Determine if there are any missed earnings (existing or new)
      const hasAnyMissedEarnings = totalExistingMissed > 0 || missedEarnings.length > 0;
      const canProcessNew = missedEarnings.length > 0;

      // Check if level is complete to show appropriate message
      const userCurrentLevel = await this.getUserLevel(userId);
      const userLevelComplete = await this.isBinaryTreeComplete(userId, userCurrentLevel);
      
      let message = '';
      if (userLevelComplete) {
        message = `Congratulations! Your Level ${userCurrentLevel} is complete. Missed wallet earnings have been transferred to your main balance.`;
      } else if (hasAnyMissedEarnings) {
        message = totalExistingMissed > 0 && missedEarnings.length > 0
          ? `You have $${totalExistingMissed} in processed missed wallet earnings and $${totalMissedAmount} in new missed earnings. Complete your Level ${userCurrentLevel} to transfer these to your main balance.`
          : totalExistingMissed > 0
          ? `You have $${totalExistingMissed} in processed missed wallet earnings. Complete your Level ${userCurrentLevel} to transfer these to your main balance.`
          : `You have $${totalMissedAmount} in new missed earnings across ${missedEarnings.length} levels. Complete your Level ${userCurrentLevel} to transfer these to your main balance.`;
      } else {
        message = 'No missed earnings found. Complete your levels to unlock missed wallet earnings.';
      }

      return {
        hasMissedEarnings: hasAnyMissedEarnings,
        totalMissedAmount: totalMissedAmount,
        totalExistingMissed: totalExistingMissed,
        missedEarningsByLevel: allMissedEarningsByLevel,
        earningLevel: earningLevel,
        currentLevel: userCurrentLevel,
        isLevelComplete: userLevelComplete,
        message: message,
        canProcess: canProcessNew && !userLevelComplete
      };

    } catch (error) {
      console.error('Error getting missed wallet info:', error);
      return {
        hasMissedEarnings: false,
        totalMissedAmount: 0,
        totalExistingMissed: 0,
        missedEarningsByLevel: [],
        earningLevel: 1,
        message: 'Error calculating missed wallet information',
        canProcess: false
      };
    }
  }

  // Get detailed missed wallet info for a user with reasons
  static async getDetailedMissedWalletInfo(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is admin - admins don't have missed wallet
      if (user.isAdmin) {
        return {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          totalExistingMissed: 0,
          missedEarningsByLevel: [],
          earningLevel: 0,
          currentLevel: 0,
          isLevelComplete: true,
          message: 'Admin users do not have missed wallet earnings',
          canProcess: false
        };
      }

      // Get missed wallet earnings for this user
      const missedEarnings = await Earning.find({ 
        user: userId, 
        type: 'missed_wallet' 
      }).sort({ level: 1, createdAt: 1 });

      if (missedEarnings.length === 0) {
        return {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          totalExistingMissed: 0,
          missedEarningsByLevel: [],
          earningLevel: 0,
          currentLevel: 0,
          isLevelComplete: true,
          message: 'No missed wallet earnings found',
          canProcess: false
        };
      }

      // Group missed earnings by level with detailed reasons
      const levelWiseEarnings = {};
      let totalMissedAmount = 0;

      for (const earning of missedEarnings) {
        const level = earning.level || 1;
        if (!levelWiseEarnings[level]) {
          levelWiseEarnings[level] = {
            level,
            totalAmount: 0,
            memberCount: 0,
            members: [],
            reasons: []
          };
        }

        levelWiseEarnings[level].totalAmount += earning.amount;
        levelWiseEarnings[level].memberCount += 1;

        // Get the user who caused this missed earning
        const causedByUser = earning.causedByUserId ? await User.findById(earning.causedByUserId) : null;
        const reason = {
          amount: earning.amount,
          date: earning.createdAt,
          causedBy: causedByUser ? {
            userId: causedByUser.userId,
            username: causedByUser.username,
            firstName: causedByUser.firstName,
            lastName: causedByUser.lastName
          } : null,
          reason: earning.reason || `Level ${level} not completed - missing required team members`
        };

        levelWiseEarnings[level].members.push(reason);
        levelWiseEarnings[level].reasons.push(reason);

        totalMissedAmount += earning.amount;
      }

      // Convert to array and sort by level
      const missedEarningsByLevel = Object.values(levelWiseEarnings).sort((a, b) => a.level - b.level);

      // Get user's current level and check if it's complete
      const userCurrentLevel = await this.getUserLevel(userId);
      const isLevelComplete = await this.isBinaryTreeComplete(userId, userCurrentLevel);

      // If current level is complete, transfer missed wallet to main balance
      if (isLevelComplete && missedEarningsByLevel.length > 0) {
        await this.transferMissedWalletToMainBalance(userId);
        
        return {
          hasMissedEarnings: false,
          totalMissedAmount: 0,
          totalExistingMissed: totalMissedAmount,
          missedEarningsByLevel: [],
          earningLevel: userCurrentLevel,
          currentLevel: userCurrentLevel,
          isLevelComplete: true,
          message: `🎉 Level ${userCurrentLevel} completed! Missed wallet earnings ($${totalMissedAmount.toFixed(2)}) have been transferred to your main balance.`,
          canProcess: false
        };
      }

      return {
        hasMissedEarnings: true,
        totalMissedAmount,
        totalExistingMissed: 0,
        missedEarningsByLevel,
        earningLevel: userCurrentLevel,
        currentLevel: userCurrentLevel,
        isLevelComplete: false,
        message: `You have $${totalMissedAmount.toFixed(2)} in missed wallet earnings. Complete Level ${userCurrentLevel} to unlock these earnings.`,
        canProcess: true
      };

    } catch (error) {
      console.error('Error getting detailed missed wallet info:', error);
      return {
        hasMissedEarnings: false,
        totalMissedAmount: 0,
        totalExistingMissed: 0,
        missedEarningsByLevel: [],
        earningLevel: 1,
        message: 'Error calculating missed wallet information',
        canProcess: false
      };
    }
  }

  // Get team stats for user
  static async getTeamStats(userId) {
    try {
      // Get direct referrals count
      const directReferrals = await User.countDocuments({ sponsor: userId });
      
      // Get total team members using a simpler approach
      const teamMembers = await User.find({ sponsor: userId });
      let totalTeamMembers = teamMembers.length;
      
      // Count indirect referrals recursively
      for (const member of teamMembers) {
        const indirectCount = await this.getTeamStats(member._id);
        totalTeamMembers += indirectCount.totalTeamMembers;
      }
      
      return {
        directReferrals,
        totalTeamMembers,
        teamByLevel: {}, // This can be populated if needed
        debug: {
          userId: userId.toString(),
          sponsorField: 'sponsor',
          query: { sponsor: userId }
        }
      };
    } catch (error) {
      console.error('Error getting team stats:', error);
      return {
        directReferrals: 0,
        totalTeamMembers: 0,
        teamByLevel: {},
        debug: {
          userId: userId.toString(),
          error: error.message
        }
      };
    }
  }

  // Get level-wise missed wallet earnings for admin
  static async getAdminMissedWalletByLevel() {
    try {
      const missedWalletEarnings = await Earning.find({ type: 'missed_wallet' });
      
      // Group by level
      const levelWiseEarnings = {};
      let totalMissedAmount = 0;
      
      missedWalletEarnings.forEach(earning => {
        const level = earning.level || 1;
        if (!levelWiseEarnings[level]) {
          levelWiseEarnings[level] = {
            level,
            totalAmount: 0,
            memberCount: 0,
            members: []
          };
        }
        
        levelWiseEarnings[level].totalAmount += earning.amount;
        levelWiseEarnings[level].memberCount += 1;
        levelWiseEarnings[level].members.push({
          userId: earning.userId,
          amount: earning.amount,
          date: earning.createdAt
        });
        
        totalMissedAmount += earning.amount;
      });
      
      // Convert to array and sort by level
      const levelWiseArray = Object.values(levelWiseEarnings).sort((a, b) => a.level - b.level);
      
      return {
        totalMissedAmount,
        levelWiseEarnings: levelWiseArray,
        totalLevels: levelWiseArray.length,
        message: `Admin view: ${totalMissedAmount.toFixed(2)} USDT in missed wallet across ${levelWiseArray.length} levels`
      };
    } catch (error) {
      console.error('Error getting admin missed wallet by level:', error);
      throw error;
    }
  }

  // ==================== MISSED LEVEL EARNINGS ====================

  // Update locked missed earning for a level
  static async updateLockedMissedEarning(userId, level, totalAmount) {
    try {
      const user = await User.findById(userId);
      if (!user || user.isAdmin) return null;

      // Get current team members at this level
      const teamMembers = await this.getTeamMembersAtLevel(userId, level);
      
      // Check if locked earning already exists for this level (any status except transferred)
      // Also check for any reason (to handle old entries with different reasons)
      const existingLocked = await MissedLevelEarning.findOne({
        user: userId,
        level: level,
        status: { $ne: 'transferred' }
      });

      if (existingLocked) {
        // Update existing locked earning
        existingLocked.amount = totalAmount;
        existingLocked.reason = 'level_locked'; // Ensure correct reason
        existingLocked.status = 'pending'; // Ensure status is pending
        existingLocked.metadata = {
          ...existingLocked.metadata,
          expectedMembers: teamMembers.length,
          actualMembers: teamMembers.length,
          missingMembers: 0,
          levelCompletionPercentage: 0
        };
        await existingLocked.save();
        return existingLocked;
      }

      // Create new locked missed earning
      const missedEarning = new MissedLevelEarning({
        user: userId,
        userId: user.userId,
        level: level,
        amount: totalAmount,
        reason: 'level_locked',
        status: 'pending',
        metadata: {
          expectedMembers: teamMembers.length,
          actualMembers: teamMembers.length,
          missingMembers: 0,
          levelCompletionPercentage: 0
        }
      });

      await missedEarning.save();
      return missedEarning;
    } catch (error) {
      console.error('Error updating locked missed level earning:', error);
      return null;
    }
  }

  // Create pending missed level earning (deprecated, kept for compatibility)
  static async createPendingMissedLevelEarning(userId, level, amount, referralId, paymentTxHash) {
    try {
      const user = await User.findById(userId);
      if (!user || user.isAdmin) return null;

      // Check if pending earning already exists for this level
      const existingPending = await MissedLevelEarning.findOne({
        user: userId,
        level: level,
        status: 'pending'
      });

      if (existingPending) {
        // Update existing pending earning
        existingPending.amount += amount;
        existingPending.metadata = {
          ...existingPending.metadata,
          expectedMembers: (existingPending.metadata?.expectedMembers || 0) + 1,
          lastUpdated: new Date()
        };
        await existingPending.save();
        return existingPending;
      }

      // Get current team members at this level for metadata
      const teamMembers = await this.getTeamMembersAtLevel(userId, level);
      
      // Create new pending missed level earning
      const missedEarning = new MissedLevelEarning({
        user: userId,
        userId: user.userId,
        level: level,
        amount: amount,
        reason: 'level_locked',
        status: 'pending',
        metadata: {
          expectedMembers: teamMembers.length + 1, // Current members + this new one
          actualMembers: teamMembers.length,
          missingMembers: 1, // This new registration
          levelCompletionPercentage: 0 // Level is locked, so 0%
        }
      });

      await missedEarning.save();
      return missedEarning;
    } catch (error) {
      console.error('Error creating pending missed level earning:', error);
      return null;
    }
  }

  // Check and create missed level earnings for a user based on VALIDATED direct referrals
  static async checkAndCreateMissedLevelEarnings(userId) {
    try {
      const user = await User.findById(userId);
      if (!user || user.isAdmin) {
        return [];
      }

      const missedEarnings = [];
      const userLevel = await this.getUserLevel(userId);
      
      // Get validated direct referrals count
      const directReferralsCount = await this.getValidatedDirectReferralsCount(userId);
      
      console.log(`   User ${user.userId}: ${directReferralsCount} validated direct referrals, Level: ${userLevel}`);
      
      // Check each level from 1 to user's current level
      for (let level = 1; level <= userLevel; level++) {
        const levelConfig = this.MLM_CONFIG.LEVEL_EARNINGS[level];
        if (!levelConfig) continue;

        // Check if user has already earned from this level
        const existingEarning = await Earning.findOne({
          user: userId,
          level: level,
          status: { $in: ['confirmed', 'completed'] }
        });

        if (existingEarning) {
          console.log(`     Level ${level}: Already earned $${existingEarning.amount}`);
          continue;
        }

        // Check if missed earning already exists
        const existingMissedEarning = await MissedLevelEarning.findOne({
          user: userId,
          level: level,
          status: { $in: ['pending', 'allocated'] }
        });

        if (existingMissedEarning) {
          console.log(`     Level ${level}: Missed earning already exists $${existingMissedEarning.amount}`);
          continue;
        }

        // Check if level is unlocked based on VALIDATED direct referrals
        const requiredDirectRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level] || 0;
        const isLevelUnlocked = directReferralsCount >= requiredDirectRefs;
        
        if (!isLevelUnlocked) {
          console.log(`     Level ${level}: Not unlocked (need ${requiredDirectRefs} direct refs, have ${directReferralsCount})`);
          continue;
        }

        // Get team members at this level
        const teamMembers = await this.getTeamMembersAtLevel(userId, level);
        const expectedMembers = this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[level] || 0;
        
        // Calculate completion percentage
        const completionPercentage = expectedMembers > 0 ? (teamMembers.length / expectedMembers) * 100 : 0;
        
        console.log(`     Level ${level}: ${teamMembers.length}/${expectedMembers} members (${completionPercentage.toFixed(2)}% complete)`);
        
        // If level is not complete, create missed earning
        if (completionPercentage < 100 && teamMembers.length > 0) {
          const missedAmount = levelConfig * (teamMembers.length / expectedMembers);
          
          const missedEarning = new MissedLevelEarning({
            user: userId,
            userId: user.userId,
            level: level,
            amount: missedAmount,
            reason: 'level_incomplete',
            status: 'pending',
            metadata: {
              expectedMembers: expectedMembers,
              actualMembers: teamMembers.length,
              missingMembers: expectedMembers - teamMembers.length,
              levelCompletionPercentage: completionPercentage,
              directReferralsCount: directReferralsCount,
              requiredDirectRefs: requiredDirectRefs,
              isLevelUnlocked: isLevelUnlocked
            }
          });

          await missedEarning.save();
          missedEarnings.push(missedEarning);
          console.log(`     ✅ Created missed earning: $${missedAmount.toFixed(2)}`);
        } else if (completionPercentage >= 100) {
          console.log(`     Level ${level}: Complete - no missed earning needed`);
        } else {
          console.log(`     Level ${level}: No team members - no missed earning created`);
        }
      }

      return missedEarnings;
    } catch (error) {
      console.error('Error checking missed level earnings:', error);
      throw error;
    }
  }

  // Process missed level earnings for all users in the system
  static async processAllMissedLevelEarnings() {
    try {
      console.log('🔄 Processing missed level earnings for all users...');
      
      const users = await User.find({ isAdmin: false, isActive: true });
      const results = [];

      for (const user of users) {
        try {
          console.log(`\n--- Processing user: ${user.username || user.userId} ---`);
          
          // Get user's current level
          const userLevel = await this.getUserLevel(user._id);
          console.log(`   User Level: ${userLevel}`);
          
          // Get direct referrals count
          const directReferralsCount = await User.countDocuments({ 
            sponsor: user._id, 
            isAdmin: { $ne: true } 
          });
          console.log(`   Direct Referrals: ${directReferralsCount}`);
          
          // Check each level from 1 to 15 (all levels, not just user's current level)
          for (let level = 1; level <= 15; level++) {
            const levelConfig = this.MLM_CONFIG.LEVEL_EARNINGS[level];
            if (!levelConfig) continue;

            // Check if level is unlocked based on direct referrals
            const requiredDirectRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level] || 0;
            const isLevelUnlocked = directReferralsCount >= requiredDirectRefs;
            
            if (isLevelUnlocked) {
              // Level is unlocked - check if user needs immediate credit
              await this.checkLevelCompletionAndTransfer(user._id, level);
            } else {
              console.log(`     Level ${level}: Not unlocked (need ${requiredDirectRefs} direct refs, have ${directReferralsCount})`);
              
              // Check if user has already earned from this level
              const existingEarning = await Earning.findOne({
                user: user._id,
                level: level,
                status: { $in: ['confirmed', 'completed'] }
              });

            

              // Check if missed earning already exists
              const existingMissedEarning = await MissedLevelEarning.findOne({
                user: user._id,
                level: level,
                status: { $in: ['pending', 'allocated'] }
              });

              if (existingMissedEarning) {
                
                continue;
              }

              // Get team members at this level
              const teamMembers = await this.getTeamMembersAtLevel(user._id, level);
              const expectedMembers = this.MLM_CONFIG.TEAM_SIZE_PER_LEVEL[level] || 0;
              
              // Calculate completion percentage
              const completionPercentage = expectedMembers > 0 ? (teamMembers.length / expectedMembers) * 100 : 0;
              
              
              
              // If level is not complete, create missed earning
              if (completionPercentage < 100 && teamMembers.length > 0) {
                const missedAmount = levelConfig * (teamMembers.length / expectedMembers);
                
                const missedEarning = new MissedLevelEarning({
                  user: user._id,
                  userId: user.userId,
                  level: level,
                  amount: missedAmount,
                  reason: 'level_incomplete',
                  status: 'pending',
                  metadata: {
                    expectedMembers: expectedMembers,
                    actualMembers: teamMembers.length,
                    missingMembers: expectedMembers - teamMembers.length,
                    levelCompletionPercentage: completionPercentage,
                    directReferralsCount: directReferralsCount,
                    requiredDirectRefs: requiredDirectRefs,
                    isLevelUnlocked: isLevelUnlocked
                  }
                });

                await missedEarning.save();
              
              } else if (completionPercentage >= 100) {
                console.log(`     Level ${level}: Complete - no missed earning needed`);
              } else {
                console.log(`     Level ${level}: No team members - no missed earning created`);
              }
            }
          }
          
          results.push({
            userId: user.userId,
            username: user.username,
            level: userLevel,
            directReferrals: directReferralsCount,
            processed: true
          });
          
        } catch (error) {
          console.error(`   ❌ Error processing user ${user.userId}:`, error.message);
          results.push({
            userId: user.userId,
            username: user.username,
            error: error.message,
            processed: false
          });
        }
      }

   
      return results;
    } catch (error) {
      console.error('Error processing all missed level earnings:', error);
      throw error;
    }
  }

  // Process missed level earnings for all users
  static async processMissedLevelEarnings() {
    try {
     
      
      const users = await User.find({ isAdmin: false, isActive: true });
      const results = [];

      for (const user of users) {
        try {
          const missedEarnings = await this.checkAndCreateMissedLevelEarnings(user._id);
          results.push({
            userId: user.userId,
            missedEarnings: missedEarnings.length
          });
        } catch (error) {
          console.error(`Error processing missed level earnings for user ${user.userId}:`, error);
        }
      }

      
      return results;
    } catch (error) {
      console.error('Error processing missed level earnings:', error);
      throw error;
    }
  }

  // Check if level is complete and transfer missed earnings based on direct referrals
  static async checkLevelCompletionAndTransfer(userId, level) {
    try {
      const user = await User.findById(userId);
      if (!user || user.isAdmin) return;

      // Get direct referrals count
      const directReferralsCount = await User.countDocuments({ 
        sponsor: userId, 
        isAdmin: { $ne: true } 
      });

      // Check if level is unlocked based on direct referrals
      const requiredDirectRefs = this.MLM_CONFIG.LEVEL_CRITERIA[level] || 0;
      const isLevelUnlocked = directReferralsCount >= requiredDirectRefs;

     

      if (isLevelUnlocked) {
        // Check for pending missed earnings first (locked earnings)
        const pendingMissedEarnings = await MissedLevelEarning.find({
          user: userId,
          level: level,
          status: 'pending'
        });

        if (pendingMissedEarnings.length > 0) {
         
          
          // Mark locked missed earnings as transferred
          for (const missedEarning of pendingMissedEarnings) {
            missedEarning.status = 'transferred';
            missedEarning.transferredAt = new Date();
            await missedEarning.save();
          }
        }
        
        // Now immediately credit earnings for all existing members at this level
        // This will calculate the correct total including any locked amount
        await this.immediatelyCreditLevelEarnings(userId, level, directReferralsCount);
      } else {
        console.log(`     ❌ Level ${level} not unlocked yet - need ${requiredDirectRefs - directReferralsCount} more direct referrals`);
      }
    } catch (error) {
      console.error('Error checking level completion and transfer:', error);
      throw error;
    }
  }

  // Immediately credit earnings for all existing members at a level when it unlocks
  static async immediatelyCreditLevelEarnings(userId, level, directReferralsCount) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      

      // Get all team members at this level
      const teamMembers = await this.getTeamMembersAtLevel(userId, level);
      const levelEarningPerMember = this.MLM_CONFIG.LEVEL_EARNINGS[level] || 0;
      
      if (teamMembers.length > 0 && levelEarningPerMember > 0) {
        const totalEarning = Math.floor(teamMembers.length * levelEarningPerMember);
        
        // Calculate what's already been credited for this level
        const existingEarnings = await Earning.find({
          user: userId,
          level: level,
          type: 'level_earning',
          status: { $in: ['confirmed', 'completed'] }
        });
        
        const totalAlreadyCredited = existingEarnings.reduce((sum, e) => sum + e.amount, 0);
        const amountToCredit = totalEarning - totalAlreadyCredited;
        
        if (amountToCredit > 0) {
          // Create earning for the difference
          const earning = new Earning({
            user: userId,
            fromUser: userId, // Self-earning from level unlock
            amount: amountToCredit,
            type: 'level_earning',
            level: level,
            commissionRate: 0,
            paymentMethod: 'USDT',
            status: 'confirmed',
            description: `Level ${level} income - credit for ${teamMembers.length} members (${totalAlreadyCredited > 0 ? `additional $${amountToCredit} after $${totalAlreadyCredited} already credited` : `$${amountToCredit} total`})`,
            metadata: {
              immediateCredit: true,
              levelUnlockedAt: new Date(),
              directReferralsCount: directReferralsCount,
              teamMembersCount: teamMembers.length,
              earningPerMember: levelEarningPerMember,
              totalEarningForLevel: totalEarning,
              alreadyCredited: totalAlreadyCredited,
              teamMembers: teamMembers.map(m => ({
                id: m._id,
                username: m.username,
                firstName: m.firstName,
                lastName: m.lastName
              }))
            }
          });

          await earning.save();

          // Update user's total earnings
          user.totalEarnings += amountToCredit;
          await user.save();

          console.log(`     ✅ Credited $${amountToCredit} for level ${level} (${teamMembers.length} members × $${levelEarningPerMember} - $${totalAlreadyCredited} already credited)`);
        } else {
          console.log(`     ℹ️  Already fully credited for level ${level} ($${totalAlreadyCredited}/$${totalEarning})`);
        }
      } else {
        console.log(`     ℹ️  No team members at level ${level} for immediate credit`);
      }
    } catch (error) {
      console.error('Error immediately crediting level earnings:', error);
      throw error;
    }
  }

  // Get missed level earnings for a user
  static async getMissedLevelEarnings(userId) {
    try {
      const missedEarnings = await MissedLevelEarning.find({
        user: userId,
        status: { $in: ['pending', 'allocated'] }
      }).sort({ level: 1 });

      return missedEarnings;
    } catch (error) {
      console.error('Error getting missed level earnings:', error);
      throw error;
    }
  }

  // Get missed level earnings summary
  static async getMissedLevelEarningsSummary() {
    try {
      const summary = await MissedLevelEarning.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalMissed = await MissedLevelEarning.aggregate([
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalCount: { $sum: 1 }
          }
        }
      ]);

      return {
        summary,
        total: totalMissed[0] || { totalAmount: 0, totalCount: 0 }
      };
    } catch (error) {
      console.error('Error getting missed level earnings summary:', error);
      throw error;
    }
  }

  // Allocate missed level earnings (move from pending to allocated)
  static async allocateMissedLevelEarnings(userId, level) {
    try {
      const missedEarnings = await MissedLevelEarning.find({
        user: userId,
        level: level,
        status: 'pending'
      });

      for (const missedEarning of missedEarnings) {
        missedEarning.status = 'allocated';
        missedEarning.allocatedAt = new Date();
        await missedEarning.save();
      }

      return missedEarnings;
    } catch (error) {
      console.error('Error allocating missed level earnings:', error);
      throw error;
    }
  }
}

module.exports = MLMService;