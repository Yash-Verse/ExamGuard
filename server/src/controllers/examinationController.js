const Examination = require('../models/Examination');
const svc = require('../services/examinationService');
const audit = require('../services/auditService');
const { ok, created, AppError, asyncHandler } = require('../utils/apiResponse');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { AUDIT_ACTIONS: A, EXAM_STATUS } = require('../config/constants');

const EDITABLE = ['title', 'examinationCode', 'description', 'scheduledDateTime', 'assignedCustodians'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body, EDITABLE);
  await svc.assertValidCustodians(data.assignedCustodians);
  const exam = await Examination.create({ ...data, status: EXAM_STATUS.DRAFT, createdBy: req.user._id });
  await audit.record({ req, action: A.EXAM_CREATED, resourceType: 'Examination', resourceId: exam._id, metadata: { examinationCode: exam.examinationCode } });
  return created(res, { examination: exam.toJSON() }, 'Examination created successfully');
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { ...svc.scopeFor(req.user) };
  if (req.query.status) {
    // keep role scope: custodians/investigators asking for Draft simply get nothing
    filter.status = filter.status ? { $eq: req.query.status, ...filter.status } : req.query.status;
  }
  const [items, total] = await Promise.all([
    Examination.find(filter).sort({ scheduledDateTime: 1 }).skip(skip).limit(limit), Examination.countDocuments(filter)]);
  return ok(res, { examinations: items.map((e) => e.toJSON()), pagination: pageMeta(page, limit, total) });
});

exports.getOne = asyncHandler(async (req, res) => {
  // Out-of-scope records return 404 so their existence is not disclosed
  const exam = await Examination.findOne({ _id: req.params.id, ...svc.scopeFor(req.user) });
  if (!exam) throw new AppError(404, 'Examination not found');
  return ok(res, { examination: exam.toJSON() });
});

exports.update = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) throw new AppError(404, 'Examination not found');
  if ([EXAM_STATUS.COMPLETED, EXAM_STATUS.CANCELLED].includes(exam.status)) throw new AppError(409, `A ${exam.status} examination cannot be edited`);
  const changes = pick(req.body, EDITABLE);
  await svc.assertValidCustodians(changes.assignedCustodians);
  exam.set(changes);
  await exam.save();
  await audit.record({ req, action: A.EXAM_UPDATED, resourceType: 'Examination', resourceId: exam._id, metadata: { fields: Object.keys(changes).join(',') } });
  return ok(res, { examination: exam.toJSON() }, 'Examination updated successfully');
});

exports.setStatus = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) throw new AppError(404, 'Examination not found');
  const from = exam.status; const to = req.body.status;
  if (!svc.canTransition(from, to)) throw new AppError(409, `Invalid status transition: ${from} -> ${to}`);
  // Conditional update so two concurrent transitions cannot both succeed
  const result = await Examination.updateOne({ _id: exam._id, status: from }, { $set: { status: to } });
  if (result.matchedCount !== 1) throw new AppError(409, 'Examination was modified concurrently; please retry');
  const updated = await Examination.findById(exam._id);
  await audit.record({ req, action: A.EXAM_STATUS_CHANGED, resourceType: 'Examination', resourceId: exam._id, metadata: { from, to } });
  return ok(res, { examination: updated.toJSON() }, 'Examination status updated successfully');
});
