const router = require('express').Router();
const c = require('../controllers/userController');
const v = require('../validators/userValidators');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { ROLES } = require('../config/constants');

router.use(authenticate, authorizeRoles(ROLES.ADMIN));
router.post('/', v.create, c.create);
router.get('/', v.list, c.list);
router.get('/:id', v.getOne, c.getOne);
router.patch('/:id', v.update, c.update);
router.patch('/:id/status', v.setStatus, c.setStatus);
router.patch('/:id/role', v.setRole, c.setRole);
module.exports = router;
