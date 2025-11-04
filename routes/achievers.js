const express = require('express');
const Achiever = require('../models/Achiever');
const { adminAuth } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const router = express.Router();

// Get all achievers (public endpoint for users)
router.get('/', async (req, res) => {
  try {
    const { featured, limit = 20, page = 1 } = req.query;
    const skip = (page - 1) * limit;
    
    let query = { isActive: true };
    if (featured === 'true') {
      query.featured = true;
    }
    
    const achievers = await Achiever.find(query)
      .sort({ featured: -1, sortOrder: 1, earnings: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Achiever.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        achievers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get achievers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get achiever by ID (public endpoint)
router.get('/:id', async (req, res) => {
  try {
    const achiever = await Achiever.findById(req.params.id);
    
    if (!achiever || !achiever.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Achiever not found'
      });
    }
    
    res.json({
      success: true,
      data: achiever
    });

  } catch (error) {
    console.error('Get achiever error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Admin routes
// Get all achievers for admin
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, featured, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { walletAddress: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (featured === 'true') {
      query.featured = true;
    } else if (featured === 'false') {
      query.featured = false;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const achievers = await Achiever.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Achiever.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        achievers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin get achievers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Upload achiever photo (admin only)
router.post('/admin/upload', adminAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { name, email, walletAddress, userId, earnings, level, testimonial, featured, sortOrder } = req.body;

    // Validate required fields
    if (!name || !email || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and wallet address are required'
      });
    }

    // Check if achiever already exists
    const existingAchiever = await Achiever.findOne({ 
      $or: [
        { email: email },
        { walletAddress: walletAddress }
      ]
    });

    if (existingAchiever) {
      return res.status(400).json({
        success: false,
        message: 'Achiever with this email or wallet address already exists'
      });
    }

    const achiever = new Achiever({
      name,
      email,
      walletAddress,
      userId,
      earnings: parseFloat(earnings) || 0,
      level: parseInt(level) || 1,
      photo: {
        public_id: req.file.public_id,
        url: req.file.url,
        secure_url: req.file.secure_url
      },
      testimonial: testimonial || '',
      featured: featured === 'true',
      sortOrder: parseInt(sortOrder) || 0
    });

    await achiever.save();

    res.json({
      success: true,
      message: 'Achiever photo uploaded successfully',
      data: achiever
    });

  } catch (error) {
    console.error('Upload achiever error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update achiever (admin only)
router.put('/admin/:id', adminAuth, async (req, res) => {
  try {
    const { name, email, walletAddress, userId, earnings, level, testimonial, featured, sortOrder, isActive } = req.body;
    
    const achiever = await Achiever.findByIdAndUpdate(
      req.params.id,
      {
        name,
        email,
        walletAddress,
        userId,
        earnings: parseFloat(earnings) || 0,
        level: parseInt(level) || 1,
        testimonial: testimonial || '',
        featured: featured === 'true',
        sortOrder: parseInt(sortOrder) || 0,
        isActive: isActive !== undefined ? isActive : true
      },
      { new: true }
    );
    
    if (!achiever) {
      return res.status(404).json({
        success: false,
        message: 'Achiever not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Achiever updated successfully',
      data: achiever
    });

  } catch (error) {
    console.error('Update achiever error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Update achiever photo (admin only)
router.put('/admin/:id/photo', adminAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const achiever = await Achiever.findById(req.params.id);
    
    if (!achiever) {
      return res.status(404).json({
        success: false,
        message: 'Achiever not found'
      });
    }

    // Update photo information
    achiever.photo = {
      public_id: req.file.public_id,
      url: req.file.url,
      secure_url: req.file.secure_url
    };

    await achiever.save();
    
    res.json({
      success: true,
      message: 'Achiever photo updated successfully',
      data: achiever
    });

  } catch (error) {
    console.error('Update achiever photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete achiever (admin only)
router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const achiever = await Achiever.findByIdAndDelete(req.params.id);
    
    if (!achiever) {
      return res.status(404).json({
        success: false,
        message: 'Achiever not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Achiever deleted successfully'
    });

  } catch (error) {
    console.error('Delete achiever error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Toggle achiever status (admin only)
router.put('/admin/:id/toggle-status', adminAuth, async (req, res) => {
  try {
    const achiever = await Achiever.findById(req.params.id);
    
    if (!achiever) {
      return res.status(404).json({
        success: false,
        message: 'Achiever not found'
      });
    }
    
    achiever.isActive = !achiever.isActive;
    await achiever.save();
    
    res.json({
      success: true,
      message: `Achiever ${achiever.isActive ? 'activated' : 'deactivated'} successfully`,
      data: achiever
    });

  } catch (error) {
    console.error('Toggle achiever status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
