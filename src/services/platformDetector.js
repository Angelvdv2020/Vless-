/**
 * Platform Detection Service
 * Detects user platform from User-Agent header
 */

const platformPatterns = {
  ios: /iPhone|iPad|iPod/i,
  android: /Android/i,
  windows: /Windows/i,
  macos: /Macintosh|Mac OS X/i,
  linux: /Linux/i,
};

/**
 * Detect platform from User-Agent string
 * @param {string} userAgent - User-Agent header value
 * @returns {string} Platform identifier: 'ios', 'android', 'windows', 'macos', 'linux', 'unknown'
 */
function detectPlatform(userAgent) {
  if (!userAgent) return 'unknown';

  if (platformPatterns.ios.test(userAgent)) return 'ios';
  if (platformPatterns.android.test(userAgent)) return 'android';
  if (platformPatterns.windows.test(userAgent)) return 'windows';
  if (platformPatterns.macos.test(userAgent)) return 'macos';
  if (platformPatterns.linux.test(userAgent)) return 'linux';

  return 'unknown';
}

/**
 * Determine the best delivery format for a platform
 * @param {string} platform - Platform identifier
 * @returns {string} Delivery format: 'deep-link', 'file', 'qr-code'
 */
function getDeliveryFormat(platform) {
  const formatMap = {
    ios: 'deep-link',        // Shadowrocket, Quantumult
    android: 'deep-link',    // V2RayNG, Clash
    windows: 'file',         // Download .conf or .json file
    macos: 'file',           // Download .conf or .json file
    linux: 'file',           // Download .conf or .json file
    unknown: 'qr-code',      // Fallback to QR code
  };

  return formatMap[platform] || 'qr-code';
}

/**
 * Get deep-link scheme for platform
 * @param {string} platform - Platform identifier
 * @param {string} protocol - VPN protocol (shadowsocks, vmess, etc.)
 * @returns {string|null} Deep-link scheme or null if not supported
 */
function getDeepLinkScheme(platform, protocol) {
  const schemes = {
    ios: {
      shadowsocks: 'shadowrocket://add/',
      vmess: 'shadowrocket://add/',
      vless: 'shadowrocket://add/',
    },
    android: {
      shadowsocks: 'v2rayng://install-config?url=',
      vmess: 'v2rayng://install-config?url=',
      vless: 'v2rayng://install-config?url=',
    },
  };

  return schemes[platform]?.[protocol] || null;
}

module.exports = {
  detectPlatform,
  getDeliveryFormat,
  getDeepLinkScheme,
};
