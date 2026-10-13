const ok = (res, data = {}, message = 'Operation completed successfully', status = 200) =>
  res.status(status).json({ success: true, message, data });
const created = (res, data = {}, message = 'Resource created successfully') => ok(res, data, message, 201);
const fail = (res, status, message, errors = []) => res.status(status).json({ success: false, message, errors });

class AppError extends Error {
  constructor(status, message, errors = []) { super(message); this.status = status; this.errors = errors; this.isAppError = true; }
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { ok, created, fail, AppError, asyncHandler };
