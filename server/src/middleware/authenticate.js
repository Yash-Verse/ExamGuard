const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { config } = require('../config/env');
const { AppError, asyncHandler } = require('../utils/apiResponse');

module.exports = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Authentication required');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch (e) {
    throw new AppError(401, e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token');
  }
  if (!payload.sub || typeof payload.sub !== 'string') throw new AppError(401, 'Invalid token');

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'Authentication required');
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new AppError(401, 'Token no longer valid; please log in again');
  }
  req.user = user;
  next();
});
