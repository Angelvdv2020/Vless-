/**
 * @deprecated
 * Legacy placeholder kept only for backward compatibility.
 * This project now uses only 3X-UI services.
 */

class LegacyProviderDisabled {
  constructor() {
    this.name = 'legacy-provider-disabled';
  }

  fail() {
    throw new Error('Legacy VPN provider is disabled. Use 3X-UI integration.');
  }
}

module.exports = new LegacyProviderDisabled();
