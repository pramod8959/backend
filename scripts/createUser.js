const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/crypto-mlm');
    console.log('Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'test@cryptomlmpro.com' });
    if (existingUser) {
      console.log('Test user already exists!');
      console.log('Email:', existingUser.email);
      console.log('Username:', existingUser.username);
      console.log('Referral Code:', existingUser.referralCode);
      process.exit(0);
    }

    // Get admin user to use as sponsor
    const adminUser = await User.findOne({ isAdmin: true });
    if (!adminUser) {
      console.log('Admin user not found! Please create admin first.');
      console.log('Available users:', await User.find({}, 'email username isAdmin'));
      process.exit(1);
    }

    // Create test user
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'test@cryptomlmpro.com',
      username: 'testuser',
      phone: '+1234567890',
      password: 'test123456',
      referralCode: 'TESTUSER' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      sponsorCode: adminUser.referralCode,
      sponsor: adminUser._id,
      paymentMethod: 'BNB',
      paymentTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      walletAddress: '0x9876543210fedcba9876543210fedcba9876543210'
    };

    const user = new User(userData);
    await user.save();

    console.log('✅ Test user created successfully!');
    console.log('Email:', user.email);
    console.log('Username:', user.username);
    console.log('Password: test123456');
    console.log('Referral Code:', user.referralCode);
    console.log('Wallet Address:', user.walletAddress);
    console.log('Sponsor:', adminUser.username);

  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

createUser();
