const x3ui = require('../services/x3ui');

let sessionRefreshTimer = null;

async function initX3UISession(req, res, next) {
  try {
    await x3ui.ensureSession();
    next();
  } catch (error) {
    console.error('Failed to initialize 3X-UI session:', error.message);
    res.status(503).json({ error: 'VPN service temporarily unavailable' });
  }
}

function startSessionRefresh(intervalMs = 3600000) {
  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
  }

  sessionRefreshTimer = setInterval(async () => {
    try {
      console.log('🔄 Refreshing 3X-UI session...');
      await x3ui.login();
      console.log('✅ 3X-UI session refreshed');
    } catch (error) {
      console.error('Failed to refresh 3X-UI session:', error.message);
    }
  }, intervalMs);
}

function stopSessionRefresh() {
  if (sessionRefreshTimer) {
    clearInterval(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
}

module.exports = {
  initX3UISession,
  startSessionRefresh,
  stopSessionRefresh,
};
