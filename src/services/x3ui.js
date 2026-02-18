const axios = require('axios');
require('dotenv').config();

class X3UIService {
  constructor() {
    this.apiUrl = process.env.X3UI_API_URL;
    this.username = process.env.X3UI_USERNAME;
    this.password = process.env.X3UI_PASSWORD;
    this.sessionId = null;

    if (this.apiUrl && this.username && this.password) {
      this.client = axios.create({
        baseURL: this.apiUrl,
        timeout: 10000,
        validateStatus: () => true,
      });
    }
  }

  validateConfig() {
    if (!this.apiUrl || !this.username || !this.password) {
      throw new Error('3X-UI credentials not configured. Set X3UI_API_URL, X3UI_USERNAME, X3UI_PASSWORD');
    }
  }

  async login() {
    try {
      this.validateConfig();

      const response = await this.client.post('/login', {
        username: this.username,
        password: this.password,
      });

      if (response.status !== 200 || !response.data.success) {
        throw new Error('3X-UI login failed');
      }

      this.sessionId = response.data.sessionId;
      this.client.defaults.headers.common['X-Session-ID'] = this.sessionId;
      console.log('✅ 3X-UI login successful');
      return true;
    } catch (error) {
      console.error('3X-UI login error:', error.message);
      throw error;
    }
  }

  async ensureSession() {
    if (!this.sessionId) {
      await this.login();
    }
  }

  async createClient(userEmail, countryCode = 'auto') {
    try {
      await this.ensureSession();

      const response = await this.client.post('/api/inbounds/addClient', {
        id: this.generateUUID(),
        alterId: 0,
        email: userEmail,
        limitIp: 0,
        limitDown: 0,
        limitUp: 0,
        totalGB: 0,
        expiryTime: 0,
      });

      if (!response.data.success) {
        throw new Error(response.data.msg || 'Failed to create client');
      }

      return {
        clientId: response.data.obj.id,
        clientEmail: userEmail,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('3X-UI create client error:', error.message);
      throw new Error('Failed to create VPN client');
    }
  }

  async getClientConfig(inboundId, clientId) {
    try {
      await this.ensureSession();

      const response = await this.client.get(`/api/inbounds/get/${inboundId}`);

      if (!response.data.success) {
        throw new Error('Failed to fetch inbound config');
      }

      const inbound = response.data.obj;
      const clients = JSON.parse(inbound.clientStats || '[]');
      const client = clients.find(c => c.email === clientId);

      if (!client) {
        throw new Error('Client not found in inbound');
      }

      return {
        protocol: inbound.protocol,
        inboundTag: inbound.tag,
        settings: inbound.settings,
        streamSettings: inbound.streamSettings,
        clientEmail: clientId,
      };
    } catch (error) {
      console.error('3X-UI get config error:', error.message);
      throw error;
    }
  }

  async generateConfigLink(protocol, settings) {
    try {
      const config = {
        protocol,
        settings,
        timestamp: Date.now(),
      };

      const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
      return `${this.apiUrl}/api/config/${encoded}`;
    } catch (error) {
      console.error('3X-UI generate link error:', error.message);
      throw error;
    }
  }

  async updateClientTraffic(clientEmail, trafficGb) {
    try {
      await this.ensureSession();

      const response = await this.client.post('/api/inbounds/updateClient', {
        email: clientEmail,
        totalGB: trafficGb * 1000000000,
      });

      if (!response.data.success) {
        throw new Error('Failed to update client traffic');
      }

      return true;
    } catch (error) {
      console.error('3X-UI update traffic error:', error.message);
      throw error;
    }
  }

  async deleteClient(inboundId, clientId) {
    try {
      await this.ensureSession();

      const response = await this.client.post('/api/inbounds/delClient', {
        inboundId,
        email: clientId,
      });

      if (!response.data.success) {
        throw new Error('Failed to delete client');
      }

      return true;
    } catch (error) {
      console.error('3X-UI delete client error:', error.message);
      throw error;
    }
  }

  async getInbounds() {
    try {
      await this.ensureSession();

      const response = await this.client.get('/api/inbounds/list');

      if (!response.data.success) {
        throw new Error('Failed to fetch inbounds');
      }

      return response.data.obj.map(inbound => ({
        id: inbound.id,
        tag: inbound.tag,
        protocol: inbound.protocol,
        port: inbound.port,
        listen: inbound.listen,
        settings: inbound.settings,
      }));
    } catch (error) {
      console.error('3X-UI get inbounds error:', error.message);
      throw error;
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async getStats(inboundId) {
    try {
      await this.ensureSession();

      const response = await this.client.get(`/api/inbounds/getStats/${inboundId}`);

      if (!response.data.success) {
        throw new Error('Failed to fetch stats');
      }

      return response.data.obj;
    } catch (error) {
      console.error('3X-UI get stats error:', error.message);
      return null;
    }
  }
}

module.exports = new X3UIService();
