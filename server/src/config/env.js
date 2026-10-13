require('dotenv').config({ quiet: true });

const isTest = process.env.NODE_ENV === 'test';
const int = (v, d) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : d);

const config = {
  env: process.env.NODE_ENV || 'development',
  isTest,
  port: int(process.env.PORT, 5000),
  mongoUri: isTest ? process.env.TEST_MONGO_URI : process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    maxAuth: int(process.env.RATE_LIMIT_MAX_AUTH, 10),
  },
};

function validateConfig() {
  const problems = [];
  if (!config.jwtSecret || config.jwtSecret.length < 32) problems.push('JWT_SECRET must be set and at least 32 characters');
  if (!config.mongoUri) problems.push(isTest ? 'TEST_MONGO_URI must be set' : 'MONGO_URI must be set');
  if (config.bcryptRounds < 4 || (!isTest && config.bcryptRounds < 10)) problems.push('BCRYPT_ROUNDS must be >= 10');
  if (isTest && !/test/i.test(config.mongoUri || '')) problems.push('TEST_MONGO_URI database name must contain "test" (safety check)');
  if (problems.length) throw new Error(`Invalid configuration: ${problems.join('; ')}`);
}

module.exports = { config, validateConfig };
