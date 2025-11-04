const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('../models/User');

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/mlm-project');
    
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { email: 'admin@cryptomlmpro.com' },
        { username: 'admin' }
      ]
    });

    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Admin Details:');
      console.log('- Email:', existingAdmin.email);
      console.log('- Username:', existingAdmin.username);
      console.log('- Referral Code:', existingAdmin.referralCode);
      console.log('- Wallet Address:', existingAdmin.walletAddress);
      console.log('- Is Admin:', existingAdmin.isAdmin);
      process.exit(0);
    }

    // Create admin user
    const adminData = {
      referralCode: '0x723BAB979b9CAb06Dc28176cfFbC328c29e22EFC', // Admin wallet address as referral code
      sponsorCode: '0x723BAB979b9CAb06Dc28176cfFbC328c29e22EFC', // Self-referral for admin
      sponsor: null, // No sponsor for admin
      position: 'root', // Root position for admin
      level: 0, // Admin level
      isActive: true,
      registrationFee: 0, // No fee for admin
      paymentMethod: 'BNB',
      paymentTxHash: 'ADMIN_CREATION',
      totalEarnings: 0,
      totalWithdrawn: 0,
      walletAddress: '0x723BAB979b9CAb06Dc28176cfFbC328c29e22EFC',
      isAdmin: true
    };


    // Create the admin user
    const admin = new User(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('Admin Details:');
    console.log('- Referral Code:', admin.referralCode);
    console.log('- Wallet Address:', admin.walletAddress);
    console.log('- Is Admin:', admin.isAdmin);
    console.log('');
    console.log('🔑 Login: Use wallet address for authentication');
    console.log('');
    console.log('📝 Referral Code for new users: 0x723BAB979b9CAb06Dc28176cfFbC328c29e22EFC');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

// Run the script
createAdmin();
