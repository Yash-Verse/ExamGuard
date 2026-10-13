const { validationResult } = require('express-validator');
const { fail } = require('../utils/apiResponse');

function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return fail(res, 422, 'Validation failed', errors);
}

/** Rejects unexpected body fields (anti mass-assignment). */
const allowOnlyFields = (allowed) => (req, res, next) => {
  const extra = Object.keys(req.body || {}).filter((k) => !allowed.includes(k));
  if (extra.length) return fail(res, 422, 'Validation failed', extra.map((f) => ({ field: f, message: 'Field is not allowed' })));
  return next();
};
module.exports = { validate, allowOnlyFields };
