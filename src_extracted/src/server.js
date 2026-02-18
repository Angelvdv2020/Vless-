import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';
import { setupSecurity } from './security.js';
import { startScheduler } from './scheduler.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import tariffRoutes from './routes/tariffs.js';
import referralRoutes from './routes/referrals.js';
import serverRoutes from './routes/servers.js';
import newsRoutes from './routes/news.js';
import notificationRoutes from './routes/notifications.js';
import mailingRoutes from './routes/mailings.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!config.supabase.url || !config.supabase.anonKey) {
  logger.warn('⚠️  Supabase credentials not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

if (!config.x3ui.adminLogin && !config.x3ui.apiToken) {
  logger.warn('⚠️  3X-UI credentials not configured. Set REMNA_ADMIN_LOGIN/PASSWORD or REMNA_API_TOKEN');
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", config.supabase.url || '', "https://*.supabase.co"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

const limiter = rateLimit(config.rateLimit);
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/assets', express.static(path.join(__dirname, '../web/assets')));
app.use('/public', express.static(path.join(__dirname, '../web/public')));

setupSecurity(app);

app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.nodeEnv,
    services: {
      supabase: !!config.supabase.url && !!config.supabase.anonKey,
      x3ui: !!config.x3ui.adminLogin || !!config.x3ui.apiToken,
    },
  };
  res.json(health);
});

app.use('/api/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tariffs', tariffRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/mailings', mailingRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/settings/:key', async (req, res) => {
  try {
    const { supabase } = await import('./supabase.js');
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', req.params.key)
      .maybeSingle();
    res.json(data?.value || {});
  } catch (err) {
    logger.error('Settings fetch error:', err.message);
    res.json({});
  }
});

const pages = ['index', 'login', 'register', 'cabinet', 'servers', 'tariffs', 'apps', 'news', 'support', 'referral'];
pages.forEach(page => {
  app.get(`/${page === 'index' ? '' : page}`, (req, res) => {
    res.sendFile(path.join(__dirname, `../web/pages/${page}.html`));
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../web/pages/index.html'));
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

const server = app.listen(config.port, config.host, () => {
  const protocol = config.nodeEnv === 'production' ? 'https' : 'http';
  const supabaseStatus = config.supabase.url && config.supabase.anonKey ? '✓ Connected' : '✗ Not configured';
  const remnaWaveStatus = config.x3ui.adminLogin || config.x3ui.apiToken ? '✓ Configured' : '✗ Not configured';
  const databaseStatus = config.database.user ? '✓ Connected' : '✗ Not configured';

  logger.success(`
╔═══════════════════════════════════════════════════════╗
║          NoryxVPN Platform Started                    ║
╠═══════════════════════════════════════════════════════╣
║  URL:        ${protocol}://${config.host}:${config.port.toString().padEnd(18)}║
║  Env:        ${config.nodeEnv.padEnd(45)}║
║  Database:   ${databaseStatus.padEnd(45)}║
║  Supabase:   ${supabaseStatus.padEnd(45)}║
║  3X-UI:  ${remnaWaveStatus.padEnd(45)}║
╚═══════════════════════════════════════════════════════╝
Ready to accept connections...
  `);

  startScheduler();
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
