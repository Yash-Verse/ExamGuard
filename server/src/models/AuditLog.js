const mongoose = require('mongoose');

// Application audit record. NOT the hash-chained custody ledger (that is Module 2).
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
  requestId: { type: String, default: null },
  outcome: { type: String, enum: ['success', 'failure'], required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { versionKey: false });

auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.set('toJSON', {
  transform: (_d, ret) => { ret.id = ret._id.toString(); delete ret._id; return ret; },
});
module.exports = mongoose.model('AuditLog', auditLogSchema);
