const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const pool = require('../database/db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);

const ALLOWED_SECTIONS = new Set(['hero', 'pricing', 'faq', 'features', 'footer']);
const AI_ENABLED = String(process.env.AI_TEXT_ENABLED || 'false').toLowerCase() === 'true';

let gigaTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

async function getGigaChatToken() {
  if (gigaTokenCache.accessToken && Date.now() < gigaTokenCache.expiresAt - 60_000) {
    return gigaTokenCache.accessToken;
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey) {
    throw new Error('GIGACHAT_AUTH_KEY is not configured');
  }

  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS';
  const authUrl = process.env.GIGACHAT_AUTH_URL || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

  const response = await axios.post(
    authUrl,
    `scope=${encodeURIComponent(scope)}`,
    {
      headers: {
        Authorization: `Basic ${authKey}`,
        RqUID: crypto.randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000),
    }
  );

  const accessToken = response.data?.access_token;
  const expiresAtMs = Number(response.data?.expires_at || 0);

  if (!accessToken) {
    throw new Error('GigaChat token was not returned by auth API');
  }

  gigaTokenCache = {
    accessToken,
    expiresAt: expiresAtMs || Date.now() + 30 * 60 * 1000,
  };

  return accessToken;
}

function assertSection(key, res) {
  if (!ALLOWED_SECTIONS.has(key)) {
    res.status(400).json({ error: `Unsupported section. Allowed: ${Array.from(ALLOWED_SECTIONS).join(', ')}` });
    return false;
  }
  return true;
}

async function writeAuditLog(sectionKey, prompt, status, errorMessage = null) {
  try {
    await pool.query(
      `INSERT INTO ai_generation_logs (provider, section_key, prompt, status, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      ['gigachat', sectionKey || null, prompt || null, status, errorMessage]
    );
  } catch (error) {
    console.error('AI audit log write failed:', error.message);
  }
}

router.get('/content', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT section_key, title, body, image_url, status, current_version, published_version, updated_at
       FROM site_content
       ORDER BY section_key`
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Builder content list error:', error.message);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

router.get('/content/:key/versions', async (req, res) => {
  try {
    const { key } = req.params;
    if (!assertSection(key, res)) return;

    const result = await pool.query(
      `SELECT version_no, title, body, image_url, status, created_at
       FROM site_content_versions
       WHERE section_key = $1
       ORDER BY version_no DESC`,
      [key]
    );

    res.json({ sectionKey: key, versions: result.rows });
  } catch (error) {
    console.error('Builder versions list error:', error.message);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

router.put('/content/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!assertSection(key, res)) return;

    const { title = '', body = '', imageUrl = '' } = req.body;

    const current = await pool.query(
      `SELECT current_version FROM site_content WHERE section_key = $1`,
      [key]
    );

    const nextVersion = (current.rows[0]?.current_version || 0) + 1;

    await pool.query(
      `INSERT INTO site_content_versions (section_key, version_no, title, body, image_url, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')`,
      [key, nextVersion, title, body, imageUrl]
    );

    const result = await pool.query(
      `INSERT INTO site_content (section_key, title, body, image_url, status, current_version, published_version, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, NULL, CURRENT_TIMESTAMP)
       ON CONFLICT (section_key) DO UPDATE
       SET title = EXCLUDED.title,
           body = EXCLUDED.body,
           image_url = EXCLUDED.image_url,
           status = 'draft',
           current_version = EXCLUDED.current_version,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, title, body, imageUrl, nextVersion]
    );

    res.json({ item: result.rows[0], message: `Draft v${nextVersion} saved` });
  } catch (error) {
    console.error('Builder content upsert error:', error.message);
    res.status(500).json({ error: 'Failed to save content' });
  }
});

router.post('/content/:key/publish', async (req, res) => {
  try {
    const { key } = req.params;
    if (!assertSection(key, res)) return;

    const current = await pool.query(
      `SELECT current_version FROM site_content WHERE section_key = $1`,
      [key]
    );

    const version = current.rows[0]?.current_version;
    if (!version) {
      return res.status(404).json({ error: 'No draft found for section' });
    }

    await pool.query(
      `UPDATE site_content_versions
       SET status = CASE WHEN version_no = $2 THEN 'published' ELSE status END
       WHERE section_key = $1`,
      [key, version]
    );

    const result = await pool.query(
      `UPDATE site_content
       SET status = 'published', published_version = $2, updated_at = CURRENT_TIMESTAMP
       WHERE section_key = $1
       RETURNING *`,
      [key, version]
    );

    res.json({ item: result.rows[0], message: `Published v${version}` });
  } catch (error) {
    console.error('Builder publish error:', error.message);
    res.status(500).json({ error: 'Failed to publish section' });
  }
});

router.post('/content/:key/rollback', async (req, res) => {
  try {
    const { key } = req.params;
    const { version } = req.body;
    if (!assertSection(key, res)) return;
    if (!version || Number(version) < 1) {
      return res.status(400).json({ error: 'version is required' });
    }

    const versionRow = await pool.query(
      `SELECT section_key, version_no, title, body, image_url
       FROM site_content_versions
       WHERE section_key = $1 AND version_no = $2`,
      [key, Number(version)]
    );

    if (versionRow.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const v = versionRow.rows[0];
    await pool.query(
      `UPDATE site_content_versions
       SET status = CASE WHEN version_no = $2 THEN 'published' ELSE status END
       WHERE section_key = $1`,
      [key, Number(version)]
    );

    const result = await pool.query(
      `UPDATE site_content
       SET title = $2,
           body = $3,
           image_url = $4,
           status = 'published',
           published_version = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE section_key = $1
       RETURNING *`,
      [key, v.title, v.body, v.image_url, Number(version)]
    );

    res.json({ item: result.rows[0], message: `Rolled back to v${version}` });
  } catch (error) {
    console.error('Builder rollback error:', error.message);
    res.status(500).json({ error: 'Failed to rollback section' });
  }
});

router.post('/ai/text', async (req, res) => {
  try {
    const { prompt, sectionKey = null } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    if (!AI_ENABLED) {
      await writeAuditLog(sectionKey, prompt, 'skipped', 'AI_TEXT_ENABLED=false');
      return res.status(200).json({
        text: '',
        fallback: true,
        message: 'AI disabled by feature flag (AI_TEXT_ENABLED=false).',
      });
    }

    const accessToken = await getGigaChatToken();
    const apiUrl = process.env.GIGACHAT_API_URL || 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

    const response = await axios.post(
      apiUrl,
      {
        model: process.env.GIGACHAT_MODEL || 'GigaChat:latest',
        messages: [
          { role: 'system', content: 'Ты помогаешь писать короткие и понятные тексты для VPN-сайта на русском языке.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000),
      }
    );

    const text = response.data?.choices?.[0]?.message?.content || '';
    await writeAuditLog(sectionKey, prompt, 'success', null);
    res.json({ text, fallback: false });
  } catch (error) {
    console.error('AI text generation error:', error.response?.data || error.message);
    await writeAuditLog(req.body?.sectionKey || null, req.body?.prompt || null, 'error', String(error.message || 'unknown'));
    res.status(200).json({
      text: '',
      fallback: true,
      message: 'AI provider unavailable, continuing without AI.',
    });
  }
});

router.post('/ai/image', async (req, res) => {
  return res.status(501).json({
    error: 'Image generation is not available yet. Configure only /ai/text with GigaChat.',
  });
});

module.exports = router;
