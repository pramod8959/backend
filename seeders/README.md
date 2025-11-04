# User Seeder Guide

This seeder script helps you populate the User collection with test data for the SBW MLM Platform.

## Features

- ✅ Creates admin user automatically
- 👥 Generates realistic user data with proper MLM structure
- 🔗 Maintains referral relationships and sponsor chains
- 💰 Integrates with MLM earnings calculation system
- 🧪 Creates specific test users for development
- 📊 Provides detailed seeding summary

## Usage

### Basic Usage

```bash
# Seed 30 users (default)
npm run seed-users

# Seed specific number of users
npm run seed-users-50

# Clear existing data and seed fresh
npm run seed-users-clear
```

### Command Line Options

```bash
# Run directly with node
node seeders/userSeeder.js [options]

# Available options:
--clear              # Clear existing user data before seeding
--count <number>     # Number of users to create (default: 30)
--no-test-users     # Skip creating specific test users
```

### Examples

```bash
# Create 100 users without clearing existing data
node seeders/userSeeder.js --count 100

# Clear all data and create 50 fresh users
node seeders/userSeeder.js --clear --count 50

# Create users without test users
node seeders/userSeeder.js --no-test-users
```

## What Gets Created

### Admin User
- **User ID**: ADMIN001
- **Wallet**: 0x8B3c82698CeBaf7F6B2d2a74079dC811d2D1566b
- **Role**: Root of MLM tree
- **Referral Code**: Based on wallet address

### Test Users (Optional)
- **Alice Johnson** - alice@test.com
- **Bob Smith** - bob@test.com  
- **Charlie Brown** - charlie@test.com

### Regular Users
- Random names from predefined lists
- Unique wallet addresses
- Realistic email addresses
- Proper MLM sponsor relationships
- Random payment methods (BNB/USDT)
- Generated transaction hashes

## Data Structure

Each user gets:
- Unique `userId` (SBW786, SBW787, etc.)
- Wallet address as `referralCode`
- Proper `sponsor` relationship
- MLM tree `position` (left/right)
- Earnings tracking fields
- Payment information

## MLM Integration

The seeder uses `MLMService.registerUser()` to ensure:
- ✅ Proper sponsor chain creation
- ✅ Binary tree positioning
- ✅ Level calculations
- ✅ Earnings distribution
- ✅ Referral tracking

## Output

After seeding, you'll see:
- Creation progress for each user
- Summary statistics
- First 10 users list
- Total earnings records
- Success/failure counts

## Error Handling

- Continues on individual user creation failures
- Validates data before insertion
- Provides detailed error messages
- Safe cleanup on failure

## Notes

- Uses existing MLM business logic
- Maintains database integrity
- Can be run multiple times safely
- Integrates with existing earnings system
- Supports both development and testing scenarios