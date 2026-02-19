const REQUIRED_ENV = [
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
  'X3UI_API_URL',
  'X3UI_USERNAME',
  'X3UI_PASSWORD',
];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

module.exports = {
  validateEnv,
  REQUIRED_ENV,
};
