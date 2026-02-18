const x3ui = require('./x3ui');
const pool = require('../database/db');

class AdminX3UIService {
  async createUserVPN(userId, countryCode = 'auto', trafficGB = 100) {
    try {
      const clientEmail = `user_${userId}_${Date.now()}@noryx.vpn`;
      const clientUUID = x3ui.generateUUID();

      const inbounds = await x3ui.getInbounds();
      if (inbounds.length === 0) {
        throw new Error('No inbounds available');
      }

      const inbound = inbounds[0];

      await x3ui.createClient(clientEmail, countryCode);
      await x3ui.updateClientTraffic(clientEmail, trafficGB);

      return {
        userId,
        clientEmail,
        clientUUID,
        inboundId: inbound.id,
        inboundTag: inbound.tag,
        trafficGB,
        status: 'active',
      };
    } catch (error) {
      console.error('Admin: Failed to create user VPN:', error.message);
      throw error;
    }
  }

  async revokeUserVPN(userId) {
    try {
      const userConfig = await pool.query(
        `SELECT x3ui_client_email, x3ui_inbound_id FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId]
      );

      if (userConfig.rows.length === 0) {
        return { success: false, message: 'No active VPN found' };
      }

      const { x3ui_client_email, x3ui_inbound_id } = userConfig.rows[0];

      await x3ui.deleteClient(x3ui_inbound_id, x3ui_client_email);

      await pool.query(
        `UPDATE subscriptions
         SET x3ui_client_uuid = NULL, x3ui_client_email = NULL, x3ui_inbound_id = NULL
         WHERE user_id = $1`,
        [userId]
      );

      return { success: true, message: `VPN revoked for user ${userId}` };
    } catch (error) {
      console.error('Admin: Failed to revoke user VPN:', error.message);
      throw error;
    }
  }

  async getUserVPNStats(userId) {
    try {
      const userConfig = await pool.query(
        `SELECT x3ui_inbound_id, x3ui_client_email FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId]
      );

      if (userConfig.rows.length === 0) {
        return null;
      }

      const { x3ui_inbound_id, x3ui_client_email } = userConfig.rows[0];

      const stats = await x3ui.getStats(x3ui_inbound_id);

      return {
        userId,
        clientEmail: x3ui_client_email,
        stats,
      };
    } catch (error) {
      console.error('Admin: Failed to get VPN stats:', error.message);
      return null;
    }
  }

  async getAllUsersVPNStatus() {
    try {
      const result = await pool.query(
        `SELECT s.user_id, s.x3ui_client_email, s.x3ui_inbound_id, s.status, s.expires_at
         FROM subscriptions s
         WHERE s.x3ui_client_email IS NOT NULL
         ORDER BY s.created_at DESC`
      );

      return result.rows.map(row => ({
        userId: row.user_id,
        clientEmail: row.x3ui_client_email,
        inboundId: row.x3ui_inbound_id,
        status: row.status,
        expiresAt: row.expires_at,
      }));
    } catch (error) {
      console.error('Admin: Failed to get all VPN status:', error.message);
      return [];
    }
  }

  async resetClientTraffic(userId, trafficGB) {
    try {
      const userConfig = await pool.query(
        `SELECT x3ui_client_email FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         LIMIT 1`,
        [userId]
      );

      if (userConfig.rows.length === 0) {
        return { success: false, message: 'No active VPN found' };
      }

      const { x3ui_client_email } = userConfig.rows[0];

      await x3ui.updateClientTraffic(x3ui_client_email, trafficGB);

      return {
        success: true,
        message: `Traffic reset to ${trafficGB}GB for user ${userId}`,
      };
    } catch (error) {
      console.error('Admin: Failed to reset traffic:', error.message);
      throw error;
    }
  }

  async getInboundsInfo() {
    try {
      const inbounds = await x3ui.getInbounds();

      const inboundsInfo = [];
      for (const inbound of inbounds) {
        const stats = await x3ui.getStats(inbound.id);
        inboundsInfo.push({
          id: inbound.id,
          tag: inbound.tag,
          protocol: inbound.protocol,
          port: inbound.port,
          listen: inbound.listen,
          stats: stats || {},
        });
      }

      return inboundsInfo;
    } catch (error) {
      console.error('Admin: Failed to get inbounds info:', error.message);
      return [];
    }
  }

  async syncClientDatabase() {
    try {
      const inbounds = await x3ui.getInbounds();
      let syncedCount = 0;

      for (const inbound of inbounds) {
        const config = await x3ui.getClientConfig(inbound.id, '');

        if (config && config.clientEmail) {
          const existingClient = await pool.query(
            `SELECT id FROM subscriptions WHERE x3ui_client_email = $1`,
            [config.clientEmail]
          );

          if (existingClient.rows.length === 0) {
            await pool.query(
              `INSERT INTO vpn_keys (x3ui_client_id, x3ui_inbound_id, x3ui_inbound_tag, created_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
              [config.clientEmail, inbound.id, inbound.tag]
            );
            syncedCount++;
          }
        }
      }

      return { syncedCount, message: `Synced ${syncedCount} clients from 3X-UI` };
    } catch (error) {
      console.error('Admin: Failed to sync database:', error.message);
      throw error;
    }
  }

  async cleanupExpiredClients() {
    try {
      const expiredSubs = await pool.query(
        `SELECT id, user_id, x3ui_client_email, x3ui_inbound_id
         FROM subscriptions
         WHERE x3ui_client_email IS NOT NULL
         AND (status = 'cancelled' OR expires_at < NOW())`
      );

      let cleanedCount = 0;

      for (const sub of expiredSubs.rows) {
        try {
          await x3ui.deleteClient(sub.x3ui_inbound_id, sub.x3ui_client_email);

          await pool.query(
            `UPDATE subscriptions
             SET x3ui_client_uuid = NULL, x3ui_client_email = NULL, x3ui_inbound_id = NULL
             WHERE id = $1`,
            [sub.id]
          );

          cleanedCount++;
        } catch (err) {
          console.error(`Failed to delete client ${sub.x3ui_client_email}:`, err.message);
        }
      }

      return { cleanedCount, message: `Cleaned up ${cleanedCount} expired clients` };
    } catch (error) {
      console.error('Admin: Failed to cleanup expired clients:', error.message);
      throw error;
    }
  }
}

module.exports = new AdminX3UIService();
