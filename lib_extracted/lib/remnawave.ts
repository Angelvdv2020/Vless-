const REMNA_API_BASE = process.env.REMNA_BASE_URL || 'http://127.0.0.1:3000';
const REMNA_API_TOKEN = process.env.REMNA_API_TOKEN || '';
const REMNA_AUTH_MODE = process.env.REMNA_API_AUTH_MODE || 'basic';
const REMNA_LOGIN = process.env.REMNA_ADMIN_LOGIN || '';
const REMNA_PASSWORD = process.env.REMNA_ADMIN_PASSWORD || '';

let sessionCookie: string | null = null;

async function getAuthHeaders(): Promise<Record<string, string>> {
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
    const res = await fetch(`${REMNA_API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: REMNA_LOGIN,
        password: REMNA_PASSWORD,
      }),
    });

    if (!res.ok) throw new Error('Login failed');

    const cookies = res.headers.getSetCookie();
    if (cookies.length) {
      sessionCookie = cookies.map((c) => c.split(';')[0]).join('; ');
    }
  } catch (err) {
    console.error('3X-UI login failed:', err);
    throw new Error('3X-UI authentication failed');
  }
}

async function apiRequest(method: string, path: string, data: any = null) {
  try {
    const headers = await getAuthHeaders();
    const url = `${REMNA_API_BASE}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!res.ok) {
      if (res.status === 401 && REMNA_AUTH_MODE === 'basic') {
        sessionCookie = null;
        return apiRequest(method, path, data);
      }
      throw new Error(`API error: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    console.error(`3X-UI API error [${method} ${path}]:`, err);
    throw err;
  }
}

const x3ui = {
  async getNodes() {
    return apiRequest('GET', '/api/nodes');
  },

  async getUsers() {
    return apiRequest('GET', '/api/users');
  },

  async getUser(username: string) {
    return apiRequest('GET', `/api/users/${username}`);
  },

  async createUser({
    username,
    trafficLimitBytes = 0,
    expireAt,
    deviceLimit = 1,
  }: any) {
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

  async updateUser(uuid: string, updates: any) {
    return apiRequest('PUT', `/api/users/${uuid}`, updates);
  },

  async deleteUser(uuid: string) {
    return apiRequest('DELETE', `/api/users/${uuid}`);
  },

  async disableUser(uuid: string) {
    return apiRequest('POST', `/api/users/disable/${uuid}`);
  },

  async enableUser(uuid: string) {
    return apiRequest('POST', `/api/users/enable/${uuid}`);
  },

  async extendUser(uuid: string, { expireAt, trafficLimitBytes }: any) {
    const payload: any = {};
    if (expireAt) payload.expireAt = expireAt;
    if (trafficLimitBytes !== undefined) payload.trafficLimitBytes = trafficLimitBytes;
    return apiRequest('PUT', `/api/users/${uuid}`, payload);
  },

  async getInbounds() {
    return apiRequest('GET', '/api/inbounds');
  },

  async getSystemStats() {
    return apiRequest('GET', '/api/system');
  },
};

export default x3ui;
