const AuditLog = require('../models/AuditLog');
const { ok, asyncHandler } = require('../utils/apiResponse');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (typeof req.query.action === 'string') filter.action = req.query.action;
  if (['success', 'failure'].includes(req.query.outcome)) filter.outcome = req.query.outcome;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit), AuditLog.countDocuments(filter)]);
  return ok(res, { auditLogs: items.map((a) => a.toJSON()), pagination: pageMeta(page, limit, total) });
});
