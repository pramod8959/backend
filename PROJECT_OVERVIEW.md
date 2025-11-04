# 🏢 SBW (Smart Business World) Backend Project Overview

## 📋 Project Summary

**SBW Platform Backend API** - A comprehensive MLM (Multi-Level Marketing) cryptocurrency platform backend built with Node.js, Express, and MongoDB.

### 🎯 Core Purpose
- **MLM Management System**: 15-level binary tree structure
- **Crypto Referral Platform**: Wallet-based authentication & earnings
- **Commission Distribution**: Automated income distribution system
- **User Management**: Registration, KYC, withdrawals, notifications

---

## 🏗️ Technical Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend** | Node.js + Express | REST API Server |
| **Database** | MongoDB + Mongoose | Data Storage |
| **Authentication** | JWT + Wallet Login | Security |
| **File Storage** | Cloudinary | Image/Document uploads |
| **API Testing** | Postman Collection | Testing & Documentation |

**Server Details:**
- **Port:** 3000 (configurable via ENV)
- **Environment:** Development/Production ready
- **CORS:** Enabled for multiple frontends

---

## 💰 Income Structure (Updated)

### Direct Referral
- **Amount:** $2 (10% of $20 package)
- **Trigger:** Immediate sponsor gets instant payment

### Level Income  
- **Amount:** $1 per level (5% each)
- **Levels:** Up to 15 levels deep
- **Total Potential:** $15 maximum per registration

### Additional Bonuses
- **Creator Bonus:** $2 (10%) → System admin
- **Development Fund:** $1 (5%) → Platform development

### Level Unlocking
- 2 direct referrals → 4 levels unlocked
- 5+ direct referrals → Corresponding levels unlocked
- **Bonus:** 100 team members → All 15 levels auto-unlock

---

## 🛠️ API Endpoints Overview

### 🔐 Authentication (`/api/auth`)
- `POST /register` - User registration with sponsor system
- `POST /wallet-login` - Cryptocurrency wallet authentication
- `GET /profile` - User profile information
- `PUT /profile` - Update user profile
- `GET /debug-wallets` - Debug wallet addresses
- `GET /debug-referral-codes` - Debug referral codes

### 👥 User Management (`/api/users`)
- User CRUD operations
- Profile management
- Team member listing
- User statistics and analytics

### 💳 Earnings System (`/api/earnings`)
- Earnings history and tracking
- Income calculations
- Earning reports and analytics

### 🏦 Withdrawal System (`/api/withdrawals`)
- Withdrawal requests
- Processing and approval
- Transaction history
- Fee calculations

### 👑 Admin Panel (`/api/admin`)
- Admin dashboard functionality
- User management
- System statistics
- Platform controls

### 💼 Wallet Operations (`/api/wallet`)
- Wallet verification
- Balance checks
- Transaction validation

### 🌐 MLM System (`/api/mlm`)
- MLM tree operations
- Referral management
- Level calculations

### 🔓 Public Access (`/api/public`)
- Public information
- System statistics
- Platform information

### 📋 KYC System (`/api/kyc`)
- Know Your Customer verification
- Document uploads
- Approval workflows

### 🏆 Achievers (`/api/achievers`)
- Top performer tracking
- Achievement systems
- Leaderboards

### 🔔 Notifications (`/api/notifications`)
- User notifications
- System alerts
- Communication management

### 📊 Missed Earnings (`/api/missed-level-earnings`)
- Missed commission tracking
- Recovery systems
- Earnings optimization

### 💵 Withdrawal Fees (`/api/withdrawal-fees`)
- Fee structure management
- Fee calculations
- Cost optimization

### 🔧 Earnings Fix (`/api/fix-earnings`)
- Earnings correction tools
- Data integrity fixes
- Commission recalculations

### 🧮 Earnings Calculator (`/api/earnings-calculator`)
- Income projections
- Commission calculations
- ROI estimations

