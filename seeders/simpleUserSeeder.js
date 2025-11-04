const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected for simple seeding');
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

// Simple user seeder without MLM complexity
class SimpleUserSeeder {
  
  // Create admin user
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

  // Create simple users without complex MLM logic
  static async createSimpleUsers(count = 10) {
    try {
      console.log(`👥 Creating ${count} simple users...`);
      
      const admin = await User.findOne({ isAdmin: true });
      if (!admin) {
        throw new Error('Admin user not found');
      }

      const users = [];
      const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Tom', 'Anna'];
      const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

      for (let i = 0; i < count; i++) {
        const firstName = firstNames[i % firstNames.length];
        const lastName = lastNames[i % lastNames.length];
        const walletAddress = generateWalletAddress();
        
        const userData = {
          firstName,
          lastName,
          username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${i}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
          walletAddress,
          referralCode: walletAddress.toLowerCase(),
          sponsorCode: admin.referralCode,
          sponsor: admin._id,
          position: i % 2 === 0 ? 'left' : 'right',
          level: 1,
          paymentMethod: Math.random() > 0.5 ? 'USDT' : 'BNB',
          paymentTxHash: generateTxHash(),
          registrationFee: 20,
          isActive: true,
          totalEarnings: Math.floor(Math.random() * 100), // Random earnings for testing
          exactEarning: 0,
          totalWithdrawn: 0
        };

        try {
          const user = new User(userData);
          await user.save();
          users.push(user);
          console.log(`✅ Created user ${user.userId}: ${firstName} ${lastName}`);
        } catch (error) {
          console.error(`❌ Error creating user ${i + 1}:`, error.message);
        }
      }

      console.log(`✅ Successfully created ${users.length} simple users`);
      return users;
      
    } catch (error) {
      console.error('❌ Error creating simple users:', error);
      throw error;
    }
  }

  // Display summary
  static async displaySummary() {
    try {
      console.log('\n📊 SIMPLE SEEDING SUMMARY');
      console.log('='.repeat(50));
      
      const totalUsers = await User.countDocuments();
      const adminUsers = await User.countDocuments({ isAdmin: true });
      const regularUsers = await User.countDocuments({ isAdmin: false });
      const activeUsers = await User.countDocuments({ isActive: true });
      
      console.log(`👥 Total Users: ${totalUsers}`);
      console.log(`👑 Admin Users: ${adminUsers}`);
      console.log(`🙋 Regular Users: ${regularUsers}`);
      console.log(`✅ Active Users: ${activeUsers}`);
      
      // Show all users
      console.log('\n👥 All Users:');
      const users = await User.find()
        .select('userId firstName lastName walletAddress totalEarnings isAdmin')
        .sort({ createdAt: 1 });
      
      users.forEach((user, index) => {
        const role = user.isAdmin ? '[ADMIN]' : '';
        console.log(`${index + 1}. ${user.userId} - ${user.firstName} ${user.lastName} ${role} - $${user.totalEarnings}`);
      });
      
      console.log('\n✅ Simple seeding completed successfully!');
      
    } catch (error) {
      console.error('❌ Error displaying summary:', error);
    }
  }

  // Main run function
  static async run(userCount = 10) {
    try {
      console.log('🌱 Starting Simple User Seeding Process...\n');
      
      await this.createAdmin();
      await this.createSimpleUsers(userCount);
      await this.displaySummary();
      
    } catch (error) {
      console.error('❌ Simple seeding process failed:', error);
      throw error;
    }
  }
}

// CLI execution
const runSimpleSeeder = async () => {
  try {
    await connectDB();
    
    const userCount = process.argv[2] ? parseInt(process.argv[2]) : 10;
    console.log(`🔧 Creating ${userCount} users\n`);
    
    await SimpleUserSeeder.run(userCount);
    
    console.log('\n🎉 Simple user seeding completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Simple seeding failed:', error);
    process.exit(1);
  }
};

// Export for use in other scripts
module.exports = SimpleUserSeeder;

// Run if called directly
if (require.main === module) {
  runSimpleSeeder();
}