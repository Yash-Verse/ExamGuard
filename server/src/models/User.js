const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: Object.values(ROLES) },
  isActive: { type: Boolean, default: true },
  passwordChangedAt: { type: Date, default: null }, // tokens issued before this are rejected
}, { timestamps: true });

userSchema.index({ role: 1, isActive: 1 });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id; delete ret.__v; delete ret.passwordHash; delete ret.passwordChangedAt;
    return ret;
  },
});
module.exports = mongoose.model('User', userSchema);
