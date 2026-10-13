const { config, validateConfig } = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const logger = require('./utils/logger');

(async () => {
  try {
    validateConfig();
    await connectDB();
    createApp().listen(config.port, () => logger.info('server_started', { port: config.port, env: config.env }));
  } catch (e) {
    console.error(`Startup failed: ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
})();
