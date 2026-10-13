const router = require('express').Router();
const c = require('../controllers/auditController');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { ROLES } = require('../config/constants');
router.get('/', authenticate, authorizeRoles(ROLES.ADMIN), c.list);
module.exports = router;
