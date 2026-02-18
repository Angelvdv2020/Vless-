import axios from 'axios';
import https from 'https';
import { logger } from './logger.js';
import { config } from './config.js';

const REMNA_API_BASE = config.x3ui.baseUrl;
const REMNA_API_TOKEN = config.x3ui.apiToken;
const REMNA_AUTH_MODE = config.x3ui.authMode;
const REMNA_LOGIN = config.x3ui.adminLogin;
const REMNA_PASSWORD = config.x3ui.adminPassword;

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_ENV === 'production'
});

let sessionCookie = null;

async function getAuthHeaders() {
  if (REMNA_AUTH_MODE === 'token') {
    return { Authorization: `Bearer ${REMNA_API_TOKEN}` };
  }
  if (!sessionCookie) {
    await loginToPanel();
  }
  return sessionCookie ? { Cookie: sessionCookie } : {};
}

async function loginToPanel() {
  try {
    const res = await axios.post(`${REMNA_API_BASE}/api/auth/login`, {
      username: REMNA_LOGIN,
      password: REMNA_PASSWORD,
    }, {
      withCredentials: true,
      httpsAgent,
      timeout: 10000
    });

    const cookies = res.headers['set-cookie'];
    if (cookies) {
      sessionCookie = cookies.map(c => c.split(';')[0]).join('; ');
      logger.info('3X-UI session established');
    }
  } catch (err) {
    logger.error('3X-UI login failed:', err.message);
    throw new Error('3X-UI authentication failed');
  }
}

async function apiRequest(method, path, data = null) {
  try {
    const headers = await getAuthHeaders();
    const url = `${REMNA_API_BASE}${path}`;
    const res = await axios({
      method,
      url,
      data,
      headers,
      httpsAgent,
      timeout: 30000
    });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401 && REMNA_AUTH_MODE === 'basic') {
      sessionCookie = null;
      const headers = await getAuthHeaders();
      const url = `${REMNA_API_BASE}${path}`;
      const res = await axios({
        method,
        url,
        data,
        headers,
        httpsAgent,
        timeout: 30000
      });
      return res.data;
    }
    logger.error(`3X-UI API error [${method} ${path}]:`, err.message);
    throw err;
  }
}

export const x3ui = {
  async getNodes() {
    return apiRequest('GET', '/api/nodes');
  },

  async getUsers() {
    return apiRequest('GET', '/api/users');
  },

  async getUser(username) {
    return apiRequest('GET', `/api/users/${username}`);
  },

  async createUser({ username, trafficLimitBytes = 0, expireAt, deviceLimit = 1 }) {
    return apiRequest('POST', '/api/users', {
      username,
      trafficLimitStrategy: trafficLimitBytes > 0 ? 'CUSTOM' : 'NO_LIMIT',
      trafficLimitBytes,
      expireAt,
      activateAllInbounds: true,
      hwidDeviceLimit: deviceLimit,
      status: 'ACTIVE',
    });
  },

  async updateUser(uuid, updates) {
    return apiRequest('PUT', `/api/users/${uuid}`, updates);
  },

  async deleteUser(uuid) {
    return apiRequest('DELETE', `/api/users/${uuid}`);
  },

  async disableUser(uuid) {
    return apiRequest('POST', `/api/users/disable/${uuid}`);
  },

  async enableUser(uuid) {
    return apiRequest('POST', `/api/users/enable/${uuid}`);
  },

  async extendUser(uuid, { expireAt, trafficLimitBytes }) {
    const payload = {};
    if (expireAt) payload.expireAt = expireAt;
    if (trafficLimitBytes !== undefined) payload.trafficLimitBytes = trafficLimitBytes;
    return apiRequest('PUT', `/api/users/${uuid}`, payload);
  },

  async getSubscriptionUrl(shortUuid) {
    const publicUrl = config.x3ui.apiBaseUrl || REMNA_API_BASE;
    return `${publicUrl}api/sub/${shortUuid}`;
  },

  async getInbounds() {
    return apiRequest('GET', '/api/inbounds');
  },

  async getSystemStats() {
    return apiRequest('GET', '/api/system');
  },
};
