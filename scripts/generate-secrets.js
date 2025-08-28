const crypto = require('crypto');

// Generate a secure random string for JWT secret
const generateSecret = (length = 64) => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

console.log('JWT_SECRET=', generateSecret());
console.log('REFRESH_TOKEN_SECRET=', generateSecret());
