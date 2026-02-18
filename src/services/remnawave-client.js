/**
 * RemnaWave API Client
 * Для связи между VPS (Сервер 1) и RemnaWave AdminPanel (Сервер 2)
 */

const axios = require('axios');
const logger = require('../logger');

class RemnaWaveClient {
  constructor() {
    this.baseURL = process.env.REMNAWAVE_API_URL;
    this.apiToken = process.env.REMNAWAVE_API_TOKEN;
    this.timeout = parseInt(process.env.REMNAWAVE_TIMEOUT || '30000');
    this.retryAttempts = parseInt(process.env.REMNAWAVE_RETRY_ATTEMPTS || '3');

    if (!this.baseURL || !this.apiToken) {
      throw new Error('RemnaWave API configuration is missing (REMNAWAVE_API_URL, REMNAWAVE_API_TOKEN)');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Interceptor для логирования
    this.client.interceptors.request.use(
      config => {
        logger.debug(`[RemnaWave API] ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      error => {
        logger.error('[RemnaWave API] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      response => {
        logger.debug(`[RemnaWave API] Response ${response.status}`);
        return response;
      },
      error => {
        logger.error('[RemnaWave API] Response error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Создать VPN ключ для пользователя
   * @param {Object} params
   * @param {string} params.email - Email пользователя
   * @param {number} params.inboundId - ID inbound на сервере
   * @param {number} params.serverId - ID сервера RemnaWave (опционально)
   * @returns {Promise<Object>} - Данные созданного ключа
   */
  async createUser(params) {
    try {
      const { email, inboundId, serverId } = params;

      const response = await this.client.post('/users', {
        email,
        inboundId,
        serverId
      });

      logger.info(`[RemnaWave] User created: ${email}`);

      return {
        id: response.data.id,
        uuid: response.data.uuid,
        email: response.data.email,
        subscriptionUrl: response.data.subscription_url,
        qrCode: response.data.qr_code,
        createdAt: response.data.created_at
      };
    } catch (error) {
      logger.error(`[RemnaWave] Failed to create user: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Удалить VPN ключ пользователя
   * @param {number} userId - ID пользователя в RemnaWave
   * @returns {Promise<void>}
   */
  async deleteUser(userId) {
    try {
      await this.client.delete(`/users/${userId}`);
      logger.info(`[RemnaWave] User deleted: ${userId}`);
    } catch (error) {
      logger.error(`[RemnaWave] Failed to delete user: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить информацию о пользователе
   * @param {number} userId - ID пользователя в RemnaWave
   * @returns {Promise<Object>}
   */
  async getUser(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return {
        id: response.data.id,
        email: response.data.email,
        uuid: response.data.uuid,
        subscriptionUrl: response.data.subscription_url,
        trafficUsed: response.data.traffic_used,
        lastActive: response.data.last_active
      };
    } catch (error) {
      logger.error(`[RemnaWave] Failed to get user: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Обновить лимиты пользователя
   * @param {number} userId - ID пользователя в RemnaWave
   * @param {Object} limits
   * @param {number} limits.trafficLimit - Лимит трафика (bytes)
   * @param {Date} limits.expiresAt - Дата истечения
   * @returns {Promise<void>}
   */
  async updateUserLimits(userId, limits) {
    try {
      await this.client.patch(`/users/${userId}`, {
        traffic_limit: limits.trafficLimit,
        expires_at: limits.expiresAt
      });
      logger.info(`[RemnaWave] User limits updated: ${userId}`);
    } catch (error) {
      logger.error(`[RemnaWave] Failed to update user limits: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить список всех серверов
   * @returns {Promise<Array>}
   */
  async getServers() {
    try {
      const response = await this.client.get('/servers');
      return response.data.map(server => ({
        id: server.id,
        name: server.name,
        address: server.address,
        port: server.port,
        country: server.country,
        status: server.status,
        loadPercent: server.load_percent,
        usersCount: server.users_count,
        maxUsers: server.max_users
      }));
    } catch (error) {
      logger.error(`[RemnaWave] Failed to get servers: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить статистику сервера
   * @param {number} serverId
   * @returns {Promise<Object>}
   */
  async getServerStats(serverId) {
    try {
      const response = await this.client.get(`/servers/${serverId}/stats`);
      return {
        usersCount: response.data.users_count,
        trafficUp: response.data.traffic_up,
        trafficDown: response.data.traffic_down,
        loadPercent: response.data.load_percent,
        status: response.data.status
      };
    } catch (error) {
      logger.error(`[RemnaWave] Failed to get server stats: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить список inbounds на сервере
   * @param {number} serverId
   * @returns {Promise<Array>}
   */
  async getInbounds(serverId) {
    try {
      const response = await this.client.get(`/servers/${serverId}/inbounds`);
      return response.data.map(inbound => ({
        id: inbound.id,
        protocol: inbound.protocol,
        port: inbound.port,
        settings: inbound.settings,
        status: inbound.status
      }));
    } catch (error) {
      logger.error(`[RemnaWave] Failed to get inbounds: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Получить статистику трафика пользователя
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async getUserTraffic(userId) {
    try {
      const response = await this.client.get(`/users/${userId}/traffic`);
      return {
        upload: response.data.upload,
        download: response.data.download,
        total: response.data.total,
        lastUpdate: response.data.last_update
      };
    } catch (error) {
      logger.error(`[RemnaWave] Failed to get user traffic: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Заблокировать/разблокировать пользователя
   * @param {number} userId
   * @param {boolean} blocked
   * @returns {Promise<void>}
   */
  async setUserBlocked(userId, blocked) {
    try {
      await this.client.patch(`/users/${userId}`, {
        blocked
      });
      logger.info(`[RemnaWave] User ${blocked ? 'blocked' : 'unblocked'}: ${userId}`);
    } catch (error) {
      logger.error(`[RemnaWave] Failed to set user blocked status: ${error.message}`);
      throw new Error(`RemnaWave: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Проверить доступность RemnaWave API
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      logger.error(`[RemnaWave] Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Синхронизировать серверы с RemnaWave
   * Сохраняет актуальную информацию о серверах в локальную БД
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  async syncServers(db) {
    try {
      const servers = await this.getServers();

      for (const server of servers) {
        await db.query(`
          INSERT INTO servers (
            remnawave_id, name, country, ip_address, port,
            load_percent, users_count, status, last_sync_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (remnawave_id)
          DO UPDATE SET
            name = $2,
            country = $3,
            ip_address = $4,
            port = $5,
            load_percent = $6,
            users_count = $7,
            status = $8,
            last_sync_at = NOW()
        `, [
          server.id,
          server.name,
          server.country,
          server.address,
          server.port,
          server.loadPercent,
          server.usersCount,
          server.status
        ]);
      }

      logger.info(`[RemnaWave] Synced ${servers.length} servers`);
    } catch (error) {
      logger.error(`[RemnaWave] Failed to sync servers: ${error.message}`);
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new RemnaWaveClient();
    }
    return instance;
  },
  RemnaWaveClient
};
