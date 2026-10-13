const User = require('../models/User');
const { AppError } = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');

const activeAdminsExcluding = (id) => User.countDocuments({ _id: { $ne: id }, role: ROLES.ADMIN, isActive: true });
const activeAdmins = () => User.countDocuments({ role: ROLES.ADMIN, isActive: true });

/**
 * Applies a role/isActive change while guaranteeing at least one active Admin remains.
 * 1) pre-check, 2) optimistic conditional update, 3) post-check with rollback.
 * Step 3 makes two concurrent "demote each other" requests safe: if both slip past step 1,
 * both see zero admins afterwards and both roll back (both get 409).
 */
async function guardedUpdate(id, changes) {
  const before = await User.findById(id);
  if (!before) throw new AppError(404, 'User not found');
  const wasActiveAdmin = before.role === ROLES.ADMIN && before.isActive;
  const willBe = (changes.role ?? before.role) === ROLES.ADMIN && (changes.isActive ?? before.isActive);
  const risky = wasActiveAdmin && !willBe;

  if (risky && (await activeAdminsExcluding(id)) === 0) {
    throw new AppError(409, 'Cannot disable or demote the last active Admin');
  }
  // Conditional (optimistic) update: only applies if role/isActive are still what we read
  const result = await User.updateOne(
    { _id: id, role: before.role, isActive: before.isActive }, { $set: changes }, { runValidators: true });
  if (result.matchedCount !== 1) throw new AppError(409, 'User was modified concurrently; please retry');
  const after = await User.findById(id);

  if (risky && (await activeAdmins()) === 0) {
    await User.updateOne({ _id: id }, { $set: { role: before.role, isActive: before.isActive } });
    throw new AppError(409, 'Cannot disable or demote the last active Admin');
  }
  return { before, after };
}
module.exports = { guardedUpdate };
