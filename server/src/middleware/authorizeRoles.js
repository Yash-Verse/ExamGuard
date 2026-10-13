const { AppError } = require('../utils/apiResponse');
module.exports = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to perform this action'));
  return next();
};
