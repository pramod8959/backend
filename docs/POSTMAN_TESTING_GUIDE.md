# Postman Testing Guide for SBW MLM APIs

## 🚀 Setup Instructions

### 1. Import Environment Variables

Create a new environment in Postman with these variables:

```json
{
  "base_url": "http://localhost:3000",
  "admin_token": "",
  "user_token": "",
  "test_user_id": "",
  "admin_user_id": ""
}
```

### 2. Get Authentication Tokens

Before testing the MLM APIs, you need to get authentication tokens.

---

## 🔐 Authentication Setup

### Step 1: Admin Login (Wallet-based)

**Method:** `POST`
**URL:** `{{base_url}}/api/auth/wallet-login`
**Headers:**
```json
{
  "Content-Type": "application/json"
}
```
**Body (JSON):**
```json
{
  "walletAddress": "0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Wallet login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin_id",
    "userId": "ADMIN001",
    "isAdmin": true
  }
}
```

**Save Token:** Copy the `token` value to your environment variable `admin_token`

### Step 2: Regular User Login

**Method:** `POST`
**URL:** `{{base_url}}/api/auth/wallet-login`
**Body (JSON):**
```json
{
  "walletAddress": "0x1234567890123456789012345678901234567890"
}
```

**Save Token:** Copy the token to `user_token` environment variable

---

## 🌳 Tree Structure API Tests

### Test 1: Get User Tree Structure

**Method:** `GET`
**URL:** `{{base_url}}/api/tree/tree?levels=5&stats=true`
**Headers:**
```json
{
  "Authorization": "Bearer {{admin_token}}"
}
```

**Expected Response:**
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
      "directReferralsCount": 2,
      "unlockedLevels": 4,
      "children": [...]
    },
    "statistics": {
      "totalTeamSize": 10,
      "directReferrals": 2,
      "unlockedLevels": 4
    }
  }
}
```

### Test 2: Get Specific User Tree

**Method:** `GET`
**URL:** `{{base_url}}/api/tree/tree/{{test_user_id}}?levels=10&stats=true`
**Headers:**
```json
{
  "Authorization": "Bearer {{admin_token}}"
}
```

### Test 3: Get Simple Tree (Performance Optimized)

**Method:** `GET`
**URL:** `{{base_url}}/api/tree/tree-simple?depth=3`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

### Test 4: Get User Statistics Only

**Method:** `GET`
**URL:** `{{base_url}}/api/tree/stats`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

---

## 💰 Commission System Tests

### Test 5: Get Commission Summary

**Method:** `GET`
**URL:** `{{base_url}}/api/commissions/summary`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "SBW787",
      "totalEarnings": 25
    },
    "summary": {
      "total": {
        "totalAmount": 25,
        "totalCommissions": 15
      },
      "breakdown": [...],
      "recent": [...]
    }
  }
}
```

### Test 6: Get User Levels & Unlock Status

