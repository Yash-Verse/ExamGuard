const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { validateConfig, config } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Examination = require('../src/models/Examination');
const AuditLog = require('../src/models/AuditLog');
const authService = require('../src/services/authService');

const PASSWORD = 'CorrectHorse9Battery';
let app;

async function setup() {
  validateConfig();
  if (mongoose.connection.readyState !== 1) await connectDB();
  app = createApp();
  return app;
}
const api = () => request(app);
async function clean() { await Promise.all([User.deleteMany({}), Examination.deleteMany({}), AuditLog.deleteMany({})]); }
let n = 0;
async function makeUser(role = 'Custodian', extra = {}) {
  n += 1;
  const user = await User.create({ name: `Test ${role} ${n}`, email: `${role.toLowerCase()}${n}@example.com`, role, passwordHash: await authService.hashPassword(PASSWORD), ...extra });
  return user;
}
const tokenFor = (user) => authService.signToken(user);
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
const futureDate = (days = 7) => new Date(Date.now() + days * 86400000).toISOString();
const examPayload = (o = {}) => ({ title: 'Mathematics Final', examinationCode: `MATH${++n}`, scheduledDateTime: futureDate(), ...o });
async function close() { await mongoose.disconnect(); }
module.exports = { setup, api, clean, makeUser, tokenFor, auth, futureDate, examPayload, close, PASSWORD, config, jwt, User, Examination, AuditLog };
