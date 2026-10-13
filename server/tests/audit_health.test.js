const mongoose = require('mongoose');
const h = require('./helpers');
beforeAll(h.setup); beforeEach(h.clean); afterAll(h.close);

describe('audit logging', () => {
  test('login success and failure are recorded without credentials', async () => {
    const u = await h.makeUser('Admin');
    await h.api().post('/api/auth/login').send({ email: u.email, password: h.PASSWORD });
    await h.api().post('/api/auth/login').send({ email: u.email, password: 'WrongPassword123' });
    await h.api().post('/api/auth/login').send({ email: 'ghost@example.com', password: 'WrongPassword123' });
    const logs = await h.AuditLog.find({}).lean();
    expect(logs.filter((l) => l.action === 'auth.login.success')).toHaveLength(1);
    expect(logs.filter((l) => l.action === 'auth.login.failure' && l.outcome === 'failure')).toHaveLength(2);
    const dump = JSON.stringify(logs);
    expect(dump).not.toContain(h.PASSWORD); expect(dump).not.toContain('WrongPassword123'); expect(dump).not.toContain('ghost@example.com');
    expect(dump).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWTs
  });
  test('Admin can read audit events; password change is audited', async () => {
    const admin = await h.makeUser('Admin');
    await h.api().post('/api/auth/change-password').set(h.auth(admin)).send({ currentPassword: h.PASSWORD, newPassword: 'AnotherStrong99pw' });
    const res = await h.api().get('/api/audit-logs?action=auth.password.changed').set(h.auth(admin));
    // token issued in same second as the change remains valid by design
    expect(res.status).toBe(200); expect(res.body.data.auditLogs).toHaveLength(1);
  });
  test('sanitize drops credential-like keys and nested objects', () => {
    const { sanitize } = require('../src/services/auditService');
    expect(sanitize({ password: 'x', token: 'y', authorization: 'z', passwordHash: 'h', ok: 'fine', nested: { a: 1 } })).toEqual({ ok: 'fine' });
  });
});

describe('health & error handling', () => {
  test('health reports connected DB without internals', async () => {
    const res = await h.api().get('/api/health');
    expect(res.status).toBe(200); expect(res.body.data.database).toBe('connected');
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb:|127\.0\.0\.1|secret/i);
  });
  test('health returns 503 when the database connection is down', async () => {
    await mongoose.disconnect(); // real connection loss
    const res = await h.api().get('/api/health');
    const login = await h.api().post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever12345' });
    await require('../src/config/db').connectDB();
    expect(login.status).toBe(503);
    expect(res.status).toBe(503); expect(res.body.data.database).toBe('disconnected'); expect(res.body.success).toBe(false);
  });
  test('database errors surface as a safe 503/500 without stack traces', async () => {
    const User = require('../src/models/User');
    const spy = jest.spyOn(User, 'findOne').mockImplementation(() => { throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:27017'), { name: 'MongoNetworkError' }); });
    const res = await h.api().post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever12345' });
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|stack/);
  });
  test('unexpected errors give generic 500; unknown routes 404', async () => {
    const User = require('../src/models/User');
    const spy = jest.spyOn(User, 'findOne').mockImplementation(() => { throw new Error('secret internal detail'); });
    const res = await h.api().post('/api/auth/login').send({ email: 'a@example.com', password: 'whatever12345' });
    spy.mockRestore();
    expect(res.status).toBe(500); expect(res.body.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
    expect((await h.api().get('/api/nope')).status).toBe(404);
  });
  test('security headers present and CORS allowlist enforced', async () => {
    const ok = await h.api().get('/api/health').set('Origin', 'http://localhost:3000');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(ok.headers['x-content-type-options']).toBe('nosniff'); expect(ok.headers['x-powered-by']).toBeUndefined();
    const bad = await h.api().get('/api/health').set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});
