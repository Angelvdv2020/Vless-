const x3ui = require('./x3ui');

class X3UIConfigService {
  async buildVlessConfig(clientEmail, inboundSettings, inboundTag, serverAddress = 'localhost') {
    const config = {
      protocol: 'vless',
      clientEmail,
      inboundTag,
      serverAddress,
      settings: inboundSettings,
    };

    return {
      link: this.encodeConfigLink(config),
      config,
    };
  }

  async buildVmessConfig(clientEmail, inboundSettings, inboundTag, serverAddress = 'localhost') {
    const config = {
      protocol: 'vmess',
      clientEmail,
      inboundTag,
      serverAddress,
      settings: inboundSettings,
    };

    return {
      link: this.encodeConfigLink(config),
      config,
    };
  }

  encodeConfigLink(config) {
    const json = JSON.stringify(config);
    const base64 = Buffer.from(json).toString('base64');
    return `noryx://${base64}`;
  }

  decodeConfigLink(link) {
    if (!link.startsWith('noryx://')) {
      throw new Error('Invalid config link format');
    }

    const base64 = link.replace('noryx://', '');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }

  async generateShareLink(clientEmail, inboundSettings) {
    const config = {
      type: 'vless',
      email: clientEmail,
      settings: inboundSettings,
      timestamp: Date.now(),
    };

    const encoded = Buffer.from(JSON.stringify(config)).toString('base64');
    return `https://noryx.vpn/config/${encoded}`;
  }

  async getClientUsage(clientEmail) {
    try {
      const inbounds = await x3ui.getInbounds();

      for (const inbound of inbounds) {
        const config = await x3ui.getClientConfig(inbound.id, clientEmail);
        if (config) {
          const stats = await x3ui.getStats(inbound.id);
          return {
            email: clientEmail,
            downloaded: stats?.down || 0,
            uploaded: stats?.up || 0,
            total: (stats?.down || 0) + (stats?.up || 0),
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting client usage:', error.message);
      return null;
    }
  }

  async expireClientTraffic(clientEmail, remainingGB = 0) {
    try {
      const inbounds = await x3ui.getInbounds();

      for (const inbound of inbounds) {
        try {
          await x3ui.updateClientTraffic(clientEmail, remainingGB);
          return true;
        } catch (err) {
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error('Error expiring client traffic:', error.message);
      return false;
    }
  }

  async removeExpiredClients() {
    try {
      const inbounds = await x3ui.getInbounds();
      let removedCount = 0;

      for (const inbound of inbounds) {
        const config = await x3ui.getClientConfig(inbound.id, '');
        if (config && config.expiryTime && config.expiryTime < Date.now()) {
          await x3ui.deleteClient(inbound.id, config.email);
          removedCount++;
        }
      }

      return { removedCount };
    } catch (error) {
      console.error('Error removing expired clients:', error.message);
      return { removedCount: 0, error: error.message };
    }
  }
}

module.exports = new X3UIConfigService();
