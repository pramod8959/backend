# Tree Structure & Commission API Documentation

## Overview

This API provides comprehensive MLM tree structure visualization and commission management functionality for the SBW Platform.

## 💰 INCOME STRUCTURE

**Package Value:** $20 (100%)

### Direct Referral
**Amount:** $2 (10%)
**Description:** Get $2 instantly for every direct referral you make. This is the fastest way to start earning with Smart Business World.

### Level Income  
**Amount:** $1 per level (5% each)
**Description:** Earn 5% bonus on each level up to 15 levels deep. This creates a powerful residual income stream.

| Component | Amount | Percentage | Total Potential |
|-----------|--------|------------|-----------------|
| **Direct Referral** | $2 | 10% | $2 per referral |
| **Level Income (15 Levels)** | $1 each | 5% each | $15 maximum |
| **Creator Bonus** | $2 | 10% | System admin |
| **Development Fund** | $1 | 5% | Platform development |
| **TOTAL** | **$20** | **100%** | Complete package |

### Level Unlocking Criteria

| Direct Referrals | Levels Unlocked |
|-----------------|-----------------|
| 2 | 4 |
| 5 | 5 |
| 6 | 6 |
| 7 | 7 |
| 8 | 8 |
| 9 | 9 |
| 10 | 10 |
| 11 | 11 |
| 12 | 12 |
| 13 | 13 |
| 14 | 14 |
| 15 | 15 |

**Bonus:** Full 15 levels auto-unlock when your team size reaches 100 (any depth)

### Commission Types:
- `direct_referral`: Direct sponsor bonus ($2)
- `level_income`: Multi-level income ($1 per level)
- `creator_bonus`: System creator reward ($2)
- `development_bonus`: Development fund ($1)

### Key Highlights & Benefits:
- **Low Entry Barrier:** Only $20 to start your journey
- **Lifetime Earning:** Build a sustainable income stream
- **15-Level System:** Deep compensation plan with 15 levels
- **Transparent Structure:** Clear and scalable compensation plan
- **Auto Unlock System:** Automatic level unlocking as your team grows
- **Leadership Royalty:** Earn royalty bonuses as you reach leadership levels

## 🌳 Tree Structure Endpoints

### 1. Get User Tree Structure

**Endpoint:** `GET /api/tree/tree/:userId?`

**Description:** Get complete tree structure for a user with MLM calculations

**Parameters:**
- `userId` (optional): Target user ID. Defaults to current user
- `levels` (query): Maximum levels to fetch (default: 15)
- `stats` (query): Include statistics (`true`/`false`)

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/tree/tree/USER_ID?levels=10&stats=true"
```

**Example Response:**
```json
{
  "success": true,
  "message": "User tree retrieved successfully",
  "data": {
    "tree": {
      "id": "user_id",
      "userId": "SBW787",
      "firstName": "John",
      "lastName": "Doe",
      "directReferralsCount": 3,
      "unlockedLevels": 4,
      "teamFullyBuilt": false,
      "children": [
        {
          "id": "child_id",
          "userId": "SBW788",
          "firstName": "Jane",
          "lastName": "Smith",
          "children": [...]
        }
      ]
    },
    "statistics": {
      "totalTeamSize": 15,
      "directReferrals": 3,
      "indirectReferrals": 12,
      "unlockedLevels": 4,
      "earningsPotential": {
        "fromDirectReferrals": 6,
        "fromIndirectReferrals": 12,
        "totalPossible": 18
      }
    }
  }
}
```

### 2. Get Simplified Tree

**Endpoint:** `GET /api/tree/tree-simple/:userId?`

**Description:** Get simplified tree structure for better performance

**Parameters:**
- `userId` (optional): Target user ID
- `depth` (query): Maximum depth (default: 3)

### 3. Get User Statistics

**Endpoint:** `GET /api/tree/stats/:userId?`

**Description:** Get comprehensive MLM statistics for a user

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "SBW787",
      "name": "John Doe",
      "totalEarnings": 45
    },
    "team": {
      "directReferrals": 3,
      "totalTeamSize": 15,
      "unlockedLevels": 4,
      "levelsProgress": "4/15"
    },
    "earnings": {
      "fromDirectReferrals": 6,
      "fromIndirectReferrals": 12,
      "totalPossible": 18
    },
    "levelBreakdown": {
      "level1": {
        "currentMembers": 2,
        "expectedMembers": 2,
        "fillPercentage": "100.00",
        "isComplete": true
      }
    }
  }
}
```

---

## 💰 Commission System Endpoints

### 1. Distribute Commission

**Endpoint:** `POST /api/commissions/distribute/:newUserId`

**Description:** Manually trigger commission distribution for a new user registration

**Parameters:**
- `newUserId`: ID of the newly registered user

