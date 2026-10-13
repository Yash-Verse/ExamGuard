const mongoose = require('mongoose');
const { EXAM_STATUS } = require('../config/constants');

const examinationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
  examinationCode: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9][A-Z0-9_-]{2,31}$/ },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  scheduledDateTime: { type: Date, required: true, index: true },
  status: { type: String, enum: Object.values(EXAM_STATUS), default: EXAM_STATUS.DRAFT, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Custodians who may view this examination (used for role-scoped reads; Module 2 will build on it)
  assignedCustodians: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

examinationSchema.index({ assignedCustodians: 1, status: 1 });
examinationSchema.set('toJSON', {
  transform: (_d, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; },
});
module.exports = mongoose.model('Examination', examinationSchema);
