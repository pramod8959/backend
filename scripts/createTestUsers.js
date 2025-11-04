const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createTestUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/crypto-mlm');
    console.log('Connected to MongoDB');

    // Get admin user to use as sponsor
    const adminUser = await User.findOne({ isAdmin: true });
    if (!adminUser) {
      console.log('Admin user not found! Please create admin first.');
      process.exit(1);
    }

    // Test users data
    const testUsers = [
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@cryptomlmpro.com',
        username: 'alice',
        phone: '+1234567891',
        password: 'test123456',
        paymentMethod: 'USDT',
        walletAddress: '0x1111111111111111111111111111111111111111'
      },
      {
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob@cryptomlmpro.com',
        username: 'bob',
        phone: '+1234567892',
        password: 'test123456',
        paymentMethod: 'BNB',
        walletAddress: '0x2222222222222222222222222222222222222222'
      },
      {
        firstName: 'Carol',
        lastName: 'Williams',
        email: 'carol@cryptomlmpro.com',
        username: 'carol',
        phone: '+1234567893',
        password: 'test123456',
        paymentMethod: 'USDT',
        walletAddress: '0x3333333333333333333333333333333333333333'
      },
      {
        firstName: 'David',
        lastName: 'Brown',
        email: 'david@cryptomlmpro.com',
        username: 'david',
        phone: '+1234567894',
        password: 'test123456',
        paymentMethod: 'BNB',
        walletAddress: '0x4444444444444444444444444444444444444444'
      }
    ];

    console.log('Creating test users...\n');

    for (let i = 0; i < testUsers.length; i++) {
      const userData = testUsers[i];
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Add sponsor information
      userData.sponsorCode = adminUser.referralCode;
      userData.sponsor = adminUser._id;
      userData.referralCode = userData.username.toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
      userData.paymentTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      const user = new User(userData);
      await user.save();

      console.log(`✅ User ${i + 1} created successfully!`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Referral Code: ${user.referralCode}`);
      console.log(`   Payment Method: ${user.paymentMethod}`);
      console.log(`   Wallet: ${user.walletAddress}`);
      console.log('');
    }

    console.log('🎉 All test users created successfully!');
    console.log('\n📋 Test User Credentials:');
    console.log('All users have password: test123456');
    console.log('Admin referral code: ADMIN');

  } catch (error) {
    console.error('Error creating test users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

createTestUsers();
