const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const x3ui = require('../services/x3ui');
const { detectPlatform, getDeliveryFormat, getDeepLinkScheme } = require('../services/platformDetector');
const { generateDownloadToken, validateDownloadToken } = require('../services/tokenService');
const { generateQRCode } = require('../services/qrService');

function getUserId(req) {
  if (req.user && req.user.id) {
    return req.user.id;
  }
  return req.body.userId;
}

function getDeepLink(protocol, config) {
  const schemes = {
    vless: 'vless://',
    vmess: 'vmess://',
    ss: 'ss://',
    trojan: 'trojan://',
  };

  const scheme = schemes[protocol] || 'vless://';
  const encodedConfig = Buffer.from(JSON.stringify(config)).toString('base64');

  return `${scheme}${encodedConfig}`;
}

router.post('/connect', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { countryCode = 'auto' } = req.body;
    const userAgent = req.headers['user-agent'] || '';

    if (!userId) {
      return res.status(400).json({ error: 'User not authenticated. Provide JWT token or userId in body.' });
    }

    const platform = detectPlatform(userAgent);
    const deliveryFormat = getDeliveryFormat(platform);

    console.log(`📱 Platform detected: ${platform}, Format: ${deliveryFormat}`);

    const subscriptionQuery = await pool.query(
      `SELECT s.id, s.status, s.x3ui_client_uuid, s.x3ui_client_email, s.x3ui_inbound_id, v.country_code
       FROM subscriptions s
       LEFT JOIN vpn_keys v ON v.subscription_id = s.id
       WHERE s.user_id = $1 AND s.status = 'active' AND s.expires_at > NOW()
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (subscriptionQuery.rows.length === 0) {
      return res.status(403).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptionQuery.rows[0];
    let clientUUID = subscription.x3ui_client_uuid;
    let clientEmail = subscription.x3ui_client_email;
    let inboundId = subscription.x3ui_inbound_id;

    if (!clientUUID || !clientEmail || !inboundId) {
      console.log('🔄 Creating new 3X-UI client...');

      clientEmail = `user_${userId}_${Date.now()}@noryx.vpn`;
      clientUUID = x3ui.generateUUID();

      const inbounds = await x3ui.getInbounds();
      if (inbounds.length === 0) {
        throw new Error('No inbounds configured in 3X-UI');
      }

      const inbound = inbounds[0];
      inboundId = inbound.id;

      await x3ui.createClient(clientEmail, countryCode);

      await pool.query(
        `UPDATE subscriptions
         SET x3ui_client_uuid = $1, x3ui_client_email = $2, x3ui_inbound_id = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [clientUUID, clientEmail, inboundId, subscription.id]
      );

      await pool.query(
        `INSERT INTO vpn_keys (subscription_id, x3ui_client_id, x3ui_inbound_id, x3ui_inbound_tag, country_code, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (subscription_id) DO UPDATE SET
           x3ui_client_id = $2,
           x3ui_inbound_id = $3,
           x3ui_inbound_tag = $4,
           country_code = $5`,
        [subscription.id, clientUUID, inboundId, 'vless', countryCode]
      );
    }

    const configData = await x3ui.getClientConfig(inboundId, clientEmail);

    await pool.query(
      `INSERT INTO connection_logs (user_id, platform, connection_type, country_code)
       VALUES ($1, $2, $3, $4)`,
      [userId, platform, deliveryFormat, countryCode]
    );

    let response = {
      platform,
      deliveryFormat,
      protocol: configData.protocol,
      countryCode,
      serverLocation: `3X-UI Inbound: ${configData.inboundTag}`,
    };

    switch (deliveryFormat) {
      case 'deep-link': {
        const deepLink = getDeepLink(configData.protocol, {
          uuid: clientUUID,
          email: clientEmail,
          inbound: configData.inboundTag,
        });
        response.deepLink = deepLink;
        response.configLink = deepLink;
        break;
      }

      case 'file': {
        const downloadToken = generateDownloadToken(userId, clientEmail);
        response.downloadUrl = `/api/vpn/download/${downloadToken}`;
        response.expiresIn = 300;
        break;
      }

      case 'qr-code': {
        const qrLink = getDeepLink(configData.protocol, {
          uuid: clientUUID,
          email: clientEmail,
          inbound: configData.inboundTag,
        });
        const qrCode = await generateQRCode(qrLink);
        response.qrCode = qrCode;
        response.configLink = qrLink;
        break;
      }
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Smart Connect error:', error.message);
    res.status(500).json({ error: 'Failed to connect to VPN' });
  }
});

router.get('/countries', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT country_code, country_name, flag_emoji, is_available
       FROM available_countries
       WHERE is_available = true
       ORDER BY priority DESC`
    );

    res.json({ countries: result.rows });
  } catch (error) {
    console.error('❌ Get countries error:', error.message);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

router.post('/change-country', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { countryCode } = req.body;

    if (!userId || !countryCode) {
      return res.status(400).json({ error: 'User not authenticated and countryCode is required' });
    }

    const configQuery = await pool.query(
      `SELECT v.country_code, v.x3ui_inbound_id, s.id as subscription_id
       FROM vpn_keys v
       JOIN subscriptions s ON s.id = v.subscription_id
       WHERE s.user_id = $1 AND s.status = 'active'
       ORDER BY v.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (configQuery.rows.length === 0) {
      return res.status(404).json({ error: 'No active VPN configuration found' });
    }

    const { x3ui_inbound_id, subscription_id } = configQuery.rows[0];

    await pool.query(
      `UPDATE vpn_keys
       SET country_code = $1, updated_at = CURRENT_TIMESTAMP
       WHERE subscription_id = $2`,
      [countryCode, subscription_id]
    );

    res.json({
      success: true,
      countryCode,
      message: `VPN country changed to ${countryCode}`,
    });
  } catch (error) {
    console.error('❌ Change country error:', error.message);
    res.status(500).json({ error: 'Failed to change VPN country' });
  }
});

router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const payload = validateDownloadToken(token);
    if (!payload) {
      return res.status(403).json({ error: 'Invalid or expired download token' });
    }

    const configLink = getDeepLink('vless', {
      email: payload.subscriptionId,
      format: 'file',
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="noryx-vpn-config.conf"`);
    res.send(Buffer.from(configLink));
  } catch (error) {
    console.error('❌ Download error:', error.message);
    res.status(500).json({ error: 'Failed to download configuration file' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ error: 'User not authenticated' });
    }

    const statsQuery = await pool.query(
      `SELECT x3ui_inbound_id FROM subscriptions
       WHERE user_id = $1 AND status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (statsQuery.rows.length === 0) {
      return res.status(404).json({ error: 'No active subscription' });
    }

    const inboundId = statsQuery.rows[0].x3ui_inbound_id;
    const stats = await x3ui.getStats(inboundId);

    res.json({ stats });
  } catch (error) {
    console.error('❌ Get stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch VPN stats' });
  }
});

module.exports = router;
