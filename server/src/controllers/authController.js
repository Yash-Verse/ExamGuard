const User = require('../models/User');
const authService = require('../services/authService');
const audit = require('../services/auditService');
const { ok, AppError, asyncHandler } = require('../utils/apiResponse');
const { AUDIT_ACTIONS: A } = require('../config/constants');

const INVALID = 'Invalid email or password';

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Always run a bcrypt compare so timing does not reveal whether the email exists
  const match = await authService.comparePassword(password, user ? user.passwordHash : authService.DUMMY_HASH);
  const emailHash = audit.hashEmail(email);

  if (!user || !match) {
    await audit.record({ req, actor: user ? user._id : null, action: A.LOGIN_FAILURE, resourceType: 'User', resourceId: user?._id, outcome: 'failure', metadata: { reason: 'invalid_credentials', emailHash } });
    throw new AppError(401, INVALID);
  }
  if (!user.isActive) {
    await audit.record({ req, actor: user._id, action: A.LOGIN_FAILURE, resourceType: 'User', resourceId: user._id, outcome: 'failure', metadata: { reason: 'account_disabled', emailHash } });
    throw new AppError(403, 'Account is disabled. Contact an administrator.');
  }
  await audit.record({ req, actor: user._id, action: A.LOGIN_SUCCESS, resourceType: 'User', resourceId: user._id, metadata: { emailHash } });
  const token = authService.signToken(user);
  return ok(res, { token, tokenType: 'Bearer', user: user.toJSON() }, 'Login successful');
});

// Stateless JWT: the server does NOT revoke tokens. The client must discard the token.
// The call is audited so logouts are visible. Tokens still expire via JWT_EXPIRES_IN.
exports.logout = asyncHandler(async (req, res) => {
  await audit.record({ req, action: A.LOGOUT, resourceType: 'User', resourceId: req.user._id });
  return ok(res, {}, 'Logged out. Discard the token on the client; it is not revoked server-side and expires on its own.');
});

exports.me = asyncHandler(async (req, res) => ok(res, { user: req.user.toJSON() }));

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  const good = await authService.comparePassword(req.body.currentPassword, user.passwordHash);
  if (!good) {
    await audit.record({ req, action: A.PASSWORD_CHANGE_FAILED, resourceType: 'User', resourceId: user._id, outcome: 'failure', metadata: { reason: 'wrong_current_password' } });
    throw new AppError(401, 'Current password is incorrect');
  }
  user.passwordHash = await authService.hashPassword(req.body.newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await audit.record({ req, action: A.PASSWORD_CHANGED, resourceType: 'User', resourceId: user._id });
  return ok(res, {}, 'Password changed. Existing tokens are invalidated; please log in again.');
});
