const { fail } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const notFound = (req, res) => fail(res, 404, 'Route not found');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err.isAppError) return fail(res, err.status, err.message, err.errors);
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'Malformed JSON body');
  if (err.type === 'entity.too.large') return fail(res, 413, 'Request body too large');
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return fail(res, 409, 'Resource already exists', [{ field, message: 'Must be unique' }]);
  }
  if (err.name === 'CastError') return fail(res, 400, 'Invalid identifier');
  if (err.name === 'ValidationError') return fail(res, 422, 'Validation failed', Object.values(err.errors).map((e) => ({ field: e.path, message: 'Invalid value' })));
  if (/buffering timed out|ECONNREFUSED|Server selection/i.test(err.message || '') || /MongoNetwork|MongoNotConnected|ServerSelection|MongoTopology/.test(err.name)) {
    return fail(res, 503, 'Service temporarily unavailable');
  }
  logger.error('unhandled_error', { requestId: req.id, name: err.name, path: req.path });
  return fail(res, 500, 'Internal server error');
}
module.exports = { errorHandler, notFound };
