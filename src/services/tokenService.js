const crypto = require('crypto');
require('dotenv').config();

/**
 * Token Service
 * Generates and validates short-lived HMAC tokens for secure file downloads
 */

const HMAC_SECRET = process.env.HMAC_SECRET || 'change-me-in-production';
const TOKEN_EXPIRY = parseInt(process.env.TOKEN_EXPIRY_SECONDS) || 300; // 5 minutes

/**
 * Generate a secure download token
 * @param {number} userId - User ID
 * @param {string} subscriptionId - VPN client/subscription reference ID
 * @returns {string} HMAC token
 */
function generateDownloadToken(userId, subscriptionId) {
  const expiresAt = Date.now() + TOKEN_EXPIRY * 1000;
  const payload = `${userId}:${subscriptionId}:${expiresAt}`;

  const hmac = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');

  // Encode payload and HMAC as base64
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');

  return token;
}

/**
 * Validate a download token
 * @param {string} token - Token to validate
 * @returns {Object|null} Decoded payload or null if invalid
 */
function validateDownloadToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');

    if (parts.length !== 4) return null;

    const [userId, subscriptionId, expiresAt, providedHmac] = parts;

    // Check expiration
    if (Date.now() > parseInt(expiresAt)) {
      return null; // Token expired
    }

    // Verify HMAC
    const payload = `${userId}:${subscriptionId}:${expiresAt}`;
    const expectedHmac = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(payload)
      .digest('hex');

    if (expectedHmac !== providedHmac) {
      return null; // Invalid signature
    }

    return {
      userId: parseInt(userId),
      subscriptionId,
      expiresAt: parseInt(expiresAt),
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateDownloadToken,
  validateDownloadToken,
};
