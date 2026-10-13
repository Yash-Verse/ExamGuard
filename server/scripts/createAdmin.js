// Creates the FIRST Admin only. Refuses to run if any Admin already exists.
// Usage: set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env (or inline), run `npm run create-admin`, then remove the password from .env.
const { validateConfig } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const authService = require('../src/services/authService');
const audit = require('../src/services/auditService');
const { ROLES, AUDIT_ACTIONS } = require('../src/config/constants');

(async () => {
  try {
    validateConfig();
    const { ADMIN_NAME: name, ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
    if (!name || !email || !password) throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD');
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      throw new Error('Password must be 12+ chars with upper, lower and digit');
    }
    await connectDB();
    if (await User.exists({ role: ROLES.ADMIN })) throw new Error('An Admin already exists. Use the API to create more users.');
    const user = await User.create({ name, email, role: ROLES.ADMIN, passwordHash: await authService.hashPassword(password) });
    await audit.record({ actor: null, action: AUDIT_ACTIONS.USER_CREATED, resourceType: 'User', resourceId: user._id, metadata: { role: ROLES.ADMIN, via: 'bootstrap-script' } });
    console.log(`Initial Admin created: ${user.email}`);
    process.exitCode = 0;
  } catch (e) {
    console.error(`Failed: ${e.message}`);
    process.exitCode = 1;
  } finally { await disconnectDB(); }
})();
