const crypto = require('crypto');

function hashPassword(password, salt = null) {
  const safeSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, safeSalt, 100000, 64, 'sha512').toString('hex');
  return `${safeSalt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, original] = (storedHash || '').split(':');
  if (!salt || !original) return false;
  const check = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(original, 'hex'));
}

module.exports = { hashPassword, verifyPassword };
