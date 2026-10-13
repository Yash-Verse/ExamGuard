process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123456';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/examguard_test';
