# ExamGuard — Module 1: Core System Infrastructure & Administration

Backend foundation (Node.js + Express + MongoDB/Mongoose) for the *Secure Examination Paper Distribution and Leak Detection System*.
It provides authentication (JWT), role-based access control (Admin / Custodian / Investigator), user and examination management, an application audit log, and a health check.

**Not in this module:** encryption, Shamir key sharing, time-lock, the hash-chained custody ledger, watermarking, leak detection, anomaly detection, and the React/Flutter apps. Routes under `/api/custody/*` and `/api/investigations/*` are honest placeholders that return **501 Not Implemented**.

## 1. Prerequisites
- Node.js 18+ (developed on Node 22) and npm
- MongoDB: either local MongoDB Community Server, or a free MongoDB Atlas cluster
- Postman (optional), Git, VS Code

## 2. Install
```bash
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

## 3. Configure `.env`
| Variable | Meaning |
|---|---|
| `MONGO_URI` | e.g. `mongodb://127.0.0.1:27017/examguard` (local) or your Atlas `mongodb+srv://...` string |
| `TEST_MONGO_URI` | A **separate** DB for tests; its name must contain `test` (tests refuse to run otherwise) |
| `JWT_SECRET` | Random string, 32+ chars. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1h` |
| `BCRYPT_ROUNDS` | Work factor (default 12, minimum 10 outside tests) |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (React dev server etc.) |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_AUTH` | Rate limit for login / change-password (default 10 per 15 min per IP) |

**MongoDB local:** install MongoDB Community, start the `mongod` service, keep the default URI.
**MongoDB Atlas:** create a free cluster, add a database user, allow your IP under Network Access, copy the connection string into `MONGO_URI`.

## 4. Create the first Admin (no public registration exists)
Put `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in `.env` (password: 12+ chars with upper, lower, digit), then:
```bash
npm run create-admin
```
The script refuses to run if any Admin already exists. **Remove `ADMIN_PASSWORD` from `.env` afterwards.** All other users are created by an Admin via `POST /api/users`.

## 5. Run
```bash
npm start        # or: npm run dev   (auto-restart)
```
Check: `curl http://localhost:5000/api/health`

## 6. Tests
```bash
npm test
```
Uses Jest + Supertest against `TEST_MONGO_URI` (collections are emptied between tests, so never point it at real data). 40 tests cover login, JWT failures, RBAC, user/exam management, last-Admin safeguard, validation, duplicates, audit events, hash leakage, and DB-down handling.

## 7. Postman
Import `postman/ExamGuard-Module1.postman_collection.json`. Run **Login (admin)** first; it stores the token in the `{{token}}` variable used by the other requests.

## 8. Endpoints
| Method & path | Roles | Notes |
|---|---|---|
| `GET /api/health` | public | 200 / 503 with DB status only |
| `POST /api/auth/login` | public | rate limited; same 401 for unknown email and wrong password; 403 if disabled |
| `POST /api/auth/logout` | any authenticated | **client-side disposal**; server audits it but does **not** revoke the JWT |
| `GET /api/auth/me` | any authenticated | |
| `POST /api/auth/change-password` | any authenticated | invalidates all tokens issued before the change |
| `POST /api/users` | Admin | role must be Admin/Custodian/Investigator |
| `GET /api/users?role=&page=&limit=` | Admin | limit max 100 |
| `GET /api/users/:id` | Admin | |
| `PATCH /api/users/:id` | Admin | only `name`, `email` |
| `PATCH /api/users/:id/status` | Admin | `{ "isActive": bool }`; last active Admin protected |
| `PATCH /api/users/:id/role` | Admin | last active Admin protected |
| `POST /api/examinations` | Admin | created as `Draft` |
| `GET /api/examinations` | any authenticated | Admin: all; Investigator: all non-Draft; Custodian: only assigned non-Draft |
| `GET /api/examinations/:id` | any authenticated | same scope; out-of-scope returns 404 |
| `PATCH /api/examinations/:id` | Admin | editable fields only; Completed/Cancelled are locked |
| `PATCH /api/examinations/:id/status` | Admin | transitions: Draft→Scheduled/Cancelled; Scheduled→Draft/InProgress/Cancelled; InProgress→Completed/Cancelled |
| `GET /api/audit-logs?action=&outcome=` | Admin | application audit events |
| `/api/custody/*` | Admin, Custodian | 501 placeholder (Module 2) |
| `/api/investigations/*` | Admin, Investigator | 501 placeholder (Modules 3-4) |

Success: `{ "success": true, "message": "...", "data": {...} }`  Error: `{ "success": false, "message": "...", "errors": [{ "field": "...", "message": "..." }] }`

Example:
```bash
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourAdminPassword1"}'
# 200 -> {"success":true,"message":"Login successful","data":{"token":"<jwt>","tokenType":"Bearer","user":{...}}}
```

## 9. Design notes
- Layout: `src/{config,models,controllers,routes,middleware,services,validators,utils}`; `app.js` builds the app, `server.js` connects and listens.
- Audit events: login success/failure, logout, password change, user create/update/activate/deactivate/role change, examination create/update/status change. Metadata is whitelisted to short primitives; passwords, tokens and request bodies are never stored. Failed-login records keep only a truncated hash of the attempted email.
- Last-Admin protection: pre-check, conditional update, then post-check with rollback, so two simultaneous mutual demotions cannot leave zero active Admins.
- `assignedCustodians` on Examination is an addition beyond the listed fields; it is what makes "custodian sees assigned examinations" enforceable.
- The user model uses `bcryptjs` (pure JS) so no native build tools are needed.

## 10. Limitations (prototype, not production-ready)
- Logout does not revoke tokens (stateless JWT). Production needs short-lived access tokens plus refresh tokens/denylist.
- No account lockout, MFA, or password reset flow; rate limiting is per-IP and in-memory (use a shared store behind multiple instances).
- No transactions are used (kept portable); concurrency safety relies on conditional updates and rollback as described above.
- Audit log is an ordinary collection: it is not tamper-evident (the hash-chained ledger belongs to Module 2). Serve over HTTPS behind a reverse proxy in any real deployment, and set `trust proxy` accordingly.
- Test DB note: the author's sandbox had no `mongod`, so the suite was run against FerretDB (MongoDB-compatible). Please also run `npm test` against your real MongoDB.
