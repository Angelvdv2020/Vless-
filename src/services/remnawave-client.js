/**
 * @deprecated
 * Legacy placeholder kept only for backward compatibility.
 * This project now uses only 3X-UI services.
 */

class LegacyClientDisabled {
  static getInstance() {
    return new LegacyClientDisabled();
  }

  fail() {
    throw new Error('Legacy VPN provider client is disabled. Use 3X-UI service.');
  }
}

module.exports = LegacyClientDisabled;
