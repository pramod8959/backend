const MLMService = require('./mlmService');
const User = require('../models/User');

class AutoMissedWalletProcessor {
  static isProcessing = false;
  static lastProcessTime = null;
  static processInterval = null;

  // Start automatic processing
  static startAutoProcessing(intervalMinutes = 30) {
    
    // Process immediately on start
    this.processAllUsers();
    
    // Set up interval
    this.processInterval = setInterval(() => {
      this.processAllUsers();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop automatic processing
  static stopAutoProcessing() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  // Process missed wallet for all regular users
  static async processAllUsers() {
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      
      // Get all regular users
      const users = await User.find({ isAdmin: false });

      let totalProcessed = 0;
      let totalAmount = 0;
      let usersProcessed = 0;

      for (const user of users) {
        try {
          // Process missed wallet for this user
          const processedEarnings = await MLMService.processMissedWalletEarnings(user._id);
          
          if (processedEarnings.length > 0) {
            totalProcessed += processedEarnings.length;
            totalAmount += processedEarnings.reduce((sum, earning) => sum + earning.amount, 0);
            usersProcessed++;
          }
        } catch (error) {
          console.error(`   ❌ Error processing ${user.username}:`, error.message);
        }
      }

      this.lastProcessTime = new Date();
      

    } catch (error) {
      console.error('❌ Auto missed wallet processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process missed wallet for specific user
  static async processUser(userId) {
    try {
      const processedEarnings = await MLMService.processMissedWalletEarnings(userId);
      
      return processedEarnings;
    } catch (error) {
      console.error('❌ Error processing user missed wallet:', error);
      return [];
    }
  }

  // Get processing status
  static getStatus() {
    return {
      isProcessing: this.isProcessing,
      lastProcessTime: this.lastProcessTime,
      hasInterval: !!this.processInterval
    };
  }

  // Manual trigger for processing
  static async triggerProcessing() {
    await this.processAllUsers();
  }
}

module.exports = AutoMissedWalletProcessor;
