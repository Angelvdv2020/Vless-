const pool = require('../database/db');
const x3ui = require('./x3ui');
const axios = require('axios');

async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkX3UI() {
  try {
    await x3ui.login();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkAIProvider() {
  const aiEnabled = String(process.env.AI_TEXT_ENABLED || 'false').toLowerCase() === 'true';
  if (!aiEnabled) {
    return { ok: true, skipped: true, reason: 'AI_TEXT_ENABLED=false' };
  }

  if (!process.env.GIGACHAT_AUTH_KEY) {
    return { ok: false, error: 'GIGACHAT_AUTH_KEY is missing while AI_TEXT_ENABLED=true' };
  }

  const authUrl = process.env.GIGACHAT_AUTH_URL || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
  try {
    await axios.post(
      authUrl,
      `scope=${encodeURIComponent(process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS')}`,
      {
        headers: {
          Authorization: `Basic ${process.env.GIGACHAT_AUTH_KEY}`,
          RqUID: crypto.randomUUID(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000),
      }
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

const crypto = require('crypto');

async function getHealthReport() {
  const [database, x3uiStatus, aiProvider] = await Promise.all([
    checkDatabase(),
    checkX3UI(),
    checkAIProvider(),
  ]);

  const ok = database.ok && x3uiStatus.ok && aiProvider.ok;
  return {
    ok,
    dependencies: {
      database,
      x3ui: x3uiStatus,
      aiProvider,
    },
  };
}

module.exports = { getHealthReport };