**Method:** `GET`
**URL:** `{{base_url}}/api/commissions/levels`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "directReferralsCount": 3,
      "unlockedLevels": 4,
      "progressPercentage": "26.67"
    },
    "requirements": {
      "toUnlockLevel5": 2,
      "toUnlockLevel10": 7
    },
    "levelBreakdown": {
      "level1": {
        "isUnlocked": true,
        "currentMembers": 2,
        "currentEarnings": 4
      }
    }
  }
}
```

### Test 7: Distribute Commission (Manual)

**Method:** `POST`
**URL:** `{{base_url}}/api/commissions/distribute/{{test_user_id}}`
**Headers:**
```json
{
  "Authorization": "Bearer {{admin_token}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Commission distributed successfully",
  "data": {
    "totalDistributed": 8,
    "commissionsCount": 4,
    "commissions": [
      {
        "recipientUserId": "SBW787",
        "level": 1,
        "amount": 2,
        "type": "direct_referral"
      }
    ]
  }
}
```

### Test 8: Get Commission History

**Method:** `GET`
**URL:** `{{base_url}}/api/commissions/history?page=1&limit=10&level=1`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

### Test 9: Get Potential Earnings

**Method:** `GET`
**URL:** `{{base_url}}/api/commissions/potential-earnings`
**Headers:**
```json
{
  "Authorization": "Bearer {{user_token}}"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "breakdown": {
      "level1": {
        "expectedMembers": 2,
        "commissionPerMember": 2,
        "totalEarnings": 4
      }
    },
    "totalMaxPotential": 65536,
    "currency": "USDT"
  }
}
```

### Test 10: Admin Commission Statistics

**Method:** `GET`
**URL:** `{{base_url}}/api/commissions/admin/stats`
**Headers:**
```json
{
  "Authorization": "Bearer {{admin_token}}"
}
```

---

## 🧪 Complete Test Workflow

### Step-by-Step Testing Process:

1. **Start Server**
   ```bash
   npm start
   ```

2. **Test Health Check**
   - **Method:** `GET`
   - **URL:** `{{base_url}}/api/health`
   - **Expected:** `{"status": "OK", "message": "SBW Backend API is running"}`

3. **Login as Admin**
   - Use wallet login endpoint
   - Save admin token

4. **Create Test Users** (Optional)
   - **Method:** `POST`
   - **URL:** `{{base_url}}/api/auth/register`
   - **Body:**
   ```json
   {
     "sponsorCode": "0x8b3c82698cebaf7f6b2d2a74079dc811d2d1566b",
     "walletAddress": "0x1111111111111111111111111111111111111111",
     "paymentMethod": "USDT",
     "paymentTxHash": "0xabcd1234..."
   }
   ```

5. **Test Tree Structure**
   - Start with your own tree
   - Then test specific users
   - Try different parameters

6. **Test Commission System**
   - Check levels and unlock status
   - View commission history
   - Test manual distribution

---

## 🔧 Common Issues & Solutions

### Issue 1: Authentication Error
**Error:** `"Not authorized"`
**Solution:** 
- Check if token is valid
- Ensure `Bearer ` prefix in Authorization header
- Use admin token for admin endpoints

### Issue 2: User Not Found
**Error:** `"User not found"`
**Solution:**
- Verify user ID exists in database
- Use correct ObjectId format
- Check if user was created successfully

### Issue 3: Empty Tree
**Error:** Tree shows no children
**Solution:**
- Ensure users have proper sponsor relationships
- Check if database seeding was successful
- Verify sponsor field is populated

### Issue 4: No Commissions
**Error:** Commission summary shows zero
**Solution:**
- Create test data with user seeder
- Manually trigger commission distribution
- Check if users are properly linked

---

## 📊 Sample Test Data

### Create Test Environment:

```bash
# Seed test users
npm run seed-simple

# Or create specific count
node seeders/simpleUserSeeder.js 20
```

### Get User IDs for Testing:

**Method:** `GET`
**URL:** `{{base_url}}/api/users`
**Headers:**
```json
{
  "Authorization": "Bearer {{admin_token}}"
}
```

Copy user IDs to your environment variables for easier testing.

---

## 🚀 Postman Collection

Here's a complete Postman collection JSON you can import:

```json
{
  "info": {
    "name": "SBW MLM API Tests",
    "description": "Complete test suite for SBW MLM Tree and Commission APIs"
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Admin Login",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\"walletAddress\": \"0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b\"}"
            },
            "url": {
              "raw": "{{base_url}}/api/auth/wallet-login",
              "host": ["{{base_url}}"],
              "path": ["api", "auth", "wallet-login"]
            }
          }
        }
      ]
    },
    {
      "name": "Tree Structure",
      "item": [
        {
          "name": "Get User Tree",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{admin_token}}"}],
            "url": {
              "raw": "{{base_url}}/api/tree/tree?levels=10&stats=true",
              "host": ["{{base_url}}"],
              "path": ["api", "tree", "tree"],
              "query": [
                {"key": "levels", "value": "10"},
                {"key": "stats", "value": "true"}
              ]
            }
          }
        }
      ]
    },
    {
      "name": "Commissions",
      "item": [
        {
          "name": "Get Commission Summary",
          "request": {
            "method": "GET",
            "header": [{"key": "Authorization", "value": "Bearer {{user_token}}"}],
            "url": {
              "raw": "{{base_url}}/api/commissions/summary",
              "host": ["{{base_url}}"],
              "path": ["api", "commissions", "summary"]
            }
          }
        }
      ]
    }
  ]
}
```

Save this as a `.json` file and import it into Postman for quick testing! 🎯