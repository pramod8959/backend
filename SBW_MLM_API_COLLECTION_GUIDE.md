# 📊 SBW MLM API Collection - Detailed Endpoint Guide

## 📋 Collection Overview

The **SBW MLM API Collection** contains comprehensive testing endpoints for the Smart Business World MLM platform. It includes 16 carefully designed endpoints organized into 4 main categories with automatic token management and response handling.

---

## 🔐 **1. Authentication Endpoints**

### 🏥 **Health Check**
```
GET {{base_url}}/api/health
```
**Purpose:** System health verification and server status check
**Authentication:** None required
**Response:**
```json
{
  "status": "OK",
  "message": "SBW Backend API is running",
  "timestamp": "2025-11-03T10:30:00.000Z"
}
```
**Use Case:** 
- Verify server is running before testing
- Check API connectivity
- Monitor system health

---

### 👑 **Admin Login**
```
POST {{base_url}}/api/auth/wallet-login
Content-Type: application/json

{
  "walletAddress": "0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b"
}
```
**Purpose:** Authenticate as system administrator
**Authentication:** Wallet-based login
**Auto-Features:**
- Automatically saves `admin_token` to environment
- Saves `admin_user_id` for subsequent requests
- Provides admin-level access to all endpoints

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin_user_id",
    "userId": "SBW786",
    "isAdmin": true,
    "walletAddress": "0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b"
  }
}
```

---

### 👤 **User Login (Test User)**
```
POST {{base_url}}/api/auth/wallet-login
Content-Type: application/json

{
  "walletAddress": "0x1234567890123456789012345678901234567890"
}
```
**Purpose:** Authenticate as regular test user
**Authentication:** Wallet-based login
**Auto-Features:**
- Automatically saves `user_token` to environment
- Saves `test_user_id` for user-specific tests
- Provides user-level access to endpoints

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "test_user_id",
    "userId": "SBW787",
    "isAdmin": false,
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }
}
```

---

## 🌳 **2. Tree Structure Endpoints**

### 🌲 **Get My Tree (Full)**
```
GET {{base_url}}/api/tree/tree?levels=10&stats=true
Authorization: Bearer {{admin_token}}
```
**Purpose:** Get complete MLM tree structure for current user
**Authentication:** Bearer token required
**Parameters:**
- `levels=10`: Fetch up to 10 levels deep
- `stats=true`: Include tree statistics

**Response:**
```json
{
  "success": true,
  "message": "User tree retrieved successfully",
  "data": {
    "tree": {
      "id": "user_id",
      "userId": "SBW786",
      "firstName": "Admin",
      "lastName": "User",
      "directReferralsCount": 2,
      "unlockedLevels": 4,
      "teamFullyBuilt": false,
      "totalEarnings": 150.00,
      "children": [
        {
          "id": "child_id",
          "userId": "SBW787",
          "firstName": "John",
          "lastName": "Doe",
          "children": [...]
        }
      ]
    },
    "statistics": {
      "totalTeamMembers": 25,
      "levelsWithMembers": 5,
      "totalEarnings": 150.00,
      "potentialEarnings": 250.00
    }
  }
}
```

**Use Cases:**
- View complete team structure
- Analyze team growth and performance
- Calculate potential earnings
- Track direct and indirect referrals

---

### 🎯 **Get Specific User Tree**
```
GET {{base_url}}/api/tree/tree/{{test_user_id}}?levels=5&stats=true
Authorization: Bearer {{admin_token}}
```
**Purpose:** Get tree structure for a specific user (Admin only)
**Authentication:** Admin token required
**Parameters:**
- `{{test_user_id}}`: Dynamic user ID from environment
- `levels=5`: Limit to 5 levels for performance
- `stats=true`: Include comprehensive statistics

**Use Cases:**
- Admin monitoring of user teams
- Team analysis and support
- Commission calculation verification
- Performance tracking

---

### ⚡ **Get Simple Tree (Performance)**
```
GET {{base_url}}/api/tree/tree-simple?depth=3
Authorization: Bearer {{user_token}}
```
**Purpose:** Lightweight tree view for mobile/performance-sensitive applications
**Authentication:** User token required
**Parameters:**
- `depth=3`: Limit depth for faster loading

**Response:**
```json
{
  "success": true,
  "data": {
    "tree": {
      "userId": "SBW787",
      "name": "John Doe",
      "level": 0,
      "directReferrals": 2,
      "children": [
        {
          "userId": "SBW788",
          "name": "Jane Smith",
          "level": 1,
          "directReferrals": 1
        }
      ]
    }
  }
}
```

**Use Cases:**
- Mobile app tree display
- Quick team overview
- Performance-optimized views
- Dashboard summaries

---

