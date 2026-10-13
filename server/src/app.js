const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { config } = require('./config/env');
const requestId = require('./middleware/requestId');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(helmet());
  app.use(cors({
    // Non-browser clients (Postman, curl) send no Origin header and are allowed; browsers must be on the allowlist
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => logger.info('request', { requestId: req.id, method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - start }));
    next();
  });

  // Versioned-style grouping: Module 2-4 routes will be mounted alongside these under /api
  app.use('/api/health', require('./routes/healthRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/examinations', require('./routes/examinationRoutes'));
  app.use('/api/audit-logs', require('./routes/auditRoutes'));
  app.use('/api', require('./routes/placeholderRoutes'));

  const path = require('path');
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
