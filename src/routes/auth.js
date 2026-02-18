const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function hashPassword(password, salt = null) {
  const safeSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, safeSalt, 100000, 64, 'sha512').toString('hex');
  return `${safeSalt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, original] = (storedHash || '').split(':');
  if (!salt || !original) return false;
  const check = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(original, 'hex'));
}

function signSession(user) {
  const role = user.is_admin ? 'admin' : 'user';
  const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, role }, expiresIn: 604800 };
}

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email and password (min 6 chars) are required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashed = hashPassword(password);
    const created = await pool.query(
      `INSERT INTO users (email, password_hash, is_admin)
       VALUES ($1, $2, false)
       RETURNING id, email, is_admin`,
      [email.toLowerCase().trim(), hashed]
    );

    return res.status(201).json({ session: signSession(created.rows[0]) });
  } catch (error) {
    console.error('Register error:', error.message);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT id, email, password_hash, is_admin FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0 || !verifyPassword(password, userResult.rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.json({ session: signSession(userResult.rows[0]) });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/logout', (req, res) => {
  return res.json({ success: true });
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.is_admin,
              COUNT(s.id)::int as total_subscriptions,
              COALESCE(SUM(CASE WHEN s.status='active' AND s.expires_at > NOW() THEN 1 ELSE 0 END),0)::int as active_subscriptions
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    return res.json({
      user: {
        id: row.id,
        email: row.email,
        role: row.is_admin ? 'admin' : 'user',
      },
      stats: {
        totalSubscriptions: row.total_subscriptions,
        activeSubscriptions: row.active_subscriptions,
      },
    });
  } catch (error) {
    console.error('Profile error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;