### 📊 **Get Tree Statistics Only**
```
GET {{base_url}}/api/tree/stats
Authorization: Bearer {{user_token}}
```
**Purpose:** Get only statistical data without full tree structure
**Authentication:** User token required

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "SBW787",
    "directReferralsCount": 2,
    "unlockedLevels": 4,
    "teamSize": 15,
    "totalEarnings": 45.00,
    "potentialEarnings": 75.00,
    "levelBreakdown": {
      "level1": 2,
      "level2": 4,
      "level3": 6,
      "level4": 3
    }
  }
}
```

**Use Cases:**
- Dashboard widgets
- Quick statistics display
- Performance metrics
- Level progression tracking

---

## 💰 **3. Commission System Endpoints**

### 📈 **Get Commission Summary**
```
GET {{base_url}}/api/commissions/summary
Authorization: Bearer {{user_token}}
```
**Purpose:** Get comprehensive commission summary for user
**Authentication:** User token required

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "SBW787",
    "totalCommissions": 45.00,
    "totalPaid": 45.00,
    "totalPending": 0.00,
    "commissionBreakdown": {
      "direct_referral": 6.00,
      "level_income": 35.00,
      "creator_bonus": 4.00,
      "development_bonus": 0.00
    },
    "monthlyEarnings": 15.00,
    "lifetimeEarnings": 45.00
  }
}
```

**Use Cases:**
- Earnings dashboard
- Financial tracking
- Performance analysis
- Income verification

---

### 🔓 **Get My Levels & Unlock Status**
```
GET {{base_url}}/api/commissions/levels
Authorization: Bearer {{user_token}}
```
**Purpose:** Check level unlock status and commission eligibility
**Authentication:** User token required

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "SBW787",
    "directReferrals": 2,
    "unlockedLevels": 4,
    "teamSize": 15,
    "canReceiveLevels": [1, 2, 3, 4],
    "lockedLevels": [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    "nextUnlockRequirement": {
      "currentDirectReferrals": 2,
      "requiredDirectReferrals": 5,
      "levelsToUnlock": 5
    }
  }
}
```

**Use Cases:**
- Level progression tracking
- Goal setting for users
- Commission eligibility verification
- Motivational displays

---

### 📜 **Get Commission History**
```
GET {{base_url}}/api/commissions/history?page=1&limit=10
Authorization: Bearer {{user_token}}
```
**Purpose:** Retrieve paginated commission transaction history
**Authentication:** User token required
**Parameters:**
- `page=1`: Page number for pagination
- `limit=10`: Number of records per page

**Response:**
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "commission_id",
        "fromUser": "SBW788",
        "amount": 2.00,
        "commissionType": "direct_referral",
        "level": 1,
        "description": "Direct referral bonus from SBW788",
        "status": "paid",
        "createdAt": "2025-11-03T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCommissions": 25,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Use Cases:**
- Transaction history display
- Audit trails
- Payment verification
- Financial reporting

---

### ⚙️ **Distribute Commission (Manual)**
```
POST {{base_url}}/api/commissions/distribute/{{test_user_id}}
Authorization: Bearer {{admin_token}}
```
**Purpose:** Manually trigger commission distribution (Admin only)
**Authentication:** Admin token required
**Parameters:**
- `{{test_user_id}}`: Target user ID for commission distribution

**Response:**
```json
{
  "success": true,
  "message": "Commission distributed successfully for SBW787",
  "data": {
    "newUser": {
      "id": "user_id",
      "userId": "SBW787",
      "name": "John Doe"
    },
    "totalDistributed": 20.00,
    "commissionsCount": 3,
    "uplineLevels": 15,
    "commissions": [
      {
        "recipientUserId": "SBW786",
        "level": 1,
        "amount": 2.00,
        "type": "direct_referral"
      },
      {
        "recipientUserId": "DEVELOPMENT_FUND",
        "level": -1,
        "amount": 1.00,
        "type": "development_bonus"
      }
    ]
  }
}
```

**Use Cases:**
- Manual commission corrections
- Testing commission logic
- Administrative overrides
- System maintenance

---

### 💡 **Get Potential Earnings**
```
GET {{base_url}}/api/commissions/potential-earnings
Authorization: Bearer {{user_token}}
```
**Purpose:** Calculate potential earnings based on current team structure
**Authentication:** User token required

**Response:**
```json
{
  "success": true,
  "data": {
    "currentEarnings": 45.00,
    "potentialEarnings": 150.00,
    "missingEarnings": 105.00,
    "projections": {
      "ifLevel5Unlocked": 65.00,
      "ifLevel10Unlocked": 95.00,
      "ifAllLevelsUnlocked": 150.00
    },
    "recommendations": [
      "Recruit 3 more direct referrals to unlock level 5",
      "Focus on team building to reach 100 members for auto-unlock"
    ]
  }
}
```

**Use Cases:**
- Motivation and goal setting
- Income projections
- Strategic planning
- User engagement

---

### 📊 **Admin Commission Stats**
```
GET {{base_url}}/api/commissions/admin/stats
Authorization: Bearer {{admin_token}}
```
**Purpose:** Platform-wide commission statistics (Admin only)
**Authentication:** Admin token required

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCommissionsPaid": 15420.00,
    "totalUsers": 157,
    "averageEarningsPerUser": 98.22,
    "commissionsByType": {
      "direct_referral": 4680.00,
      "level_income": 8740.00,
      "creator_bonus": 1560.00,
      "development_bonus": 440.00
    },
    "monthlyStats": {
      "currentMonth": 2840.00,
      "lastMonth": 2150.00,
      "growth": "+32.1%"
    }
  }
}
```

