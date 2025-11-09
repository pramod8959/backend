// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const compression = require('compression');
// const User = require('./models/User');
// const Earning = require('./models/Earning');
// const MLMService = require('./services/mlmService');
// const AutoMissedWalletProcessor = require('./services/autoMissedWalletProcessor');

// // Load environment variables
// dotenv.config();

// // Set JWT_SECRET if not provided
// if (!process.env.JWT_SECRET) {
//   process.env.JWT_SECRET = 'your-secret-key';
// }

// const app = express();
// const PORT = process.env.PORT || 5000;

// // Middleware
// app.use(compression()); // Enable gzip compression
// app.use(cors({
//   origin: [
//     'http://localhost:3000',
//     'https://mlm-project-sep-one.vercel.app',
//     'https://mlm-project-sen-one.vercel.app',
//     'https://*.vercel.app'
//   ],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
// }));
// app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // Auto-initialization function
// const initializeData = async () => {
//   try {
//     console.log('🔍 Checking if admin and users exist...');
    
//     // Check if admin exists
//     const adminExists = await User.findOne({ isAdmin: true });
//     const userCount = await User.countDocuments({ isAdmin: false });
    
//     if (adminExists && userCount >= 16) {
//       console.log('✅ Admin and users already exist. Skipping initialization.');
//       return;
//     }
    
//     console.log('🚀 Initializing admin and users...');
    
//     // Clear existing data if admin doesn't exist
//     if (!adminExists) {
//       await User.deleteMany({});
//       await Earning.deleteMany({});
//       console.log('✅ Cleared existing data');
//     }
    
//     // Create admin if doesn't exist
//     if (!adminExists) {
//       const admin = new User({
//         referralCode: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
//         sponsorCode: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
//         sponsor: null,
//         position: 'root',
//         level: 0,
//         isActive: true,
//         registrationFee: 0,
//         paymentMethod: 'BNB',
//         walletAddress: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
//         isAdmin: true,
//         totalEarnings: 0,
//         totalWithdrawn: 0
//       });
//       await admin.save();
//       console.log('✅ Created admin user');
//     }
    
 
//     console.log('✅ Initialization completed!');
//     console.log('🔑 Admin Login: admin@cryptomlm.com / admin123');
//     console.log('👥 Users Login: [username]@example.com / password123');
    
//     // Start automatic missed wallet processing (disabled - now processes on every registration)
//     // AutoMissedWalletProcessor.startAutoProcessing(30); // Process every 30 minutes
//     console.log('ℹ️  Missed wallet processing now happens automatically on every user registration');
    
//   } catch (error) {
//     console.error('❌ Error during initialization:', error);
//   }
// };

// // Connect to MongoDB
// mongoose.connect(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
// .then(async () => {
//   console.log('MongoDB connected successfully');
//   // Initialize data after successful connection
//   await initializeData();
  
//         // Auto-fix existing users earnings on server startup
//         console.log('🔧 Auto-fixing existing users earnings...');
//         await MLMService.fixExistingUsersEarnings();
        
//         // Auto-update all user levels on server startup
//         console.log('🔄 Auto-updating all user levels...');
//         await MLMService.updateAllUserLevels();
// })
// .catch(err => console.error('MongoDB connection error:', err));

// // Routes
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/users', require('./routes/users'));
// app.use('/api/earnings', require('./routes/earnings'));
// app.use('/api/withdrawals', require('./routes/withdrawals'));
// app.use('/api/admin', require('./routes/admin'));
// app.use('/api/wallet', require('./routes/walletCheck'));
// app.use('/api/mlm', require('./routes/mlm'));
// app.use('/api/public', require('./routes/public'));
// app.use('/api/kyc', require('./routes/kyc'));
// app.use('/api/achievers', require('./routes/achievers'));
// app.use('/api/notifications', require('./routes/notifications'));
// app.use('/api/missed-level-earnings', require('./routes/missedLevelEarnings'));
// app.use('/api/withdrawal-fees', require('./routes/withdrawalFees'));

// // Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     status: 'OK', 
//     message: 'SBW  Backend API is running',
//     timestamp: new Date().toISOString()
//   });
// });

// // Error handling middleware
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).json({ 
//     success: false, 
//     message: 'Something went wrong!',
//     error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
//   });
// });

// // 404 handler - catch all unmatched routes
// app.use((req, res) => {
//   res.status(404).json({ 
//     success: false, 
//     message: 'API endpoint not found',
//     path: req.path,
//     method: req.method
//   });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`Environment: ${process.env.NODE_ENV}`);
// });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const User = require('./models/User');
const Earning = require('./models/Earning');
const MLMService = require('./services/mlmService');
const AutoMissedWalletProcessor = require('./services/autoMissedWalletProcessor');

// Load environment variables
dotenv.config();

// Set JWT_SECRET if not provided
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'your-secret-key';
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression()); // Enable gzip compression
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173', // Vite default port
    'https://mlm-project-sep-one.vercel.app',
    'https://mlm-project-sen-one.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Auto-initialization function
const initializeData = async () => {
  try {
    
    // Check if admin exists
    const adminExists = await User.findOne({ isAdmin: true });
    const userCount = await User.countDocuments({ isAdmin: false });
    
    if (adminExists && userCount >= 16) {
      return;
    }
    
    
    // Clear existing data if admin doesn't exist
    if (!adminExists) {
      await User.deleteMany({});
      await Earning.deleteMany({});
    }
    
    // Create admin if doesn't exist
    if (!adminExists) {
      const admin = new User({
        referralCode: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
        sponsorCode: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
        sponsor: null,
        position: 'root',
        level: 0,
        isActive: true,
        registrationFee: 0,
        paymentMethod: 'BNB',
        walletAddress: '0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b',
        isAdmin: true,
        totalEarnings: 0,
        totalWithdrawn: 0
      });
      await admin.save();
    }
    
 
    
    // Start automatic missed wallet processing (disabled - now processes on every registration)
    // AutoMissedWalletProcessor.startAutoProcessing(30); // Process every 30 minutes
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ MongoDB connected successfully');
  
  // Initialize data after successful connection
  await initializeData();
  console.log('✅ Data initialization completed');
  
  // Auto-fix existing users earnings on server startup
  console.log('🔧 Starting MLM earnings fix...');
  await MLMService.fixExistingUsersEarnings();
  console.log('✅ MLM earnings fix completed');
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/earnings', require('./routes/earnings'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/wallet', require('./routes/walletCheck'));
app.use('/api/mlm', require('./routes/mlm'));
app.use('/api/public', require('./routes/public'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/achievers', require('./routes/achievers'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/missed-level-earnings', require('./routes/missedLevelEarnings'));
app.use('/api/withdrawal-fees', require('./routes/withdrawalFees'));
app.use('/api/fix-earnings', require('./routes/fixEarnings'));
app.use('/api/earnings-calculator', require('./routes/earningsCalculator'));
app.use('/api/tree', require('./routes/treeStructure'));
app.use('/api/commissions', require('./routes/commissions'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SBW  Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});