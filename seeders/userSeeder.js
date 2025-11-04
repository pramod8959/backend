const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Earning = require('../models/Earning');
const MLMService = require('../services/mlmService');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for seeding');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Generate random wallet addresses (for testing purposes)
const generateWalletAddress = () => {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
};

// Generate random transaction hash
const generateTxHash = () => {
  const chars = '0123456789abcdef';
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
};

// Sample user data
const generateUserData = (index) => {
  const firstNames = [
    'John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa',
    'Tom', 'Anna', 'Mark', 'Jessica', 'Paul', 'Maria', 'Alex', 'Rachel',
    'Steve', 'Diana', 'Kevin', 'Sophie', 'Ryan', 'Emma', 'James', 'Olivia',
    'Daniel', 'Grace', 'Michael', 'Chloe', 'Robert', 'Zoe'
  ];
  
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
    'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
    'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
    'Ramirez', 'Lewis', 'Robinson'
  ];

  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const walletAddress = generateWalletAddress();
  
  return {
    firstName,
    lastName,
    username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${index}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`,
    walletAddress,
    referralCode: walletAddress.toLowerCase(),
    paymentMethod: Math.random() > 0.5 ? 'USDT' : 'BNB',
    paymentTxHash: generateTxHash(),
    registrationFee: 20,
    isActive: true,
    totalEarnings: 0,
    exactEarning: 0,
    totalWithdrawn: 0,
    position: 'left', // Will be updated by MLM service
    level: 1
  };
};

// User seeder class
class UserSeeder {
  
  // Clear existing data
  static async clearData() {
    try {
      console.log('🗑️  Clearing existing user and earning data...');
      await User.deleteMany({ isAdmin: false });
      await Earning.deleteMany({});
      console.log('✅ Data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing data:', error);
      throw error;
    }
  }

  // Create admin user if doesn't exist
  static async createAdmin() {
    try {
      console.log('👑 Creating admin user...');
      
      const adminExists = await User.findOne({ isAdmin: true });
      if (adminExists) {
        console.log('✅ Admin user already exists');
        return adminExists;
      }

      const adminWallet = '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b';
      const admin = new User({
        userId: 'ADMIN001',
        firstName: 'Admin',
        lastName: 'User',
        username: 'admin',
        email: 'admin@sbwplatform.com',
        referralCode: adminWallet.toLowerCase(),
        sponsorCode: adminWallet.toLowerCase(),
        sponsor: null,
        position: 'root',
        level: 0,
        isActive: true,
        registrationFee: 0,
        paymentMethod: 'USDT',
        walletAddress: adminWallet,
        isAdmin: true,
        totalEarnings: 0,
        totalWithdrawn: 0
      });

      await admin.save();
      console.log('✅ Admin user created successfully');
      return admin;
      
    } catch (error) {
      console.error('❌ Error creating admin:', error);
      throw error;
    }
  }

  // Seed users with MLM structure
  static async seedUsers(count = 50) {
    try {
      console.log(`👥 Seeding ${count} users...`);
      
      // Get admin user as the root sponsor
      const admin = await User.findOne({ isAdmin: true });
      if (!admin) {
        throw new Error('Admin user not found. Please create admin first.');
      }

      const users = [];
      const userPromises = [];

      // Create users in batches to maintain MLM structure
      for (let i = 0; i < count; i++) {
        const userData = generateUserData(i);
        
        // For first few users, use admin as sponsor
        if (i < 5) {
          userData.sponsorCode = admin.referralCode;
        } else {
          // For subsequent users, randomly select from existing users as sponsors
          const existingUsers = await User.find({ isAdmin: false }).limit(Math.min(i, 20));
          if (existingUsers.length > 0) {
            const randomSponsor = existingUsers[Math.floor(Math.random() * existingUsers.length)];
            userData.sponsorCode = randomSponsor.referralCode;
          } else {
            userData.sponsorCode = admin.referralCode;
          }
        }

        try {
          console.log(`Creating user ${i + 1}/${count}: ${userData.firstName} ${userData.lastName}`);
          
          // Use MLM service to register user (this handles the complex MLM logic)
          const registrationResult = await MLMService.registerUser(userData);
          
          if (registrationResult.success) {
            users.push(registrationResult.user);
            console.log(`✅ User ${registrationResult.user.userId} created successfully`);
          } else {
            console.log(`❌ Failed to create user: ${registrationResult.message}`);
          }
          
          // Add small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error creating user ${i + 1}:`, error.message);
          // Continue with next user instead of failing completely
          continue;
        }
      }

      console.log(`✅ Successfully seeded ${users.length} users`);
      return users;
      
    } catch (error) {
      console.error('❌ Error seeding users:', error);
      throw error;
    }
  }

  // Create specific test users for development
  static async createTestUsers() {
    try {
      console.log('🧪 Creating specific test users...');
      
      const admin = await User.findOne({ isAdmin: true });
      if (!admin) {
        throw new Error('Admin user not found');
      }

      const testUsers = [
        {
          firstName: 'Alice',
          lastName: 'Johnson',
          username: 'alice_test',
          email: 'alice@test.com',
          walletAddress: '0x1234567890123456789012345678901234567890',
          sponsorCode: admin.referralCode,
          paymentMethod: 'USDT'
        },
        {
          firstName: 'Bob',
          lastName: 'Smith',
          username: 'bob_test',
          email: 'bob@test.com',
          walletAddress: '0x0987654321098765432109876543210987654321',
          sponsorCode: admin.referralCode,
          paymentMethod: 'BNB'
        },
        {
          firstName: 'Charlie',
          lastName: 'Brown',
          username: 'charlie_test',
          email: 'charlie@test.com',
          walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
          sponsorCode: admin.referralCode,
          paymentMethod: 'USDT'
        }
      ];

      const createdUsers = [];
      
      for (const userData of testUsers) {
        userData.referralCode = userData.walletAddress.toLowerCase();
        userData.paymentTxHash = generateTxHash();
        userData.registrationFee = 20;
        userData.isActive = true;
        userData.totalEarnings = 0;
        userData.exactEarning = 0;
        userData.totalWithdrawn = 0;

        try {
          const registrationResult = await MLMService.registerUser(userData);
          if (registrationResult.success) {
            createdUsers.push(registrationResult.user);
            console.log(`✅ Test user ${registrationResult.user.userId} created`);
          }
        } catch (error) {
          console.error(`❌ Error creating test user ${userData.username}:`, error.message);
        }
      }

      return createdUsers;
      
    } catch (error) {
      console.error('❌ Error creating test users:', error);
      throw error;
    }
  }

  // Display seeded data summary
  static async displaySummary() {
    try {
      console.log('\n📊 SEEDING SUMMARY');
      console.log('='.repeat(50));
      
      const totalUsers = await User.countDocuments();
      const adminUsers = await User.countDocuments({ isAdmin: true });
      const regularUsers = await User.countDocuments({ isAdmin: false });
      const activeUsers = await User.countDocuments({ isActive: true });
      const totalEarnings = await Earning.countDocuments();
      
      console.log(`👥 Total Users: ${totalUsers}`);
      console.log(`👑 Admin Users: ${adminUsers}`);
      console.log(`🙋 Regular Users: ${regularUsers}`);
      console.log(`✅ Active Users: ${activeUsers}`);
      console.log(`💰 Total Earnings Records: ${totalEarnings}`);
      
      // Show first 10 users
      console.log('\n👥 First 10 Users:');
      const users = await User.find({ isAdmin: false })
        .select('userId firstName lastName walletAddress totalEarnings')
        .limit(10)
        .sort({ createdAt: 1 });
      
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.userId} - ${user.firstName} ${user.lastName} - $${user.totalEarnings}`);
      });
      
      console.log('\n✅ Seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Error displaying summary:', error);
    }
  }

  // Main seeding function
  static async run(options = {}) {
    const {
      clearExisting = false,
      userCount = 30,
      createTestUsers = true
    } = options;

    try {
      console.log('🌱 Starting User Seeding Process...\n');
      
      // Clear existing data if requested
      if (clearExisting) {
        await this.clearData();
      }
      
      // Create admin user
      await this.createAdmin();
      
      // Create test users
      if (createTestUsers) {
        await this.createTestUsers();
      }
      
      // Seed regular users
      await this.seedUsers(userCount);
      
      // Display summary
      await this.displaySummary();
      
    } catch (error) {
      console.error('❌ Seeding process failed:', error);
      throw error;
    }
  }
}

// CLI execution
const runSeeder = async () => {
  try {
    await connectDB();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const clearExisting = args.includes('--clear');
    const userCount = args.includes('--count') ? 
      parseInt(args[args.indexOf('--count') + 1]) || 30 : 30;
    const skipTestUsers = args.includes('--no-test-users');
    
    console.log('🔧 Seeder Options:');
    console.log(`   Clear Existing: ${clearExisting}`);
    console.log(`   User Count: ${userCount}`);
    console.log(`   Create Test Users: ${!skipTestUsers}\n`);
    
    await UserSeeder.run({
      clearExisting,
      userCount,
      createTestUsers: !skipTestUsers
    });
    
    console.log('\n🎉 User seeding completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Export for use in other scripts
module.exports = UserSeeder;

// Run if called directly
if (require.main === module) {
  runSeeder();
}