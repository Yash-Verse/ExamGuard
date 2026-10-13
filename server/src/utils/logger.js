// Minimal structured JSON logger (no secrets, no bodies).
const { config } = require('../config/env');
function log(level, msg, fields = {}) {
  if (config.isTest) return;
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
}
module.exports = { info: (m, f) => log('info', m, f), warn: (m, f) => log('warn', m, f), error: (m, f) => log('error', m, f) };
