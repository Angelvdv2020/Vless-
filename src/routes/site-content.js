const express = require('express');
const pool = require('../database/db');

const router = express.Router();

router.get('/published', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT section_key, title, body, image_url, published_version, updated_at
       FROM site_content
       WHERE status = 'published'
       ORDER BY section_key`
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Public site-content fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch published content' });
  }
});

module.exports = router;
