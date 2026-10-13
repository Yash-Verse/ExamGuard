const router = require('express').Router();
const c = require('../controllers/examinationController');
const v = require('../validators/examinationValidators');
const authenticate = require('../middleware/authenticate');
const authorizeRoles = require('../middleware/authorizeRoles');
const { ROLES } = require('../config/constants');

const admin = authorizeRoles(ROLES.ADMIN);
router.use(authenticate);
router.post('/', admin, v.create, c.create);
router.get('/', v.list, c.list);
router.get('/:id', v.getOne, c.getOne);
router.patch('/:id', admin, v.update, c.update);
router.patch('/:id/status', admin, v.setStatus, c.setStatus);
module.exports = router;
