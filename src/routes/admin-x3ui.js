const express = require('express');
const router = express.Router();
const adminX3UI = require('../services/admin-x3ui');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.post('/create-vpn', async (req, res) => {
  try {
    const { userId, countryCode = 'auto', trafficGB = 100 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await adminX3UI.createUserVPN(userId, countryCode, trafficGB);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Admin: Create VPN error:', error.message);
    res.status(500).json({ error: 'Failed to create VPN' });
  }
});

router.post('/revoke-vpn', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await adminX3UI.revokeUserVPN(userId);

    res.json(result);
  } catch (error) {
    console.error('Admin: Revoke VPN error:', error.message);
    res.status(500).json({ error: 'Failed to revoke VPN' });
  }
});

router.get('/user-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await adminX3UI.getUserVPNStats(userId);

    if (!stats) {
      return res.status(404).json({ error: 'User VPN not found' });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Admin: Get user stats error:', error.message);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

router.get('/all-users-status', async (req, res) => {
  try {
    const users = await adminX3UI.getAllUsersVPNStatus();

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('Admin: Get all users status error:', error.message);
    res.status(500).json({ error: 'Failed to get all users status' });
  }
});

router.post('/reset-traffic', async (req, res) => {
  try {
    const { userId, trafficGB } = req.body;

    if (!userId || !trafficGB) {
      return res.status(400).json({ error: 'userId and trafficGB are required' });
    }

    const result = await adminX3UI.resetClientTraffic(userId, trafficGB);

    res.json(result);
  } catch (error) {
    console.error('Admin: Reset traffic error:', error.message);
    res.status(500).json({ error: 'Failed to reset traffic' });
  }
});

router.get('/inbounds-info', async (req, res) => {
  try {
    const inbounds = await adminX3UI.getInboundsInfo();

    res.json({
      success: true,
      count: inbounds.length,
      data: inbounds,
    });
  } catch (error) {
    console.error('Admin: Get inbounds info error:', error.message);
    res.status(500).json({ error: 'Failed to get inbounds info' });
  }
});

router.post('/sync-database', async (req, res) => {
  try {
    const result = await adminX3UI.syncClientDatabase();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Admin: Sync database error:', error.message);
    res.status(500).json({ error: 'Failed to sync database' });
  }
});

router.post('/cleanup-expired', async (req, res) => {
  try {
    const result = await adminX3UI.cleanupExpiredClients();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Admin: Cleanup expired error:', error.message);
    res.status(500).json({ error: 'Failed to cleanup expired clients' });
  }
});

module.exports = router;
