// Honest placeholders: these routes exist only to fix the RBAC contract for later modules.
const router = require('express').Router();
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { fail } = require('../utils/apiResponse');
const { ROLES } = require('../config/constants');

const notImplemented = (module) => (_req, res) =>
  fail(res, 501, `Not implemented: planned for ${module}`);

router.use('/custody', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.CUSTODIAN), notImplemented('Module 2 (custody ledger)'));
router.use('/investigations', authenticate, authorizeRoles(ROLES.ADMIN, ROLES.INVESTIGATOR), notImplemented('Modules 3-4 (forensics and detection)'));
module.exports = router;
