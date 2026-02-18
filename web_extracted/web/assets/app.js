const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || '';

const Auth = {
  _session: null,

  init() {
    const stored = localStorage.getItem('vpn_session');
    if (stored) {
      try {
        this._session = JSON.parse(stored);
      } catch (e) {
        localStorage.removeItem('vpn_session');
      }
    }
    this.updateUI();
  },

  getToken() {
    return this._session?.access_token || null;
  },

  getUser() {
    return this._session?.user || null;
  },

  isLoggedIn() {
    if (!this._session) return false;
    const expiresAt = this._session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      this.clearSession();
      return false;
    }
    return true;
  },

  setSession(session) {
    this._session = session;
    if (session) {
      localStorage.setItem('vpn_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('vpn_session');
    }
    this.updateUI();
  },

  clearSession() {
    this._session = null;
    localStorage.removeItem('vpn_session');
    this.updateUI();
  },

  async login(email, password) {
    const res = await API.post('/api/auth/login', { email, password });
    if (res.session) {
      this.setSession(res.session);
    }
    return res;
  },

  async register(email, password, username, referralCode) {
    const res = await API.post('/api/auth/register', { email, password, username, referralCode });
    if (res.session) {
      this.setSession(res.session);
    }
    return res;
  },

  async logout() {
    try {
      await API.post('/api/auth/logout', {});
    } catch (e) {}
    this.clearSession();
    window.location.href = '/';
  },

  updateUI() {
    const loggedIn = this.isLoggedIn();
    document.querySelectorAll('[data-auth="guest"]').forEach(el => {
      el.style.display = loggedIn ? 'none' : '';
    });
    document.querySelectorAll('[data-auth="user"]').forEach(el => {
      el.style.display = loggedIn ? '' : 'none';
    });
    document.querySelectorAll('[data-auth-email]').forEach(el => {
      el.textContent = this.getUser()?.email || '';
    });
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return false;
    }
    return true;
  }
};

const API = {
  async request(method, url, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const opts = { method, headers };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Ошибка запроса');
    }
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  delete(url) { return this.request('DELETE', url); },
};

function formatDate(dateStr) {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '---';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatPrice(amount, currency) {
  if (amount === 0) return 'Бесплатно';
  const sym = currency === 'RUB' ? ' ₽' : currency === 'USD' ? '$' : ` ${currency}`;
  if (currency === 'USD') return `${sym}${amount}`;
  return `${amount}${sym}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(container) {
  if (typeof container === 'string') {
    container = document.querySelector(container);
  }
  if (container) {
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  }
}

function copyToClipboard(text, btn) {
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    animateCopyButton(btn);
    showToast('Скопировано в буфер обмена', 'success');
  }).catch(() => {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    animateCopyButton(btn);
    showToast('Скопировано', 'success');
  });
}

function animateCopyButton(btn) {
  if (!btn) return;
  const target = typeof btn === 'string' ? document.querySelector(btn) : btn.target || btn;
  if (!target) return;

  target.classList.add('copied');
  target.textContent = '✓ Скопировано';
  setTimeout(() => {
    target.classList.remove('copied');
    target.textContent = '📋 Копировать';
  }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
