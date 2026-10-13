const User = require('../models/User');
const { ROLES, EXAM_STATUS, EXAM_TRANSITIONS } = require('../config/constants');
const { AppError } = require('../utils/apiResponse');

/** Role-scoped filter. Admin: all. Investigator: all except Draft. Custodian: only assigned, non-Draft. */
function scopeFor(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.INVESTIGATOR) return { status: { $ne: EXAM_STATUS.DRAFT } };
  return { status: { $ne: EXAM_STATUS.DRAFT }, assignedCustodians: user._id };
}

async function assertValidCustodians(ids = []) {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const count = await User.countDocuments({ _id: { $in: unique }, role: ROLES.CUSTODIAN, isActive: true });
  if (count !== unique.length) throw new AppError(422, 'Validation failed', [{ field: 'assignedCustodians', message: 'Must be active Custodian user IDs' }]);
}
const canTransition = (from, to) => (EXAM_TRANSITIONS[from] || []).includes(to);
module.exports = { scopeFor, assertValidCustodians, canTransition };
