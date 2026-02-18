const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  reset: '\x1b[0m'
};

export const logger = {
  info: (...args) => {
    console.log(`${colors.info}[INFO]${colors.reset}`, new Date().toISOString(), ...args);
  },
  success: (...args) => {
    console.log(`${colors.success}[SUCCESS]${colors.reset}`, new Date().toISOString(), ...args);
  },
  warn: (...args) => {
    console.warn(`${colors.warn}[WARN]${colors.reset}`, new Date().toISOString(), ...args);
  },
  error: (...args) => {
    console.error(`${colors.error}[ERROR]${colors.reset}`, new Date().toISOString(), ...args);
  }
};
