const Transaction = require('../models/Transaction');
const User = require('../models/User');
// const { NETWORKS } = require('../config/blockchain');

class TransactionService {
  // Create a new transaction record
  static async createTransaction(transactionData) {
    try {
      const transaction = new Transaction({
        ...transactionData,
        walletAddress: transactionData.walletAddress.toLowerCase(),
        fromAddress: transactionData.fromAddress.toLowerCase(),
        toAddress: transactionData.toAddress.toLowerCase()
      });
      
      await transaction.save();
      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // Get transaction by hash
  static async getTransactionByHash(txHash) {
    try {
      return await Transaction.findOne({ txHash }).populate('userId');
    } catch (error) {
      console.error('Error fetching transaction by hash:', error);
      throw error;
    }
  }

  // Get transactions by wallet address
  static async getTransactionsByWallet(walletAddress, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const transactions = await Transaction.find({ 
        walletAddress: walletAddress.toLowerCase() 
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'firstName lastName email username');

      const total = await Transaction.countDocuments({ 
        walletAddress: walletAddress.toLowerCase() 
      });

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTransactions: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching transactions by wallet:', error);
      throw error;
    }
  }

  // Update transaction status
  static async updateTransactionStatus(txHash, status, confirmationCount = null) {
    try {
      const updateData = { status };
      if (confirmationCount !== null) {
        updateData.confirmationCount = confirmationCount;
        if (confirmationCount >= 12) {
          updateData.confirmationTime = new Date();
        }
      }

      return await Transaction.findOneAndUpdate(
        { txHash },
        updateData,
        { new: true }
      );
    } catch (error) {
      console.error('Error updating transaction status:', error);
      throw error;
    }
  }

  // Verify transaction on blockchain
  // static async verifyTransactionOnBlockchain(txHash, network) {
  //   try {
  //     const networkConfig = NETWORKS[network];
  //     if (!networkConfig) {
  //       throw new Error('Invalid network');
  //     }

  //     // Here you would typically use a blockchain service like Alchemy, Infura, or direct RPC
  //     // For now, we'll simulate the verification
  //     const response = await fetch(`${networkConfig.rpcUrl}`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         jsonrpc: '2.0',
  //         method: 'eth_getTransactionReceipt',
  //         params: [txHash],
  //         id: 1
  //       })
  //     });

  //     const data = await response.json();
      
  //     if (data.result) {
  //       return {
  //         success: true,
  //         receipt: data.result,
  //         status: data.result.status === '0x1' ? 'confirmed' : 'failed',
  //         blockNumber: parseInt(data.result.blockNumber, 16),
  //         gasUsed: data.result.gasUsed
  //       };
  //     } else {
  //       return {
  //         success: false,
  //         error: 'Transaction not found'
  //       };
  //     }
  //   } catch (error) {
  //     console.error('Error verifying transaction on blockchain:', error);
  //     return {
  //       success: false,
  //       error: error.message
  //     };
  //   }
  // }

  // Get transaction statistics
  static async getTransactionStats(userId = null, network = null) {
    try {
      const matchQuery = {};
      if (userId) matchQuery.userId = userId;
      if (network) matchQuery.network = network;

      const stats = await Transaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalAmount: { $sum: { $toDouble: '$amount' } },
            confirmedTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            pendingTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            failedTransactions: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        confirmedTransactions: 0,
        pendingTransactions: 0,
        failedTransactions: 0
      };
    } catch (error) {
      console.error('Error getting transaction stats:', error);
      throw error;
    }
  }

  // Get recent transactions
  static async getRecentTransactions(limit = 10) {
    try {
      return await Transaction.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'firstName lastName email username');
    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  // Search transactions
  static async searchTransactions(query, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const searchQuery = {
        $or: [
          { txHash: { $regex: query, $options: 'i' } },
          { walletAddress: { $regex: query, $options: 'i' } },
          { fromAddress: { $regex: query, $options: 'i' } },
          { toAddress: { $regex: query, $options: 'i' } }
        ]
      };

      const transactions = await Transaction.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email username');

      const total = await Transaction.countDocuments(searchQuery);

      return {
        transactions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTransactions: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error searching transactions:', error);
      throw error;
    }
  }
}

module.exports = TransactionService;
