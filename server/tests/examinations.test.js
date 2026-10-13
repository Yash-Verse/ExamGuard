const h = require('./helpers');
beforeAll(h.setup); beforeEach(h.clean); afterAll(h.close);

describe('examination management', () => {
  test('Admin creates (as Draft), code normalised, audit written; others get 403', async () => {
    const admin = await h.makeUser('Admin');
    const res = await h.api().post('/api/examinations').set(h.auth(admin)).send(h.examPayload({ examinationCode: 'cs-101_a' }));
    expect(res.status).toBe(201);
    expect(res.body.data.examination).toMatchObject({ examinationCode: 'CS-101_A', status: 'Draft', createdBy: admin.id });
    expect(await h.AuditLog.countDocuments({ action: 'examination.created' })).toBe(1);
    for (const role of ['Custodian', 'Investigator']) {
      const u = await h.makeUser(role);
      expect((await h.api().post('/api/examinations').set(h.auth(u)).send(h.examPayload())).status).toBe(403);
    }
    expect((await h.api().post('/api/examinations').send(h.examPayload())).status).toBe(401);
  });
  test('duplicate code -> 409; invalid payloads -> 422', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    const p = h.examPayload({ examinationCode: 'DUP-1' });
    expect((await h.api().post('/api/examinations').set(t).send(p)).status).toBe(201);
    expect((await h.api().post('/api/examinations').set(t).send({ ...p, examinationCode: 'dup-1' })).status).toBe(409);
    for (const bad of [
      { title: 'x' }, { examinationCode: 'bad code!' }, { scheduledDateTime: 'tomorrow' },
      { scheduledDateTime: new Date(Date.now() - 86400000).toISOString() }, { status: 'Completed' }, { createdBy: admin.id },
      { assignedCustodians: ['nope'] },
    ]) expect((await h.api().post('/api/examinations').set(t).send(h.examPayload(bad))).status).toBe(422);
  });
  test('assigned custodians must be active Custodian users', async () => {
    const admin = await h.makeUser('Admin'); const inv = await h.makeUser('Investigator'); const c = await h.makeUser('Custodian');
    expect((await h.api().post('/api/examinations').set(h.auth(admin)).send(h.examPayload({ assignedCustodians: [inv.id] }))).status).toBe(422);
    expect((await h.api().post('/api/examinations').set(h.auth(admin)).send(h.examPayload({ assignedCustodians: [c.id] }))).status).toBe(201);
  });
  test('update works, blocks status/unknown fields, audited; terminal exams are not editable', async () => {
    const admin = await h.makeUser('Admin'); const t = h.auth(admin);
    const { body } = await h.api().post('/api/examinations').set(t).send(h.examPayload());
    const id = body.data.examination.id;
    const r = await h.api().patch(`/api/examinations/${id}`).set(t).send({ title: 'Renamed Exam', description: 'Updated' });
    expect(r.status).toBe(200); expect(r.body.data.examination.title).toBe('Renamed Exam');
    expect((await h.api().patch(`/api/examinations/${id}`).set(t).send({ status: 'Completed' })).status).toBe(422);
    expect((await h.api().patch(`/api/examinations/${id}`).set(t).send({})).status).toBe(422);
    expect(await h.AuditLog.countDocuments({ action: 'examination.updated' })).toBe(1);
    await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Cancelled' });
    expect((await h.api().patch(`/api/examinations/${id}`).set(t).send({ title: 'Too late edit' })).status).toBe(409);
  });
  test('status transitions are enforced and audited; only Admin may change', async () => {
    const admin = await h.makeUser('Admin'); const c = await h.makeUser('Custodian'); const t = h.auth(admin);
    const { body } = await h.api().post('/api/examinations').set(t).send(h.examPayload());
    const id = body.data.examination.id;
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Completed' })).status).toBe(409);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Bogus' })).status).toBe(422);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(h.auth(c)).send({ status: 'Scheduled' })).status).toBe(403);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Scheduled' })).status).toBe(200);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'InProgress' })).status).toBe(200);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Completed' })).status).toBe(200);
    expect((await h.api().patch(`/api/examinations/${id}/status`).set(t).send({ status: 'Scheduled' })).status).toBe(409);
    const log = await h.AuditLog.findOne({ action: 'examination.status.changed' }).sort({ timestamp: 1 });
    expect(log.metadata).toMatchObject({ from: 'Draft', to: 'Scheduled' });
  });
});

describe('role-scoped reads', () => {
  async function seed() {
    const admin = await h.makeUser('Admin'); const c1 = await h.makeUser('Custodian'); const c2 = await h.makeUser('Custodian'); const inv = await h.makeUser('Investigator');
    const t = h.auth(admin);
    const mk = async (extra, status) => {
      const r = await h.api().post('/api/examinations').set(t).send(h.examPayload(extra));
      if (status) await h.api().patch(`/api/examinations/${r.body.data.examination.id}/status`).set(t).send({ status });
      return r.body.data.examination.id;
    };
    const draft = await mk({ assignedCustodians: [c1.id] });
    const mine = await mk({ assignedCustodians: [c1.id] }, 'Scheduled');
    const other = await mk({ assignedCustodians: [c2.id] }, 'Scheduled');
    return { admin, c1, c2, inv, draft, mine, other };
  }
  test('Admin sees all; Investigator sees non-draft; Custodian sees only assigned non-draft', async () => {
    const s = await seed();
    const count = async (u) => (await h.api().get('/api/examinations').set(h.auth(u))).body.data.pagination.total;
    expect(await count(s.admin)).toBe(3); expect(await count(s.inv)).toBe(2); expect(await count(s.c1)).toBe(1); expect(await count(s.c2)).toBe(1);
    const filtered = await h.api().get('/api/examinations?status=Draft').set(h.auth(s.c1));
    expect(filtered.body.data.pagination.total).toBe(0);
  });
  test('detail access follows the same scope (404 for out-of-scope)', async () => {
    const s = await seed();
    expect((await h.api().get(`/api/examinations/${s.mine}`).set(h.auth(s.c1))).status).toBe(200);
    expect((await h.api().get(`/api/examinations/${s.other}`).set(h.auth(s.c1))).status).toBe(404);
    expect((await h.api().get(`/api/examinations/${s.draft}`).set(h.auth(s.c1))).status).toBe(404);
    expect((await h.api().get(`/api/examinations/${s.draft}`).set(h.auth(s.inv))).status).toBe(404);
    expect((await h.api().get(`/api/examinations/${s.draft}`).set(h.auth(s.admin))).status).toBe(200);
    expect((await h.api().get(`/api/examinations/${s.mine}`)).status).toBe(401);
  });
});
