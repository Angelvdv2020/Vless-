const express = require('express');
const axios = require('axios');
const pool = require('../database/db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);

router.get('/content', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, section_key, title, body, image_url, updated_at FROM site_content ORDER BY section_key');
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Builder content list error:', error.message);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.put('/content/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { title = '', body = '', imageUrl = '' } = req.body;

    const result = await pool.query(
      `INSERT INTO site_content (section_key, title, body, image_url, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key) DO UPDATE
       SET title = EXCLUDED.title,
           body = EXCLUDED.body,
           image_url = EXCLUDED.image_url,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, title, body, imageUrl]
    );

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Builder content upsert error:', error.message);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

router.post('/ai/text', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const response = await axios.post(
      (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/chat/completions',
      {
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Ты помогаешь писать продающие короткие тексты для VPN-сайта.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const text = response.data?.choices?.[0]?.message?.content || '';
    res.json({ text });
  } catch (error) {
    console.error('AI text generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate text' });
  }
});

router.post('/ai/image', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not configured' });
    }

    const response = await axios.post(
      (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/images/generations',
      {
        model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
        prompt,
        size: '1024x1024',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const imageUrl = response.data?.data?.[0]?.url || null;
    if (!imageUrl) {
      return res.status(500).json({ error: 'Image URL not returned by provider' });
    }

    res.json({ imageUrl });
  } catch (error) {
    console.error('AI image generation error:', error.message);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
