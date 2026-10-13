const { body, param, query } = require('express-validator');
const { validate, allowOnlyFields } = require('../middleware/validateRequest');
const { EXAM_STATUS } = require('../config/constants');

const statuses = Object.values(EXAM_STATUS);
const id = param('id').isMongoId().withMessage('Invalid examination id');
const future = (v) => new Date(v).getTime() > Date.now();
const fields = (opt) => {
  const o = (c) => (opt ? c.optional() : c);
  return [
    o(body('title')).isString().trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    o(body('examinationCode')).isString().trim().toUpperCase().matches(/^[A-Z0-9][A-Z0-9_-]{2,31}$/).withMessage('Code must be 3-32 chars: A-Z, 0-9, _ or -'),
    body('description').optional().isString().trim().isLength({ max: 2000 }),
    o(body('scheduledDateTime')).isISO8601({ strict: true }).withMessage('scheduledDateTime must be an ISO 8601 date').bail().custom(future).withMessage('scheduledDateTime must be in the future'),
    body('assignedCustodians').optional().isArray({ max: 200 }),
    body('assignedCustodians.*').isMongoId().withMessage('Invalid custodian id'),
  ];
};
const ALLOWED = ['title', 'examinationCode', 'description', 'scheduledDateTime', 'assignedCustodians'];
const create = [allowOnlyFields(ALLOWED), ...fields(false), validate];
const update = [id, allowOnlyFields(ALLOWED), ...fields(true),
  body().custom((_v, { req }) => Object.keys(req.body).length > 0).withMessage('Provide at least one field'), validate];
const setStatus = [id, allowOnlyFields(['status']), body('status').isString().isIn(statuses).withMessage(`Status must be one of: ${statuses.join(', ')}`), validate];
const list = [query('status').optional().isIn(statuses), query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 }), validate];
const getOne = [id, validate];
module.exports = { create, update, setStatus, list, getOne };
