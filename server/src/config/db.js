const mongoose = require('mongoose');
const os = require('os');
const { config } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    runtimeAdapters: { os }
  });
}
async function disconnectDB() { await mongoose.disconnect(); }

/** Returns 'connected' | 'disconnected' without leaking connection details. */
async function dbStatus() {
  if (mongoose.connection.readyState !== 1) return 'disconnected';
  try { await mongoose.connection.db.admin().ping(); return 'connected'; } catch { return 'disconnected'; }
}
module.exports = { connectDB, disconnectDB, dbStatus };
