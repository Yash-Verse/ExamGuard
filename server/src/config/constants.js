const ROLES = Object.freeze({ ADMIN: 'Admin', CUSTODIAN: 'Custodian', INVESTIGATOR: 'Investigator' });
const EXAM_STATUS = Object.freeze({
  DRAFT: 'Draft', SCHEDULED: 'Scheduled', IN_PROGRESS: 'InProgress', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
});
// Allowed status transitions (Completed and Cancelled are terminal)
const EXAM_TRANSITIONS = Object.freeze({
  Draft: ['Scheduled', 'Cancelled'],
  Scheduled: ['Draft', 'InProgress', 'Cancelled'],
  InProgress: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
});
const AUDIT_ACTIONS = Object.freeze({
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password.changed',
  PASSWORD_CHANGE_FAILED: 'auth.password.change_failed',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_ROLE_CHANGED: 'user.role.changed',
  USER_ACTIVATED: 'user.activated',
  USER_DEACTIVATED: 'user.deactivated',
  EXAM_CREATED: 'examination.created',
  EXAM_UPDATED: 'examination.updated',
  EXAM_STATUS_CHANGED: 'examination.status.changed',
});
const MAX_PAGE_SIZE = 100;
module.exports = { ROLES, EXAM_STATUS, EXAM_TRANSITIONS, AUDIT_ACTIONS, MAX_PAGE_SIZE };
