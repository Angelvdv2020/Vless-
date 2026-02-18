const axios = require('axios');
require('dotenv').config();

/**
 * RemnaWave API Integration Service
 * Handles all interactions with RemnaWave VPN API
 * SECURITY: All credentials are kept server-side only
 */
class RemnaWaveService {
  constructor() {
    this.apiUrl = process.env.REMNAWAVE_API_URL;
    this.apiKey = process.env.REMNAWAVE_API_KEY;
    this.apiSecret = process.env.REMNAWAVE_API_SECRET;

    if (this.apiUrl && this.apiKey && this.apiSecret) {
      this.client = axios.create({
        baseURL: this.apiUrl,
        headers: {
          'X-API-Key': this.apiKey,
          'X-API-Secret': this.apiSecret,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });
    }
  }

  validateConfig() {
    if (!this.apiUrl || !this.apiKey || !this.apiSecret) {
      throw new Error('RemnaWave API credentials not configured. Please set REMNAWAVE_API_URL, REMNAWAVE_API_KEY, and REMNAWAVE_API_SECRET in .env');
    }
  }

  /**
   * Create a new VPN subscription for a user
   * @param {number} userId - Internal user ID
   * @param {string} countryCode - Preferred country (e.g., 'us', 'uk', 'auto')
   * @returns {Promise<Object>} Subscription details with configuration
   */
  async createSubscription(userId, countryCode = 'auto') {
    try {
      this.validateConfig();
      const response = await this.client.post('/subscriptions', {
        user_id: `noryx_${userId}`,
        country: countryCode,
        protocol: 'auto', // Let RemnaWave choose best protocol
      });

      return {
        subscriptionId: response.data.subscription_id,
        configUrl: response.data.config_url,
        protocol: response.data.protocol,
        serverLocation: response.data.server_location,
      };
    } catch (error) {
      console.error('RemnaWave API error (createSubscription):', error.message);
      throw new Error('Failed to create VPN subscription');
    }
  }

  /**
   * Get subscription configuration by ID
   * @param {string} subscriptionId - RemnaWave subscription ID
   * @returns {Promise<Object>} Configuration details
   */
  async getSubscriptionConfig(subscriptionId) {
    try {
      this.validateConfig();
      const response = await this.client.get(`/subscriptions/${subscriptionId}`);

      return {
        configUrl: response.data.config_url,
        protocol: response.data.protocol,
        serverLocation: response.data.server_location,
        expiresAt: response.data.expires_at,
      };
    } catch (error) {
      console.error('RemnaWave API error (getConfig):', error.message);
      throw new Error('Failed to retrieve VPN configuration');
    }
  }

  /**
   * Update subscription country/location
   * @param {string} subscriptionId - RemnaWave subscription ID
   * @param {string} countryCode - New country code
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSubscriptionCountry(subscriptionId, countryCode) {
    try {
      this.validateConfig();
      const response = await this.client.patch(`/subscriptions/${subscriptionId}`, {
        country: countryCode,
      });

      return {
        configUrl: response.data.config_url,
        protocol: response.data.protocol,
        serverLocation: response.data.server_location,
      };
    } catch (error) {
      console.error('RemnaWave API error (updateCountry):', error.message);
      throw new Error('Failed to update VPN country');
    }
  }

  /**
   * Get available server locations
   * @returns {Promise<Array>} List of available countries
   */
  async getAvailableLocations() {
    try {
      this.validateConfig();
      const response = await this.client.get('/locations');

      return response.data.locations.map(loc => ({
        countryCode: loc.country_code,
        countryName: loc.country_name,
        available: loc.available,
      }));
    } catch (error) {
      console.error('RemnaWave API error (getLocations):', error.message);
      // Return empty array instead of failing
      return [];
    }
  }

  /**
   * Delete a subscription (when user cancels)
   * @param {string} subscriptionId - RemnaWave subscription ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteSubscription(subscriptionId) {
    try {
      this.validateConfig();
      await this.client.delete(`/subscriptions/${subscriptionId}`);
      return true;
    } catch (error) {
      console.error('RemnaWave API error (deleteSubscription):', error.message);
      return false;
    }
  }

  /**
   * Generate configuration file content (for desktop clients)
   * @param {string} subscriptionId - RemnaWave subscription ID
   * @returns {Promise<string>} Configuration file content
   */
  async getConfigFileContent(subscriptionId) {
    try {
      this.validateConfig();
      const response = await this.client.get(`/subscriptions/${subscriptionId}/config-file`);
      return response.data.config_content;
    } catch (error) {
      console.error('RemnaWave API error (getConfigFile):', error.message);
      throw new Error('Failed to generate configuration file');
    }
  }
}

module.exports = new RemnaWaveService();
