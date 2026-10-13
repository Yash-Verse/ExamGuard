const User = require('../models/User');
const authService = require('../services/authService');
const { guardedUpdate } = require('../services/userService');
const audit = require('../services/auditService');
const { ok, created, AppError, asyncHandler } = require('../utils/apiResponse');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { AUDIT_ACTIONS: A } = require('../config/constants');

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const passwordHash = await authService.hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role });
  await audit.record({ req, action: A.USER_CREATED, resourceType: 'User', resourceId: user._id, metadata: { role } });
  return created(res, { user: user.toJSON() }, 'User created successfully');
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = req.query.role ? { role: req.query.role } : {};
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(filter)]);
  return ok(res, { users: users.map((u) => u.toJSON()), pagination: pageMeta(page, limit, total) });
});

exports.getOne = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'User not found');
  return ok(res, { user: user.toJSON() });
});

exports.update = asyncHandler(async (req, res) => {
  const changes = {};
  if (req.body.name !== undefined) changes.name = req.body.name;
  if (req.body.email !== undefined) changes.email = req.body.email;
  const result = await User.updateOne({ _id: req.params.id }, { $set: changes }, { runValidators: true });
  if (result.matchedCount !== 1) throw new AppError(404, 'User not found');
  const user = await User.findById(req.params.id);
  await audit.record({ req, action: A.USER_UPDATED, resourceType: 'User', resourceId: user._id, metadata: { fields: Object.keys(changes).join(',') } });
  return ok(res, { user: user.toJSON() }, 'User updated successfully');
});

exports.setStatus = asyncHandler(async (req, res) => {
  const { before, after } = await guardedUpdate(req.params.id, { isActive: req.body.isActive });
  if (before.isActive !== after.isActive) {
    await audit.record({ req, action: after.isActive ? A.USER_ACTIVATED : A.USER_DEACTIVATED, resourceType: 'User', resourceId: after._id });
  }
  return ok(res, { user: after.toJSON() }, 'User status updated successfully');
});

exports.setRole = asyncHandler(async (req, res) => {
  const { before, after } = await guardedUpdate(req.params.id, { role: req.body.role });
  if (before.role !== after.role) {
    await audit.record({ req, action: A.USER_ROLE_CHANGED, resourceType: 'User', resourceId: after._id, metadata: { from: before.role, to: after.role } });
  }
  return ok(res, { user: after.toJSON() }, 'User role updated successfully');
});
