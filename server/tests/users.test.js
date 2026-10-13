const h = require('./helpers');
beforeAll(h.setup); beforeEach(h.clean); afterAll(h.close);

const newUser = (o = {}) => ({ name: 'New Person', email: `new${Math.random().toString(36).slice(2)}@example.com`, password: 'StrongPassw0rdXYZ', role: 'Custodian', ...o });

describe('RBAC on user management', () => {
  test('unauthenticated -> 401; Custodian and Investigator -> 403 on every admin endpoint', async () => {
    const admin = await h.makeUser('Admin'); const target = await h.makeUser('Custodian');
    expect((await h.api().get('/api/users')).status).toBe(401);
    for (const role of ['Custodian', 'Investigator']) {
      const u = await h.makeUser(role); const t = h.auth(u);
      expect((await h.api().get('/api/users').set(t)).status).toBe(403);
      expect((await h.api().post('/api/users').set(t).send(newUser())).status).toBe(403);
      expect((await h.api().get(`/api/users/${target.id}`).set(t)).status).toBe(403);
      expect((await h.api().patch(`/api/users/${target.id}/role`).set(t).send({ role: 'Admin' })).status).toBe(403);
      expect((await h.api().patch(`/api/users/${u.id}/role`).set(t).send({ role: 'Admin' })).status).toBe(403);
      expect((await h.api().patch(`/api/users/${target.id}/status`).set(t).send({ isActive: false })).status).toBe(403);
      expect((await h.api().get('/api/audit-logs').set(t)).status).toBe(403);
    }
    expect(admin).toBeTruthy();
  });
});

describe('admin user CRUD', () => {
  test('creates user, hashes password, never returns hash, writes audit event', async () => {
    const admin = await h.makeUser('Admin');
    const body = newUser({ email: 'Mixed.Case@Example.com' });
    const res = await h.api().post('/api/users').set(h.auth(admin)).send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('mixed.case@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$|StrongPassw0rd/);
    const stored = await h.User.findOne({ email: 'mixed.case@example.com' }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/); expect(stored.passwordHash).not.toContain(body.password);
    const log = await h.AuditLog.findOne({ action: 'user.created' });
    expect(log).toBeTruthy(); expect(String(log.actor)).toBe(admin.id); expect(log.requestId).toBeTruthy();
    expect(JSON.stringify(log.toJSON())).not.toContain(body.password);
  });
  test('invalid role, privileged self-assignment fields, weak password and unknown fields are rejected', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    expect((await h.api().post('/api/users').set(t).send(newUser({ role: 'SuperAdmin' }))).status).toBe(422);
    expect((await h.api().post('/api/users').set(t).send(newUser({ password: 'weak' }))).status).toBe(422);
    expect((await h.api().post('/api/users').set(t).send(newUser({ isActive: false }))).status).toBe(422);
    expect((await h.api().post('/api/users').set(t).send(newUser({ name: 'A' }))).status).toBe(422);
    expect((await h.api().post('/api/users').set(t).send({})).status).toBe(422);
  });
  test('duplicate email -> 409 (case-insensitive)', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    expect((await h.api().post('/api/users').set(t).send(newUser({ email: 'dup@example.com' }))).status).toBe(201);
    expect((await h.api().post('/api/users').set(t).send(newUser({ email: 'DUP@example.com' }))).status).toBe(409);
  });
  test('list supports pagination limit cap and role filter', async () => {
    const admin = await h.makeUser('Admin');
    for (let i = 0; i < 3; i++) await h.makeUser('Custodian');
    await h.makeUser('Investigator');
    const r = await h.api().get('/api/users?role=Custodian&limit=2').set(h.auth(admin));
    expect(r.status).toBe(200); expect(r.body.data.users).toHaveLength(2);
    expect(r.body.data.pagination).toMatchObject({ total: 3, totalPages: 2, limit: 2 });
    expect((await h.api().get('/api/users?role=Nope').set(h.auth(admin))).status).toBe(422);
    expect((await h.api().get('/api/users?limit=1000').set(h.auth(admin))).status).toBe(422);
  });
  test('get one, 404 and invalid id', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    expect((await h.api().get(`/api/users/${admin.id}`).set(t)).status).toBe(200);
    expect((await h.api().get('/api/users/64b0f0f0f0f0f0f0f0f0f0f0').set(t)).status).toBe(404);
    expect((await h.api().get('/api/users/not-an-id').set(t)).status).toBe(422);
  });
  test('PATCH only allows name/email (no mass assignment)', async () => {
    const admin = await h.makeUser('Admin'); const u = await h.makeUser('Custodian'); const t = h.auth(admin);
    expect((await h.api().patch(`/api/users/${u.id}`).set(t).send({ role: 'Admin' })).status).toBe(422);
    expect((await h.api().patch(`/api/users/${u.id}`).set(t).send({ passwordHash: 'x' })).status).toBe(422);
    const ok = await h.api().patch(`/api/users/${u.id}`).set(t).send({ name: 'Renamed User' });
    expect(ok.status).toBe(200); expect(ok.body.data.user.name).toBe('Renamed User');
    expect((await h.User.findById(u.id)).role).toBe('Custodian');
  });
  test('status and role changes work and are audited', async () => {
    const admin = await h.makeUser('Admin'); const u = await h.makeUser('Custodian'); const t = h.auth(admin);
    expect((await h.api().patch(`/api/users/${u.id}/status`).set(t).send({ isActive: false })).status).toBe(200);
    expect((await h.api().patch(`/api/users/${u.id}/status`).set(t).send({ isActive: 'no' })).status).toBe(422);
    expect((await h.api().patch(`/api/users/${u.id}/status`).set(t).send({ isActive: true })).status).toBe(200);
    expect((await h.api().patch(`/api/users/${u.id}/role`).set(t).send({ role: 'Investigator' })).status).toBe(200);
    expect((await h.api().patch(`/api/users/${u.id}/role`).set(t).send({ role: 'Root' })).status).toBe(422);
    for (const a of ['user.deactivated', 'user.activated', 'user.role.changed']) expect(await h.AuditLog.countDocuments({ action: a })).toBe(1);
    const roleLog = await h.AuditLog.findOne({ action: 'user.role.changed' });
    expect(roleLog.metadata).toMatchObject({ from: 'Custodian', to: 'Investigator' });
  });
  test('disabled user cannot use an existing token', async () => {
    const admin = await h.makeUser('Admin'); const u = await h.makeUser('Custodian');
    await h.api().patch(`/api/users/${u.id}/status`).set(h.auth(admin)).send({ isActive: false });
    expect((await h.api().get('/api/auth/me').set(h.auth(u))).status).toBe(401);
  });
});

