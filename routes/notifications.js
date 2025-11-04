const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

// @route   GET /api/notifications
// @desc    Get user's notifications
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    let query = { user: req.user._id };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName username');

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/admin/send-level-reminder
// @desc    Send level completion reminder to user
// @access  Private (Admin)
router.post('/admin/send-level-reminder', adminAuth, async (req, res) => {
  try {
    const { userId, level, customMessage } = req.body;

    if (!userId || !level) {
      return res.status(400).json({
        success: false,
        message: 'User ID and level are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const title = `Level ${level} Completion Reminder`;
    const message = customMessage || `Your Level ${level} is not completed and you will miss your level earning. Complete your referrals to unlock this level's benefits!`;

    const notification = new Notification({
      user: userId,
      type: 'level_reminder',
      title,
      message,
      level: parseInt(level),
      isImportant: true,
      actionUrl: '/dashboard/team',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await notification.save();

    res.json({
      success: true,
      message: 'Level reminder sent successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error sending level reminder:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/admin/send-bulk-level-reminder
// @desc    Send level completion reminder to multiple users
// @access  Private (Admin)
router.post('/admin/send-bulk-level-reminder', adminAuth, async (req, res) => {
  try {
    const { userIds, level, customMessage } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !level) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array and level are required'
      });
    }

    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some users not found'
      });
    }

    const title = `Level ${level} Completion Reminder`;
    const message = customMessage || `Your Level ${level} is not completed and you will miss your level earning. Complete your referrals to unlock this level's benefits!`;

    const notifications = userIds.map(userId => ({
      user: userId,
      type: 'level_reminder',
      title,
      message,
      level: parseInt(level),
      isImportant: true,
      actionUrl: '/dashboard/team',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    }));

    const createdNotifications = await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: `Level reminders sent to ${createdNotifications.length} users`,
      data: createdNotifications
    });
  } catch (error) {
    console.error('Error sending bulk level reminder:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/notifications/admin/users-with-incomplete-levels
// @desc    Get users with incomplete levels for admin
// @access  Private (Admin)
router.get('/admin/users-with-incomplete-levels', adminAuth, async (req, res) => {
  try {
    const { level, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Get users who haven't completed the specified level
    // This is a simplified logic - you might want to enhance this based on your level completion criteria
    let query = { isAdmin: false, isActive: true };
    
    const users = await User.find(query)
      .select('firstName lastName username email userId walletAddress totalEarnings level createdAt')
      .sort({ totalEarnings: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Filter users who haven't completed the specified level
    // For now, we'll assume level completion is based on having enough referrals
    // You can enhance this logic based on your specific requirements
    const filteredUsers = users.filter(user => {
      if (level) {
        return user.level < parseInt(level);
      }
      return user.level < 15; // Default to checking if they haven't reached max level
    });

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users: filteredUsers,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total: filteredUsers.length,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users with incomplete levels:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/admin/send-level-reminder
// @desc    Send level reminder notification to specific users
// @access  Private (Admin)
router.post('/admin/send-level-reminder', adminAuth, async (req, res) => {
  try {
    const { userIds, level, message, title } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User IDs are required' 
      });
    }

    if (!level || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Level and message are required' 
      });
    }

    const notifications = [];
    const defaultTitle = title || `Level ${level} Reminder`;

    for (const userId of userIds) {
      // Verify user exists and is not admin
      const user = await User.findById(userId);
      if (!user || user.isAdmin) {
        continue;
      }

      const notification = new Notification({
        user: userId,
        title: defaultTitle,
        message: message,
        type: 'level_reminder',
        isRead: false,
        metadata: {
          level: level,
          sentBy: req.user._id,
          sentAt: new Date()
        }
      });

      await notification.save();
      notifications.push(notification);
    }

    res.json({
      success: true,
      message: `Level reminder sent to ${notifications.length} users`,
      data: {
        sentCount: notifications.length,
        requestedCount: userIds.length,
        level: level
      }
    });
  } catch (error) {
    console.error('Error sending level reminder:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/notifications/admin/send-broadcast
// @desc    Send broadcast notification to all users
// @access  Private (Admin)
router.post('/admin/send-broadcast', adminAuth, async (req, res) => {
  try {
    const { title, message, type = 'info' } = req.body;

    if (!title || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title and message are required' 
      });
    }

    // Get all non-admin users
    const users = await User.find({ isAdmin: false, isActive: true }).select('_id');
    
    const notifications = [];
    for (const user of users) {
      const notification = new Notification({
        user: user._id,
        title: title,
        message: message,
        type: type,
        isRead: false,
        metadata: {
          sentBy: req.user._id,
          sentAt: new Date(),
          isBroadcast: true
        }
      });

      await notification.save();
      notifications.push(notification);
    }

    res.json({
      success: true,
      message: `Broadcast notification sent to ${notifications.length} users`,
      data: {
        sentCount: notifications.length,
        title: title,
        type: type
      }
    });
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
