const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const FORBIDDEN = /pass|token|secret|authorization|jwt|hash/i;
/** Keeps only flat, short, primitive metadata and drops anything credential-like. */
function sanitize(meta = {}) {
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (FORBIDDEN.test(k)) continue;
    if (['string', 'number', 'boolean'].includes(typeof v) || v === null) out[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return out;
}
const hashEmail = (email) => crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 16);

/** Never throws: an audit failure must not break the request, but is logged. */
async function record({ req, actor, action, resourceType, resourceId = null, outcome = 'success', metadata = {} }) {
  try {
    await AuditLog.create({
      actor: actor === undefined ? (req?.user?._id ?? null) : actor,
      action, resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      requestId: req?.id ?? null,
      outcome,
      metadata: sanitize(metadata),
    });
  } catch (e) {
    logger.error('audit_write_failed', { action, name: e.name });
  }
}
module.exports = { record, hashEmail, sanitize };
