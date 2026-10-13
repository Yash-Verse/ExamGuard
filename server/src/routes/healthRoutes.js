const router = require('express').Router();
const { dbStatus } = require('../config/db');
router.get('/', async (_req, res) => {
  const database = await dbStatus();
  const healthy = database === 'connected';
  res.status(healthy ? 200 : 503).json({
    success: healthy, message: healthy ? 'Service is healthy' : 'Service is degraded',
    data: { status: healthy ? 'ok' : 'degraded', database, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() },
  });
});
module.exports = router;
