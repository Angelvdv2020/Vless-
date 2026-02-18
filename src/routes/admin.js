const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const adminAuth = require('../middleware/adminAuth');

router.post('/auth/login', (req, res) => {
  try {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (!password || password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET not configured' });
    }

    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, expiresIn: 86400 });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.use(adminAuth);

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.created_at,
              COUNT(s.id) as total_subscriptions,
              SUM(CASE WHEN s.status = 'active' AND s.expires_at > NOW() THEN 1 ELSE 0 END) as active_subscriptions
       FROM users u
       LEFT JOIN subscriptions s ON u.id = s.user_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/subscriptions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.user_id, u.email, s.plan_type, s.status,
              s.started_at, s.expires_at, s.created_at
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

router.patch('/subscriptions/:id/renew', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.body;

    const newExpireDate = new Date();
    newExpireDate.setDate(newExpireDate.getDate() + days);

    const result = await pool.query(
      `UPDATE subscriptions
       SET expires_at = $1, status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newExpireDate, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ message: 'Subscription renewed', subscription: result.rows[0] });
  } catch (error) {
    console.error('Admin renew subscription error:', error);
    res.status(500).json({ error: 'Failed to renew subscription' });
  }
});

router.patch('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE subscriptions
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json({ message: 'Subscription cancelled', subscription: result.rows[0] });
  } catch (error) {
    console.error('Admin cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.post('/subscriptions/grant-trial', async (req, res) => {
  try {
    const { userId, days = 7 } = req.body;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_type, status, expires_at)
       VALUES ($1, 'trial', 'active', $2)
       RETURNING *`,
      [userId, expiresAt]
    );

    res.json({ message: 'Trial granted', subscription: result.rows[0] });
  } catch (error) {
    console.error('Admin grant trial error:', error);
    res.status(500).json({ error: 'Failed to grant trial' });
  }
});

router.get('/countries', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, country_code, country_name, flag_emoji, is_available, priority
       FROM available_countries
       ORDER BY priority DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get countries error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

router.patch('/countries/:code/toggle', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `UPDATE available_countries
       SET is_available = NOT is_available, updated_at = CURRENT_TIMESTAMP
       WHERE country_code = $1
       RETURNING *`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json({ message: 'Country status toggled', country: result.rows[0] });
  } catch (error) {
    console.error('Admin toggle country error:', error);
    res.status(500).json({ error: 'Failed to toggle country' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = {};

    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    stats.totalUsers = parseInt(usersResult.rows[0].count);

    const activeSubsResult = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions
       WHERE status = 'active' AND expires_at > NOW()`
    );
    stats.activeSubscriptions = parseInt(activeSubsResult.rows[0].count);

    const logsResult = await pool.query(
      `SELECT COUNT(*) as count FROM connection_logs
       WHERE connected_at > NOW() - INTERVAL '24 hours'`
    );
    stats.connectionsLast24h = parseInt(logsResult.rows[0].count);

    const countriesResult = await pool.query(
      `SELECT country_code, COUNT(*) as count FROM connection_logs
       WHERE connected_at > NOW() - INTERVAL '7 days'
       GROUP BY country_code
       ORDER BY count DESC LIMIT 5`
    );
    stats.topCountries = countriesResult.rows;

    const platformsResult = await pool.query(
      `SELECT platform, COUNT(*) as count FROM connection_logs
       WHERE connected_at > NOW() - INTERVAL '7 days'
       GROUP BY platform
       ORDER BY count DESC`
    );
    stats.platforms = platformsResult.rows;

    res.json(stats);
  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/connection-logs', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const result = await pool.query(
      `SELECT cl.id, cl.user_id, u.email, cl.platform, cl.connection_type,
              cl.country_code, cl.connected_at
       FROM connection_logs cl
       JOIN users u ON cl.user_id = u.id
       ORDER BY cl.connected_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Admin get logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
