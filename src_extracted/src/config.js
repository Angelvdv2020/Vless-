import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'JWT_SECRET',
  'REMNA_ADMIN_LOGIN',
  'REMNA_ADMIN_PASSWORD',
];

const validateRequiredEnvVars = () => {
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please set these in your .env file`
    );
  }

  if (process.env.JWT_SECRET === 'change-this-secret-key-in-production') {
    throw new Error(
      'CRITICAL: JWT_SECRET has default value. ' +
      'Set a secure random secret at least 32 characters long in your .env file'
    );
  }

  if (process.env.CORS_ORIGIN === '*' && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL: CORS_ORIGIN cannot be "*" in production. ' +
      'Set specific allowed origins in your .env file'
    );
  }
};

const parseCorsOrigin = () => {
  const origin = process.env.CORS_ORIGIN || process.env.CORS_ALLOWED_ORIGINS || '*';

  if (origin === '*') {
    return '*';
  }

  return origin.split(',').map(o => o.trim());
};

export const config = {
  port: parseInt(process.env.PORT, 10) || 3100,
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'noryx_vpn',
    user: process.env.DB_USER || 'noryx',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? true : false,
  },

  supabase: {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  },

  remnawave: {
    baseUrl: process.env.REMNA_BASE_URL || 'http://127.0.0.1:3000',
    apiBaseUrl: process.env.REMNA_API_BASE_URL || 'https://panel.yourdomain.com/',
    authMode: process.env.REMNA_API_AUTH_MODE || 'basic',
    apiToken: process.env.REMNA_API_TOKEN || '',
    adminLogin: process.env.REMNA_ADMIN_LOGIN,
    adminPassword: process.env.REMNA_ADMIN_PASSWORD,
    timeout: 30000,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.ip ||
             req.socket.remoteAddress ||
             'unknown';
    },
  },

  cors: {
    origin: parseCorsOrigin(),
    credentials: true,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
};

if (process.env.NODE_ENV === 'production') {
  try {
    validateRequiredEnvVars();
  } catch (error) {
    console.error('\n🔴 CONFIGURATION ERROR:');
    console.error(error.message);
    console.error('\nApplication cannot start without proper configuration.');
    process.exit(1);
  }
}
