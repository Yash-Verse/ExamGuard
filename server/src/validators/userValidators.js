const { body, param, query } = require('express-validator');
const { validate, allowOnlyFields } = require('../middleware/validateRequest');
const { ROLES } = require('../config/constants');
const { strongPassword } = require('./authValidators');

const roles = Object.values(ROLES);
const name = (opt) => { const c = body('name'); return (opt ? c.optional() : c).isString().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'); };
const email = (opt) => { const c = body('email'); return (opt ? c.optional() : c).isString().trim().isEmail().withMessage('A valid email is required').isLength({ max: 254 }).toLowerCase(); };
const id = param('id').isMongoId().withMessage('Invalid user id');

const create = [
  allowOnlyFields(['name', 'email', 'password', 'role']),
  name(), email(), strongPassword('password'),
  body('role').isString().isIn(roles).withMessage(`Role must be one of: ${roles.join(', ')}`),
  validate,
];
const list = [
  query('role').optional().isIn(roles).withMessage(`Role must be one of: ${roles.join(', ')}`),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
];
const getOne = [id, validate];
const update = [id, allowOnlyFields(['name', 'email']), name(true), email(true),
  body().custom((_v, { req }) => Object.keys(req.body).length > 0).withMessage('Provide at least one field'), validate];
const setStatus = [id, allowOnlyFields(['isActive']), body('isActive').isBoolean({ strict: true }).withMessage('isActive must be a boolean'), validate];
const setRole = [id, allowOnlyFields(['role']), body('role').isString().isIn(roles).withMessage(`Role must be one of: ${roles.join(', ')}`), validate];
module.exports = { create, list, getOne, update, setStatus, setRole };
