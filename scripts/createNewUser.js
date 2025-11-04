const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createNewUser = async () => {
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

    // Generate unique email and username
    const timestamp = Date.now();
    const userData = {
      firstName: 'Test',
      lastName: 'User',
      email: `testuser${timestamp}@cryptomlmpro.com`,
      username: `testuser${timestamp}`,
      phone: '+1234567890',
      password: 'test123456',
      referralCode: 'TEST' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      sponsorCode: adminUser.referralCode,
      sponsor: adminUser._id,
      paymentMethod: 'BNB',
      paymentTxHash: '0x' + Math.random().toString(16).substr(2, 64),
      walletAddress: '0x' + Math.random().toString(16).substr(2, 40)
    };

    console.log('Creating user with data:', {
      email: userData.email,
      username: userData.username,
      referralCode: userData.referralCode,
      sponsorCode: userData.sponsorCode
    });

    const user = new User(userData);
    const savedUser = await user.save();

    console.log('✅ New user created successfully!');
    console.log('ID:', savedUser._id);
    console.log('Email:', savedUser.email);
    console.log('Username:', savedUser.username);
    console.log('Password: test123456');
    console.log('Referral Code:', savedUser.referralCode);
    console.log('Wallet Address:', savedUser.walletAddress);
    console.log('Sponsor:', adminUser.username);

    // Verify user was saved by querying database
    const verifyUser = await User.findById(savedUser._id);
    if (verifyUser) {
      console.log('✅ User verification successful - user exists in database');
    } else {
      console.log('❌ User verification failed - user not found in database');
    }

  } catch (error) {
    console.error('❌ Error creating user:', error);
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', error.errors);
    }
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

createNewUser();
