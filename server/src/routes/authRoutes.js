const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');
const c = require('../controllers/authController');
const v = require('../validators/authValidators');
const authenticate = require('../middleware/authenticate');
const { fail } = require('../utils/apiResponse');

const limiter = config.rateLimit.enabled
  ? rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.maxAuth, standardHeaders: true, legacyHeaders: false,
      handler: (_req, res) => fail(res, 429, 'Too many attempts. Please try again later.') })
  : (_req, _res, next) => next();

router.post('/login', limiter, v.login, c.login);
router.post('/logout', authenticate, c.logout);
router.get('/me', authenticate, c.me);
router.post('/change-password', limiter, authenticate, v.changePassword, c.changePassword);
module.exports = router;
