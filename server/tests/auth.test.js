const h = require('./helpers');
const jwt = require('jsonwebtoken');

beforeAll(h.setup); beforeEach(h.clean); afterAll(h.close);

describe('login', () => {
  test('succeeds and returns JWT with id and role, no password hash', async () => {
    const u = await h.makeUser('Admin');
    const res = await h.api().post('/api/auth/login').send({ email: u.email, password: h.PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const payload = jwt.verify(res.body.data.token, h.config.jwtSecret);
    expect(payload.sub).toBe(u.id); expect(payload.role).toBe('Admin');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
  test('wrong password and unknown email give identical 401 responses', async () => {
    const u = await h.makeUser();
    const a = await h.api().post('/api/auth/login').send({ email: u.email, password: 'WrongPassword123' });
    const b = await h.api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'WrongPassword123' });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });
  test('inactive account is rejected with 403 (only with correct password)', async () => {
    const u = await h.makeUser('Custodian', { isActive: false });
    const res = await h.api().post('/api/auth/login').send({ email: u.email, password: h.PASSWORD });
    expect(res.status).toBe(403);
    const wrong = await h.api().post('/api/auth/login').send({ email: u.email, password: 'WrongPassword123' });
    expect(wrong.status).toBe(401);
  });
  test('invalid payloads give 422; NoSQL-injection objects are rejected', async () => {
    expect((await h.api().post('/api/auth/login').send({ email: 'bad', password: 'x' })).status).toBe(422);
    expect((await h.api().post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } })).status).toBe(422);
    expect((await h.api().post('/api/auth/login').send({ email: 'a@b.com', password: 'x', role: 'Admin' })).status).toBe(422);
  });
  test('malformed JSON gives 400', async () => {
    const res = await h.api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('JWT handling', () => {
  test('missing, malformed, invalid and expired tokens return 401', async () => {
    const u = await h.makeUser();
    expect((await h.api().get('/api/auth/me')).status).toBe(401);
    expect((await h.api().get('/api/auth/me').set('Authorization', 'Token abc')).status).toBe(401);
    expect((await h.api().get('/api/auth/me').set('Authorization', 'Bearer not.a.jwt')).status).toBe(401);
    const forged = jwt.sign({ sub: u.id, role: 'Admin' }, 'some-other-secret-some-other-secret-1234');
    expect((await h.api().get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
    const expired = jwt.sign({ sub: u.id, role: u.role }, h.config.jwtSecret, { expiresIn: -10 });
    const res = await h.api().get('/api/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401); expect(res.body.message).toMatch(/expired/i);
  });
  test('alg=none token is rejected', async () => {
    const u = await h.makeUser('Admin');
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: u.id, role: 'Admin' })}.`;
    expect((await h.api().get('/api/auth/me').set('Authorization', `Bearer ${t}`)).status).toBe(401);
  });
  test('token of a disabled or deleted user is rejected', async () => {
    const u = await h.makeUser(); const t = h.auth(u);
    await h.User.updateOne({ _id: u._id }, { isActive: false });
    expect((await h.api().get('/api/auth/me').set(t)).status).toBe(401);
    await h.User.deleteOne({ _id: u._id });
    expect((await h.api().get('/api/auth/me').set(t)).status).toBe(401);
  });
  test('GET /me returns the user without hash', async () => {
    const u = await h.makeUser('Investigator');
    const res = await h.api().get('/api/auth/me').set(h.auth(u));
    expect(res.status).toBe(200); expect(res.body.data.user.email).toBe(u.email);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });
});

describe('password change & logout', () => {
  test('change-password works, invalidates old tokens, and old password stops working', async () => {
    const u = await h.makeUser();
    const old = jwt.sign({ sub: u.id, role: u.role, iat: Math.floor(Date.now() / 1000) - 60 }, h.config.jwtSecret, { expiresIn: '1h' });
    const res = await h.api().post('/api/auth/change-password').set(h.auth(u)).send({ currentPassword: h.PASSWORD, newPassword: 'NewStrongPass42xyz' });
    expect(res.status).toBe(200);
    expect((await h.api().get('/api/auth/me').set('Authorization', `Bearer ${old}`)).status).toBe(401);
    expect((await h.api().post('/api/auth/login').send({ email: u.email, password: h.PASSWORD })).status).toBe(401);
    expect((await h.api().post('/api/auth/login').send({ email: u.email, password: 'NewStrongPass42xyz' })).status).toBe(200);
  });
  test('wrong current password and weak new password are rejected', async () => {
    const u = await h.makeUser();
    expect((await h.api().post('/api/auth/change-password').set(h.auth(u)).send({ currentPassword: 'nope', newPassword: 'NewStrongPass42xyz' })).status).toBe(401);
    expect((await h.api().post('/api/auth/change-password').set(h.auth(u)).send({ currentPassword: h.PASSWORD, newPassword: 'short' })).status).toBe(422);
  });
  test('logout requires auth and is documented as client-side', async () => {
    expect((await h.api().post('/api/auth/logout')).status).toBe(401);
    const u = await h.makeUser();
    const res = await h.api().post('/api/auth/logout').set(h.auth(u));
    expect(res.status).toBe(200); expect(res.body.message).toMatch(/not revoked/i);
  });
});