### 🌳 Tree Structure (`/api/tree`)
- **`GET /tree/:userId`** - Get complete MLM tree structure
- **`GET /tree/:userId/levels/:level`** - Get specific level members
- **`GET /tree/:userId/stats`** - Get tree statistics
- Visual tree representation with earnings data

### 💰 Commission System (`/api/commissions`)
- **`POST /distribute/:newUserId`** - Distribute commissions for new user
- **`GET /summary/:userId`** - Get commission summary
- **`GET /history/:userId`** - Get commission history
- **`GET /levels/:userId`** - Get level-wise commission breakdown

---

## 📄 Database Models

### Core Models (10 total):
1. **User** - User accounts, referral tree, wallet addresses
2. **Commission** - Commission tracking and distribution
3. **Earning** - Individual earning records
4. **Transaction** - Financial transaction history
5. **Withdrawal** - Withdrawal requests and processing
6. **WithdrawalFee** - Fee structure management
7. **KYC** - Know Your Customer verification
8. **Notification** - User notification system
9. **Achiever** - Top performer tracking
10. **MissedLevelEarning** - Missed commission tracking

---

## ⚙️ Services (4 core services)

### 1. **MLM Service** (`mlmService.js`)
- User registration and tree building
- Level calculations and team management
- Earnings distribution logic
- Team size calculations

### 2. **Commission Service** (`commissionService.js`)
- **NEW:** Updated income distribution model
- Progressive commission calculations
- Level unlocking logic
- Creator and development bonuses

### 3. **Transaction Service** (`transactionService.js`)
- Financial transaction processing
- Payment verification
- Transaction history management

### 4. **Auto Missed Wallet Processor** (`autoMissedWalletProcessor.js`)
- Automatic missed earnings processing
- Background task management
- Earnings recovery systems

---

## 🧪 Development Tools

### Scripts Available:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run create-admin` - Create admin user
- `npm run create-user` - Create new user
- `npm run create-test-users` - Create test users
- `npm run seed-users` - Seed comprehensive user data
- `npm run seed-simple` - Simple user seeding

### Testing:
- **Postman Collection:** `SBW_MLM_API_Collection.postman_collection.json`
- **Environment:** `SBW_MLM_Environment.postman_environment.json`
- **Documentation:** `/docs/POSTMAN_TESTING_GUIDE.md`

---

## 🚀 Current Features

### ✅ Implemented & Working:
- **Complete MLM System:** 15-level binary tree
- **Wallet Authentication:** Crypto wallet login
- **Commission Distribution:** Automated income distribution
- **Tree Visualization:** Complete tree structure APIs
- **Admin Dashboard:** Full admin controls
- **KYC System:** Document verification
- **Withdrawal System:** Payment processing
- **Notification System:** User communications
- **Earnings Tracking:** Complete earning history

### 🔧 Recently Updated:
- **Income Structure:** Updated to match marketing materials
- **Commission Logic:** Simplified $1 per level (5% each)
- **Level Unlocking:** Based on direct referrals
- **Auto Unlock:** 100 team members unlock all levels
- **Documentation:** Complete API documentation

---

## 📊 Key Statistics

- **Total API Endpoints:** 50+ endpoints across 17 route files
- **Database Models:** 10 comprehensive models
- **Authentication:** JWT + Wallet-based security
- **MLM Levels:** 15-level deep compensation plan
- **Commission Types:** 4 types (direct, level, creator, development)
- **Auto Features:** Automatic earnings, level unlocking, team management

---

## 🎯 Business Model

**Smart Business World** is a cryptocurrency-based MLM platform where:

1. **Users join with $20 packages**
2. **Direct referrals earn $2 instantly**
3. **Level income provides $1 per level (up to 15 levels)**
4. **Progressive unlocking based on team building**
5. **Creator and development funds ensure sustainability**

**Maximum earning per registration:** $17 (Direct $2 + Level $15)
**Platform sustainability:** $3 (Creator $2 + Development $1)
**Total package distribution:** $20 (100%)

This creates a transparent, scalable, and sustainable MLM ecosystem with clear income opportunities and fair distribution.