**Use Cases:**
- Platform analytics
- Financial reporting
- Business intelligence
- Performance monitoring

---

## 👥 **4. User Management Endpoints**

### 👑 **Get All Users (Admin)**
```
GET {{base_url}}/api/users
Authorization: Bearer {{admin_token}}
```
**Purpose:** Retrieve all platform users (Admin only)
**Authentication:** Admin token required

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user_id",
        "userId": "SBW787",
        "firstName": "John",
        "lastName": "Doe",
        "walletAddress": "0x1234...7890",
        "totalEarnings": 45.00,
        "directReferrals": 2,
        "teamSize": 15,
        "joinDate": "2025-10-15T10:30:00.000Z",
        "isActive": true
      }
    ],
    "totalUsers": 157,
    "activeUsers": 142,
    "totalEarnings": 15420.00
  }
}
```

**Use Cases:**
- User management dashboard
- Platform overview
- User support
- Analytics and reporting

---

### 👤 **Get User Profile**
```
GET {{base_url}}/api/auth/profile
Authorization: Bearer {{user_token}}
```
**Purpose:** Get current user's profile information
**Authentication:** User token required

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "userId": "SBW787",
    "firstName": "John",
    "lastName": "Doe",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "referralCode": "0x1234567890123456789012345678901234567890",
    "sponsorCode": "0x8b3c82698cebaf7f6b2d2a74079dc811d2d1566b",
    "totalEarnings": 45.00,
    "totalWithdrawn": 0.00,
    "level": 4,
    "directReferrals": 2,
    "teamSize": 15,
    "joinDate": "2025-10-15T10:30:00.000Z",
    "isActive": true,
    "kycStatus": "approved"
  }
}
```

**Use Cases:**
- Profile display
- Account information
- Settings management
- Verification status

---

### ➕ **Register New User**
```
POST {{base_url}}/api/auth/register
Content-Type: application/json

{
  "sponsorCode": "0x8b3c82698cebaf7f6b2d2a74079dc811d2d1566b",
  "walletAddress": "0x9999999999999999999999999999999999999999",
  "paymentMethod": "USDT",
  "paymentTxHash": "0xabcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234"
}
```
**Purpose:** Register new user in the MLM system
**Authentication:** None required (public registration)

**Request Body:**
- `sponsorCode`: Referral code of sponsor
- `walletAddress`: User's cryptocurrency wallet
- `paymentMethod`: Payment method used (USDT, BNB, etc.)
- `paymentTxHash`: Blockchain transaction hash for verification

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "new_user_id",
    "userId": "SBW999",
    "walletAddress": "0x9999999999999999999999999999999999999999",
    "referralCode": "0x9999999999999999999999999999999999999999",
    "sponsor": "SBW786",
    "level": 0,
    "isActive": true
  },
  "commissionDistribution": {
    "totalDistributed": 20.00,
    "directSponsorEarned": 2.00,
    "levelsTriggered": 4
  }
}
```

**Auto-Triggers:**
- Commission distribution to upline
- MLM tree structure update
- Notification to sponsor
- Earnings calculations

**Use Cases:**
- New user onboarding
- MLM network expansion
- Commission triggering
- Tree structure building

---

## 🔧 **Environment Variables**

The collection uses these dynamic variables:

| Variable | Purpose | Auto-Set By |
|----------|---------|-------------|
| `{{base_url}}` | API server URL | Manual setup |
| `{{admin_token}}` | Admin JWT token | Admin Login endpoint |
| `{{user_token}}` | User JWT token | User Login endpoint |
| `{{admin_user_id}}` | Admin user ID | Admin Login endpoint |
| `{{test_user_id}}` | Test user ID | User Login endpoint |

---

## 🎯 **Testing Workflow**

### Recommended Testing Sequence:

1. **🏥 Health Check** - Verify server status
2. **👑 Admin Login** - Get admin access
3. **👤 User Login** - Get user access  
4. **🌳 Tree Structure Tests** - Verify MLM tree
5. **💰 Commission Tests** - Test income distribution
6. **👥 User Management** - Test user operations
7. **➕ New Registration** - Test complete flow

### Key Features:

- **Automatic Token Management**: Tokens saved automatically
- **Dynamic Variables**: User IDs stored for reuse
- **Error Handling**: Comprehensive response validation
- **Documentation**: Each endpoint fully documented
- **Real-world Scenarios**: Tests cover actual use cases

This collection provides complete testing coverage for the SBW MLM platform, ensuring all critical functionality works correctly!