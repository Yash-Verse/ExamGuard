const { body } = require('express-validator');
const { validate, allowOnlyFields } = require('../middleware/validateRequest');

const strongPassword = (field) => body(field).isString().withMessage('Password must be a string')
  .isLength({ min: 12, max: 128 }).withMessage('Password must be 12-128 characters')
  .matches(/[a-z]/).withMessage('Password needs a lowercase letter')
  .matches(/[A-Z]/).withMessage('Password needs an uppercase letter')
  .matches(/[0-9]/).withMessage('Password needs a digit');

const login = [
  allowOnlyFields(['email', 'password']),
  body('email').isString().trim().isEmail().withMessage('A valid email is required').isLength({ max: 254 }),
  body('password').isString().withMessage('Password is required').isLength({ min: 1, max: 128 }),
  validate,
];
const changePassword = [
  allowOnlyFields(['currentPassword', 'newPassword']),
  body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
  strongPassword('newPassword'),
  body('newPassword').custom((v, { req }) => v !== req.body.currentPassword).withMessage('New password must differ from current password'),
  validate,
];
module.exports = { login, changePassword, strongPassword };