describe('last active Admin safeguard', () => {
  test('cannot disable or demote the only active Admin', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    expect((await h.api().patch(`/api/users/${admin.id}/status`).set(t).send({ isActive: false })).status).toBe(409);
    expect((await h.api().patch(`/api/users/${admin.id}/role`).set(t).send({ role: 'Custodian' })).status).toBe(409);
    const fresh = await h.User.findById(admin.id);
    expect(fresh.isActive).toBe(true); expect(fresh.role).toBe('Admin');
  });
  test('an inactive second Admin does not count; with two active Admins demotion is allowed', async () => {
    const a1 = await h.makeUser('Admin'); await h.makeUser('Admin', { isActive: false });
    expect((await h.api().patch(`/api/users/${a1.id}/role`).set(h.auth(a1)).send({ role: 'Investigator' })).status).toBe(409);
    const a3 = await h.makeUser('Admin');
    expect((await h.api().patch(`/api/users/${a3.id}/role`).set(h.auth(a1)).send({ role: 'Investigator' })).status).toBe(200);
  });
  test('concurrent mutual demotion never leaves zero active Admins', async () => {
    const a1 = await h.makeUser('Admin'); const a2 = await h.makeUser('Admin');
    await Promise.all([
      h.api().patch(`/api/users/${a2.id}/role`).set(h.auth(a1)).send({ role: 'Custodian' }),
      h.api().patch(`/api/users/${a1.id}/role`).set(h.auth(a2)).send({ role: 'Custodian' }),
    ]);
    expect(await h.User.countDocuments({ role: 'Admin', isActive: true })).toBeGreaterThanOrEqual(1);
  });
});

describe('placeholder module routes', () => {
  test('return 501 for permitted roles and 403 otherwise', async () => {
    const c = await h.makeUser('Custodian'); const i = await h.makeUser('Investigator');
    expect((await h.api().get('/api/custody/anything').set(h.auth(c))).status).toBe(501);
    expect((await h.api().get('/api/custody/anything').set(h.auth(i))).status).toBe(403);
    expect((await h.api().get('/api/investigations/anything').set(h.auth(i))).status).toBe(501);
    expect((await h.api().get('/api/investigations/anything').set(h.auth(c))).status).toBe(403);
    expect((await h.api().get('/api/investigations/anything')).status).toBe(401);
  });
});
