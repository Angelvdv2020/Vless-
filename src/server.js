const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const vpnRoutes = require('./routes/vpn');
const adminRoutes = require('./routes/admin');
const adminX3UIRoutes = require('./routes/admin-x3ui');
const authRoutes = require('./routes/auth');
const siteBuilderRoutes = require('./routes/site-builder');
const { initX3UISession, startSessionRefresh } = require('./middleware/x3ui-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for demo
}));

// CORS configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow if no origin (same-origin requests) or origin is in allowed list
    if (!origin || allowedOrigins.some(allowed => {
      // Normalize origins for comparison (remove trailing slashes)
      const normalizedOrigin = origin.replace(/\/$/, '');
      const normalizedAllowed = allowed.replace(/\/$/, '');
      return normalizedOrigin === normalizedAllowed;
    })) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Noryx Premium VPN' });
});

// Initialize 3X-UI session
app.use(initX3UISession);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vpn', vpnRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/x3ui', adminX3UIRoutes);
app.use('/api/admin/site-builder', siteBuilderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Noryx Premium VPN Server Started');
  console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.X3UI_API_URL) {
    startSessionRefresh(3600000);
    console.log('🔄 3X-UI session refresh started (1 hour interval)');
  }

  console.log('\n📋 Available Endpoints:');
  console.log('   GET  /health');
  console.log('   POST /api/auth/register');
  console.log('   POST /api/auth/login');
  console.log('   GET  /api/auth/profile');
  console.log('   POST /api/vpn/connect');
  console.log('   GET  /api/vpn/countries');
  console.log('   POST /api/vpn/change-country');
  console.log('   GET  /api/vpn/download/:token');
  console.log('   GET  /api/vpn/stats');
  console.log('\n🔐 Admin Panel (http://localhost:' + PORT + '/admin.html):');
  console.log('   GET    /api/admin/users');
  console.log('   GET    /api/admin/subscriptions');
  console.log('   PATCH  /api/admin/subscriptions/:id/renew');
  console.log('   PATCH  /api/admin/subscriptions/:id/cancel');
  console.log('   POST   /api/admin/subscriptions/grant-trial');
  console.log('   GET    /api/admin/countries');
  console.log('   PATCH  /api/admin/countries/:code/toggle');
  console.log('   GET    /api/admin/stats');
  console.log('   GET    /api/admin/connection-logs');
  console.log('\n3️⃣  3X-UI Management (Admin only):');
  console.log('   POST   /api/admin/x3ui/create-vpn');
  console.log('   POST   /api/admin/x3ui/revoke-vpn');
  console.log('   GET    /api/admin/x3ui/user-stats/:userId');
  console.log('   GET    /api/admin/x3ui/all-users-status');
  console.log('   POST   /api/admin/x3ui/reset-traffic');
  console.log('   GET    /api/admin/x3ui/inbounds-info');
  console.log('   POST   /api/admin/x3ui/sync-database');
  console.log('   POST   /api/admin/x3ui/cleanup-expired');
  console.log('   GET    /api/admin/site-builder/content');
  console.log('   PUT    /api/admin/site-builder/content/:key');
  console.log('   POST   /api/admin/site-builder/ai/text');
  console.log('   POST   /api/admin/site-builder/ai/image');
});

module.exports = app;