**Example Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/commissions/distribute/USER_ID"
```

**Example Response:**
```json
{
  "success": true,
  "message": "Commission distributed successfully",
  "data": {
    "newUser": {
      "userId": "SBW799",
      "name": "New User"
    },
    "totalDistributed": 8,
    "commissionsCount": 4,
    "uplineLevels": 4,
    "commissions": [
      {
        "recipientUserId": "SBW787",
        "level": 1,
        "amount": 2,
        "type": "direct_referral"
      },
      {
        "recipientUserId": "SBW786",
        "level": 2,
        "amount": 1,
        "type": "indirect_referral"
      }
    ]
  }
}
```

### 2. Get Commission Summary

**Endpoint:** `GET /api/commissions/summary/:userId?`

**Description:** Get comprehensive commission summary for a user

**Example Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "SBW787",
      "totalEarnings": 45
    },
    "summary": {
      "total": {
        "totalAmount": 45,
        "totalCommissions": 23
      },
      "breakdown": [
        {
          "_id": 1,
          "totalAmount": 6,
          "count": 3,
          "avgAmount": 2
        }
      ],
      "recent": [...] // Last 10 commissions
    }
  }
}
```

### 3. Get User Levels & Unlocking Status

**Endpoint:** `GET /api/commissions/levels/:userId?`

**Description:** Get detailed information about user's unlocked levels and requirements

**Example Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "directReferralsCount": 3,
      "unlockedLevels": 4,
      "teamFullyBuilt": false,
      "progressPercentage": "26.67"
    },
    "requirements": {
      "toUnlockLevel5": 2,
      "toUnlockLevel10": 7,
      "toUnlockLevel15": 12
    },
    "levelBreakdown": {
      "level1": {
        "isUnlocked": true,
        "currentMembers": 2,
        "expectedMembers": 2,
        "commissionPerMember": 2,
        "currentEarnings": 4,
        "potentialEarnings": 4
      }
    }
  }
}
```

### 4. Get Commission History

**Endpoint:** `GET /api/commissions/history/:userId?`

**Description:** Get paginated commission history

**Parameters:**
- `page` (query): Page number (default: 1)
- `limit` (query): Items per page (default: 20)
- `level` (query): Filter by specific level
- `type` (query): Filter by commission type

### 5. Get Potential Earnings

**Endpoint:** `GET /api/commissions/potential-earnings`

**Description:** Get maximum theoretical earnings breakdown

**Example Response:**
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "level1": {
        "level": 1,
        "expectedMembers": 2,
        "commissionPerMember": 2,
        "totalEarnings": 4
      },
      "level2": {
        "level": 2,
        "expectedMembers": 4,
        "commissionPerMember": 1,
        "totalEarnings": 4
      }
    },
    "totalMaxPotential": 65536,
    "currency": "USDT"
  }
}
```

### 6. Admin Commission Statistics

**Endpoint:** `GET /api/commissions/admin/stats`

**Description:** Get platform-wide commission statistics (Admin only)

---

## 🔧 Commission Rules Implementation

### Level Unlocking Criteria
- **2 direct referrals** → Unlock Levels 1–4
- **5 direct referrals** → Unlock Level 5
- **6 direct referrals** → Unlock Level 6
- ...
- **15 direct referrals** → Unlock Level 15
- **Bonus:** Complete 15-level team → Auto unlock all levels

### Commission Structure
- **Level 1 (Direct):** $2 per referral
- **Levels 2-15 (Indirect):** $1 per referral (only for unlocked levels)

### Binary Tree Structure
- Each user can have up to 2 direct referrals
- Level size doubles: Level 1 → 2, Level 2 → 4, Level 3 → 8, etc.
- Maximum potential: 65,536 people across 15 levels

---

## 📊 Database Schema

### Commission Model
```javascript
{
  fromUser: ObjectId,      // Who generated the commission
  toUser: ObjectId,        // Who receives the commission
  level: Number,           // Level in the tree (1-15)
  amount: Number,          // Commission amount ($2 or $1)
  commissionType: String,  // 'direct_referral' or 'indirect_referral'
  status: String,          // 'pending', 'paid', 'cancelled'
  triggerRegistration: ObjectId, // Registration that triggered this
  metadata: {
    directReferralsCount: Number,
    unlockedLevels: Number,
    teamSize: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚀 Usage Examples

### Frontend Integration

```javascript
// Get user's tree structure
const getTreeStructure = async (userId) => {
  const response = await fetch(`/api/tree/tree/${userId}?stats=true`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Distribute commission after registration
const distributeCommission = async (newUserId) => {
  const response = await fetch(`/api/commissions/distribute/${newUserId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Get user's MLM status
const getUserStatus = async (userId) => {
  const response = await fetch(`/api/commissions/levels/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

### Auto-Commission Distribution

The commission system automatically distributes commissions when new users register through the MLM service. Manual distribution is also available via the API endpoint.

---

## 🔐 Authentication & Authorization

- All endpoints require valid JWT token
- Users can only view their own data unless they're admin
- Admin users have access to all data and statistics
- Tree viewing has special permissions for upline members

---

## ⚡ Performance Considerations

- Tree building is optimized with proper indexes
- Large trees can be fetched with depth limits
- Simplified tree endpoint for performance-critical scenarios
- Pagination for commission history
- Caching recommended for frequently accessed data