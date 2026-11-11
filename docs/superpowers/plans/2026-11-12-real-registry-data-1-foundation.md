# Real Registry Data — Plan Part 1: Platform Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent table store and server-verified sessions so paid/registry routes know who is calling.

**Architecture:** `backend/platform/` holds infrastructure: `tableStore.js` (Azure Table Storage, or a file-backed store in dev with identical ETag semantics), `session.js` (HS256 JWT), `firebaseVerify.js` (Firebase ID token check via Google's x509 certs). `backend/middleware/requireSession.js` guards routes. Frontend gets `utils/apiClient.js` which attaches `Authorization: Bearer`.

**Tech Stack:** Node 20+ (Docker uses node:20-alpine), Express 5, `@azure/data-tables`, `jsonwebtoken`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-11-real-registry-data-design.md` Part A. Parts 2 and 3 of this plan: `2026-11-12-real-registry-data-2-registry-backend.md`, `2026-11-12-real-registry-data-3-frontend.md`.

**Branch:** `feat/real-data-and-billing`. Commit only files named in each task (the working tree holds unrelated uncommitted work — never `git add -A`).

---

### Task 1: Test runner, dependencies, gitignore

**Files:**
- Modify: `backend/package.json` (scripts.test, dependencies)
- Modify: `.gitignore`
- Create: `backend/tests/smoke.test.js`

- [ ] **Step 1: Install dependencies**

Run: `npm --prefix backend install @azure/data-tables jsonwebtoken`
Expected: both appear in `backend/package.json` dependencies.

- [ ] **Step 2: Set the test script**

In `backend/package.json` replace `"test": "echo \"Error: no test specified\" && exit 1"` with:

```json
"test": "node --test --test-concurrency=1 tests/"
```

- [ ] **Step 3: Ignore the local store**

Append to `.gitignore` under "Temporary Uploads & Processing Storage":

```
backend/data/local-store/
```

- [ ] **Step 4: Add a smoke test and run it**

`backend/tests/smoke.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

Run: `npm --prefix backend test`
Expected: `# pass 1`. (`backend/tests/smoke_stress_test.js` is not matched because node --test only picks `*.test.js`.)

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json .gitignore backend/tests/smoke.test.js
git commit -m "chore(backend): node:test runner, data-tables and jsonwebtoken deps"
```

---

### Task 2: File-backed table store

**Files:**
- Create: `backend/platform/tableStore.js`
- Test: `backend/tests/tableStore.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore, ConflictError } = require('../platform/tableStore');

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablestore-'));
  return createFileTableStore(dir);
}

test('create then get returns entity with etag', async () => {
  const s = freshStore();
  await s.ensureTables(['accounts']);
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 500 });
  const e = await s.getEntity('accounts', 'acct', 'a1');
  assert.equal(e.balanceCents, 500);
  assert.ok(e.etag);
});

test('getEntity returns null when missing', async () => {
  const s = freshStore();
  assert.equal(await s.getEntity('accounts', 'acct', 'nope'), null);
});

test('createEntity twice throws ConflictError', async () => {
  const s = freshStore();
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1' });
  await assert.rejects(s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1' }), ConflictError);
});

test('updateEntity with stale etag throws ConflictError', async () => {
  const s = freshStore();
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 500 });
  const e = await s.getEntity('accounts', 'acct', 'a1');
  await s.updateEntity('accounts', { ...e, balanceCents: 450 }, e.etag);
  await assert.rejects(s.updateEntity('accounts', { ...e, balanceCents: 400 }, e.etag), ConflictError);
  assert.equal((await s.getEntity('accounts', 'acct', 'a1')).balanceCents, 450);
});

test('upsert overwrites and listEntities filters by partition in rowKey order', async () => {
  const s = freshStore();
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'b', v: 1 });
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'a', v: 2 });
  await s.upsertEntity('ledger', { partitionKey: 'p2', rowKey: 'c', v: 3 });
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'b', v: 9 });
  const rows = await s.listEntities('ledger', 'p1', { limit: 10 });
  assert.deepEqual(rows.map(r => [r.rowKey, r.v]), [['a', 2], ['b', 9]]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm --prefix backend test`
Expected: FAIL — `Cannot find module '../platform/tableStore'`.

- [ ] **Step 3: Implement**

`backend/platform/tableStore.js`:

```js
/**
 * Table storage for accounts, ledger and registry cache.
 * Azure Table Storage in deployed environments; a file-backed store with the
 * same ETag semantics for local development.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TABLES = ['accounts', 'ledger', 'stripeevents', 'registrycache'];

class ConflictError extends Error {
  constructor(message = 'Entity conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

function createFileTableStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const fileFor = (table) => path.join(dir, `${table}.json`);
  const load = (table) => {
    try { return JSON.parse(fs.readFileSync(fileFor(table), 'utf8')); } catch { return {}; }
  };
  const save = (table, data) => {
    const tmp = `${fileFor(table)}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, fileFor(table));
  };
  const keyOf = (pk, rk) => `${pk}\u0000${rk}`;
  const newEtag = () => crypto.randomBytes(8).toString('hex');

  // Every operation is a synchronous read-modify-write, so operations never
  // interleave within one process.
  return {
    async ensureTables(names = TABLES) {
      for (const name of names) {
        if (!fs.existsSync(fileFor(name))) save(name, {});
      }
    },
    async getEntity(table, pk, rk) {
      const e = load(table)[keyOf(pk, rk)];
      return e ? { ...e } : null;
    },
    async createEntity(table, entity) {
      const data = load(table);
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (data[k]) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} exists`);
      const etag = newEtag();
      data[k] = { ...entity, etag };
      save(table, data);
      return { etag };
    },
    async updateEntity(table, entity, etag) {
      const data = load(table);
      const k = keyOf(entity.partitionKey, entity.rowKey);
      if (!data[k] || data[k].etag !== etag) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} changed`);
      const next = newEtag();
      data[k] = { ...entity, etag: next };
      save(table, data);
      return { etag: next };
    },
    async upsertEntity(table, entity) {
      const data = load(table);
      const etag = newEtag();
      data[keyOf(entity.partitionKey, entity.rowKey)] = { ...entity, etag };
      save(table, data);
      return { etag };
    },
    async listEntities(table, pk, { limit = 50 } = {}) {
      return Object.values(load(table))
        .filter(e => e.partitionKey === pk)
        .sort((a, b) => (a.rowKey < b.rowKey ? -1 : a.rowKey > b.rowKey ? 1 : 0))
        .slice(0, limit)
        .map(e => ({ ...e }));
    }
  };
}

module.exports = { createFileTableStore, ConflictError, TABLES };
```

- [ ] **Step 4: Run tests**

Run: `npm --prefix backend test`
Expected: all tableStore tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/platform/tableStore.js backend/tests/tableStore.test.js
git commit -m "feat(platform): file-backed table store with ETag concurrency"
```

---

### Task 3: Azure table store + factory

**Files:**
- Modify: `backend/platform/tableStore.js`
- Test: `backend/tests/tableStore.test.js` (factory tests)

- [ ] **Step 1: Write failing factory tests** (append)

```js
const { getTableStore, setTableStoreForTests } = require('../platform/tableStore');

test('getTableStore refuses to start in production without a connection string', () => {
  const saved = { conn: process.env.AZURE_STORAGE_CONNECTION_STRING, env: process.env.NODE_ENV };
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  process.env.NODE_ENV = 'production';
  setTableStoreForTests(null);
  try {
    assert.throws(() => getTableStore(), /AZURE_STORAGE_CONNECTION_STRING/);
  } finally {
    if (saved.conn !== undefined) process.env.AZURE_STORAGE_CONNECTION_STRING = saved.conn;
    if (saved.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.env;
    setTableStoreForTests(null);
  }
});

test('setTableStoreForTests overrides the singleton', () => {
  const fake = { marker: true };
  setTableStoreForTests(fake);
  assert.equal(getTableStore(), fake);
  setTableStoreForTests(null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm --prefix backend test`
Expected: FAIL — `getTableStore is not a function`.

- [ ] **Step 3: Implement** (add above `module.exports`, then update exports)

```js
function createAzureTableStore(connectionString) {
  const { TableClient, odata } = require('@azure/data-tables');
  const clients = new Map();
  const client = (table) => {
    if (!clients.has(table)) clients.set(table, TableClient.fromConnectionString(connectionString, table));
    return clients.get(table);
  };
  const strip = (e) => {
    const { etag, timestamp, 'odata.metadata': _meta, ...rest } = e;
    return { ...rest, etag };
  };

  return {
    async ensureTables(names = TABLES) {
      for (const name of names) {
        await client(name).createTable().catch((err) => {
          if (err.statusCode !== 409) throw err;
        });
      }
    },
    async getEntity(table, pk, rk) {
      try {
        return strip(await client(table).getEntity(pk, rk));
      } catch (err) {
        if (err.statusCode === 404) return null;
        throw err;
      }
    },
    async createEntity(table, entity) {
      try {
        const r = await client(table).createEntity(entity);
        return { etag: r.etag };
      } catch (err) {
        if (err.statusCode === 409) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} exists`);
        throw err;
      }
    },
    async updateEntity(table, entity, etag) {
      const { etag: _ignored, ...body } = entity;
      try {
        const r = await client(table).updateEntity(body, 'Replace', { etag });
        return { etag: r.etag };
      } catch (err) {
        if (err.statusCode === 412) throw new ConflictError(`${table}/${entity.partitionKey}/${entity.rowKey} changed`);
        throw err;
      }
    },
    async upsertEntity(table, entity) {
      const { etag: _ignored, ...body } = entity;
      const r = await client(table).upsertEntity(body, 'Replace');
      return { etag: r.etag };
    },
    async listEntities(table, pk, { limit = 50 } = {}) {
      const out = [];
      const iter = client(table).listEntities({ queryOptions: { filter: odata`PartitionKey eq ${pk}` } });
      for await (const e of iter) {
        out.push(strip(e));
        if (out.length >= limit) break;
      }
      return out;
    }
  };
}

let instance = null;

function getTableStore() {
  if (instance) return instance;
  const conn = (process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  if (conn) {
    instance = createAzureTableStore(conn);
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required in production');
    }
    console.warn('[Table Store] AZURE_STORAGE_CONNECTION_STRING not set; using local file store (development only).');
    instance = createFileTableStore(path.join(__dirname, '..', 'data', 'local-store'));
  }
  return instance;
}

function setTableStoreForTests(store) {
  instance = store;
}

module.exports = {
  createFileTableStore, createAzureTableStore, getTableStore, setTableStoreForTests, ConflictError, TABLES
};
```

- [ ] **Step 4: Ensure tables at startup**

In `backend/server.js`, inside `if (require.main === module) {`, before `app.listen`, add:

```js
  const { getTableStore } = require('./platform/tableStore');
  getTableStore().ensureTables().catch((err) => {
    console.error('[Table Store] Failed to ensure tables:', err.message);
    process.exit(1);
  });
```

- [ ] **Step 5: Run tests, commit**

Run: `npm --prefix backend test` → PASS.

```bash
git add backend/platform/tableStore.js backend/tests/tableStore.test.js backend/server.js
git commit -m "feat(platform): Azure Table Storage implementation and store factory"
```

---

### Task 4: Session tokens and requireSession middleware

**Files:**
- Create: `backend/platform/session.js`, `backend/platform/admin.js`, `backend/middleware/requireSession.js`
- Test: `backend/tests/session.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { issueSessionToken, verifySessionToken } = require('../platform/session');
const { requireSession, requireAdmin } = require('../middleware/requireSession');

process.env.SESSION_JWT_SECRET = 'test-secret';

function run(mw, headers = {}) {
  const req = { headers };
  let status = null; let body = null; let nextCalled = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  mw(req, res, () => { nextCalled = true; });
  return { req, status, body, nextCalled };
}

test('issue/verify round-trips with lowercase email subject', () => {
  const t = issueSessionToken({ id: 'u_1', email: 'Officer@Bank.IN', username: 'Officer', role: 'Analyst', provider: 'google' });
  assert.deepEqual(verifySessionToken(t), { email: 'officer@bank.in', uid: 'u_1', name: 'Officer', role: 'Analyst', provider: 'google' });
});

test('requireSession rejects missing header', () => {
  const r = run(requireSession);
  assert.equal(r.status, 401);
  assert.equal(r.body.code, 'SESSION_REQUIRED');
  assert.equal(r.nextCalled, false);
});

test('requireSession rejects expired token', () => {
  const t = jwt.sign({ uid: 'u_1' }, 'test-secret', { algorithm: 'HS256', subject: 'a@b.c', expiresIn: -10 });
  assert.equal(run(requireSession, { authorization: `Bearer ${t}` }).status, 401);
});

test('requireSession rejects token signed with another secret', () => {
  const t = jwt.sign({ uid: 'u_1' }, 'other', { algorithm: 'HS256', subject: 'a@b.c' });
  assert.equal(run(requireSession, { authorization: `Bearer ${t}` }).status, 401);
});

test('requireSession accepts valid token and sets req.session', () => {
  const t = issueSessionToken({ id: 'u_2', email: 'x@y.com' });
  const r = run(requireSession, { authorization: `Bearer ${t}` });
  assert.equal(r.nextCalled, true);
  assert.equal(r.req.session.email, 'x@y.com');
});

test('requireAdmin allows @enveraitech.com sessions only', () => {
  const ok = { headers: {}, session: { email: 'boss@enveraitech.com' } };
  const lookalike = { headers: {}, session: { email: 'boss@enveraitech.com.evil.io' } };
  const sub = { headers: {}, session: { email: 'x@mail.enveraitech.com' } };
  const no = { headers: {}, session: { email: 'someone@x.com' } };
  let status = null; let passed = false;
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  requireAdmin(ok, res, () => { passed = true; });
  assert.equal(passed, true);
  for (const req of [lookalike, sub, no]) {
    status = null;
    requireAdmin(req, res, () => { throw new Error(`should not pass: ${req.session.email}`); });
    assert.equal(status, 403);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm --prefix backend test` → FAIL, module not found.

- [ ] **Step 3: Implement**

`backend/platform/session.js`:

```js
/**
 * Server-issued session tokens (HS256 JWT). Issued only after the server has
 * verified the identity itself (email OTP, Firebase ID token).
 */
const jwt = require('jsonwebtoken');

const SESSION_TTL = '12h';

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sessionSecret() {
  const secret = process.env.SESSION_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_JWT_SECRET is required in production');
  }
  return 'dev-only-insecure-session-secret';
}

function issueSessionToken(user) {
  return jwt.sign(
    { uid: user.id || '', name: user.username || '', role: user.role || '', provider: user.provider || '' },
    sessionSecret(),
    { algorithm: 'HS256', expiresIn: SESSION_TTL, subject: normaliseEmail(user.email) }
  );
}

function verifySessionToken(token) {
  const p = jwt.verify(token, sessionSecret(), { algorithms: ['HS256'] });
  return { email: p.sub, uid: p.uid, name: p.name, role: p.role, provider: p.provider };
}

module.exports = { issueSessionToken, verifySessionToken, normaliseEmail };
```

`backend/platform/admin.js`:

```js
const { normaliseEmail } = require('./session');

// Admin = a server-verified session for an @enveraitech.com address.
// Exact domain match only (no subdomains, no lookalike suffixes).
const ADMIN_DOMAIN = 'enveraitech.com';

function isAdminEmail(email) {
  const clean = normaliseEmail(email);
  const at = clean.lastIndexOf('@');
  return at > 0 && clean.slice(at + 1) === ADMIN_DOMAIN;
}

module.exports = { isAdminEmail };
```

`backend/middleware/requireSession.js`:

```js
const { verifySessionToken } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');

function requireSession(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) {
    return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Sign in required.' });
  }
  try {
    req.session = verifySessionToken(match[1]);
    return next();
  } catch {
    return res.status(401).json({ code: 'SESSION_REQUIRED', error: 'Session expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.session && isAdminEmail(req.session.email)) return next();
  return res.status(403).json({ code: 'ADMIN_REQUIRED', error: 'Administrator access required.' });
}

module.exports = { requireSession, requireAdmin };
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/platform/session.js backend/platform/admin.js backend/middleware/requireSession.js backend/tests/session.test.js
git commit -m "feat(auth): signed session tokens with requireSession/requireAdmin middleware"
```

---

### Task 5: Firebase ID token verification and POST /api/v1/auth/session

**Files:**
- Create: `backend/platform/firebaseVerify.js`, `backend/controllers/sessionController.js`
- Modify: `backend/controllers/userController.js` (export `findOrCreateUser`)
- Test: `backend/tests/firebaseVerify.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { verifyFirebaseIdToken } = require('../platform/firebaseVerify');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
const getCerts = async () => ({ kid1: pubPem });
const PROJECT = 'test-project';

function token(claims = {}, opts = {}) {
  return jwt.sign(
    { email: 'User@Gmail.com', email_verified: true, name: 'User', firebase: { sign_in_provider: 'google.com' }, ...claims },
    privateKey,
    { algorithm: 'RS256', keyid: 'kid1', audience: PROJECT, issuer: `https://securetoken.google.com/${PROJECT}`, subject: 'firebase-uid', expiresIn: 300, ...opts }
  );
}

test('accepts a valid token and lowercases the email', async () => {
  const r = await verifyFirebaseIdToken(token(), { projectId: PROJECT, getCerts });
  assert.deepEqual(r, { email: 'user@gmail.com', name: 'User', uid: 'firebase-uid', provider: 'google.com' });
});

test('rejects unverified email', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({ email_verified: false }), { projectId: PROJECT, getCerts }), /not verified/);
});

test('rejects wrong audience', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { audience: 'other' }), { projectId: PROJECT, getCerts }));
});

test('rejects unknown key id', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { keyid: 'nope' }), { projectId: PROJECT, getCerts }), /Unknown signing key/);
});

test('rejects expired token', async () => {
  await assert.rejects(verifyFirebaseIdToken(token({}, { expiresIn: -10 }), { projectId: PROJECT, getCerts }));
});
```

- [ ] **Step 2: Run to verify failure** → module not found.

- [ ] **Step 3: Implement `backend/platform/firebaseVerify.js`**

```js
/**
 * Verifies Firebase Auth ID tokens without firebase-admin, per
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const jwt = require('jsonwebtoken');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { certs: null, expiresAt: 0 };

async function fetchGoogleCerts() {
  if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to fetch Firebase signing certs (HTTP ${res.status})`);
  const certs = await res.json();
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  certCache = { certs, expiresAt: Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 3600 * 1000) };
  return certs;
}

async function verifyFirebaseIdToken(idToken, {
  projectId = process.env.FIREBASE_PROJECT_ID || 'idbi-innovate',
  getCerts = fetchGoogleCerts
} = {}) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    throw new Error('Malformed ID token');
  }
  const certs = await getCerts();
  const cert = certs[decoded.header.kid];
  if (!cert) throw new Error('Unknown signing key');

  const payload = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });
  if (!payload.sub) throw new Error('ID token has no subject');
  if (!payload.email || payload.email_verified !== true) throw new Error('Email not verified');

  return {
    email: String(payload.email).toLowerCase(),
    name: payload.name || '',
    uid: payload.sub,
    provider: payload.firebase?.sign_in_provider || 'firebase'
  };
}

module.exports = { verifyFirebaseIdToken };
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Export `findOrCreateUser` from userController**

In `backend/controllers/userController.js`, add above `module.exports`:

```js
const findOrCreateUser = ({ email, name, provider }) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const users = getUsers();
  let user = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
  if (!user) {
    const handle = cleanEmail.split('@')[0];
    const formattedName = (name || handle).split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    user = {
      id: `u_${handle.replace(/[^a-z0-9]/g, '')}_${Date.now()}`,
      username: formattedName || 'Institutional Underwriter',
      email: cleanEmail,
      role: cleanEmail.endsWith('@enveraitech.com') ? 'Enterprise Principal Underwriter' : 'Institutional Underwriter',
      org: cleanEmail.split('@')[1].toUpperCase(),
      provider,
      status: `Active (${provider} verified)`,
      calls: 0,
      cost: 0,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    users.push(user);
  } else {
    user.lastLogin = new Date().toISOString();
  }
  saveUsers(users);
  return user;
};
```

and add `findOrCreateUser` to the `module.exports` object.

- [ ] **Step 6: Create `backend/controllers/sessionController.js`**

```js
const { verifyFirebaseIdToken } = require('../platform/firebaseVerify');
const { issueSessionToken } = require('../platform/session');
const { findOrCreateUser, recordTelemetryLogin } = require('./userController');

async function createSession(req, res) {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) return res.status(400).json({ error: 'idToken is required.' });

  let identity;
  try {
    identity = await verifyFirebaseIdToken(idToken);
  } catch (err) {
    console.warn('[Auth] Firebase ID token rejected:', err.message);
    return res.status(401).json({ code: 'INVALID_ID_TOKEN', error: 'Sign-in could not be verified.' });
  }

  const user = findOrCreateUser(identity);
  await recordTelemetryLogin({
    user,
    email: identity.email,
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
    type: `firebase_${identity.provider}`,
    status: 'AUTHORIZED'
  });

  return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });
}

module.exports = { createSession };
```

- [ ] **Step 7: Commit**

```bash
git add backend/platform/firebaseVerify.js backend/controllers/sessionController.js backend/controllers/userController.js backend/tests/firebaseVerify.test.js
git commit -m "feat(auth): verify Firebase ID tokens and issue sessions via /auth/session"
```

---

### Task 6: Remove password login and hardcoded credentials; OTP issues sessions

**Files:**
- Modify: `backend/controllers/userController.js`, `backend/server.js`
- Test: `backend/tests/auth.credentials.test.js`

Owner decision (2026-11-12): no hardcoded or shared master passwords. No user has a personal passkey (`users.json` has none), so password login is removed entirely. The Google/Apple branch of `loginUser` trusts a client-supplied email, so it goes too — Google/Apple use `/auth/session` (Task 5). Remaining server-verified paths: `/auth/session` and email OTP.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const post = (base, p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('password login endpoint no longer exists', () => withServer(async (base) => {
  const res = await post(base, '/api/v1/users/login', { username: 'andalaus', password: 'Citadel@296', authType: 'client_credential' });
  assert.equal(res.status, 404);
}));

test('former demo OTP codes are rejected', () => withServer(async (base) => {
  for (const code of ['742918', '296296']) {
    const res = await post(base, '/api/v1/auth/verify-code', { email: 'someone@x.com', code });
    assert.equal(res.status, 401);
  }
}));

test('valid OTP returns a session token', () => withServer(async (base) => {
  const prev = process.env.ENABLE_DEMO_OTP;
  process.env.ENABLE_DEMO_OTP = 'true';
  try {
    const sent = await (await post(base, '/api/v1/auth/send-code', { email: 'otp-user@x.com' })).json();
    const res = await post(base, '/api/v1/auth/verify-code', { email: 'otp-user@x.com', code: sent.demoCode });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.sessionToken);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_DEMO_OTP; else process.env.ENABLE_DEMO_OTP = prev;
  }
}));

test('no hardcoded master passwords remain in source', () => {
  const roots = [path.join(__dirname, '..', 'controllers'), path.join(__dirname, '..', '..', 'frontend', 'src')];
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|jsx)$/.test(e.name) && /Citadel@296|Saddiesink@296|742918|296296|ENV-ADM-/.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});
```

(This test also covers the frontend files cleaned in Task 8b; it passes only after both tasks.)

- [ ] **Step 2: Run to verify failure** — `npm --prefix backend test` → the 404 and demo-code tests FAIL.

- [ ] **Step 3: Remove `loginUser`**

In `backend/controllers/userController.js` delete the whole `loginUser` function (including the Google/Apple branch, the `@enveraitech.com` domain check, the `masterPasskeys` array and the passkey comparison), the now-unused `loginRateLimitMap`, and `loginUser` from `module.exports`. Keep `getUsers`, `saveUsers`, `recordTelemetryLogin`, `findOrCreateUser`, OTP functions, `getAllUsers` (still strips any `passkey` field), `getLoginTelemetry`, `incrementUserUsage`.

In `backend/server.js` remove `loginUser` from the userController import and delete `app.post('/api/v1/users/login', loginUser);`.

- [ ] **Step 4: OTP without master codes, with sessions**

At the top of `userController.js` add `const { issueSessionToken } = require('../platform/session');`.

In `verifyOtp` replace

```js
  const isValid = (cached && cached.code === cleanCode) || (isDevOrDemo && (cleanCode === '742918' || cleanCode === '296296'));
```

with

```js
  const isValid = Boolean(cached && cached.expiresAt > Date.now() && cached.code === cleanCode);
```

and delete the now-unused `isDevOrDemo` line in `verifyOtp` (keep the one in `sendOtp`, which only returns the generated code in non-production dev). Replace the final `return res.json({ status: 'success', user });` with:

```js
  return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });
```

Also replace the code generator `Math.floor(100000 + Math.random() * 900000).toString()` in `sendOtp` with `require('crypto').randomInt(100000, 1000000).toString()`.

- [ ] **Step 5: Run tests** — all except the "no hardcoded master passwords" test PASS (that one waits for Task 8b).

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/userController.js backend/server.js backend/tests/auth.credentials.test.js
git commit -m "fix(auth): remove password login, master passkeys and demo OTP codes; OTP issues sessions"
```

---

### Task 7: Protect routes; identity from the session

**Files:**
- Modify: `backend/server.js`, `backend/controllers/creditController.js:12-21,125-143,204-222`, `backend/controllers/historyController.js:24-34`
- Test: `backend/tests/routes.auth.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');
const { issueSessionToken } = require('../platform/session');

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

for (const [method, path] of [['POST', '/api/v1/evaluate'], ['POST', '/api/v1/chat/xai'], ['GET', '/api/v1/history'], ['GET', '/api/v1/users'], ['GET', '/api/v1/telemetry/logins']]) {
  test(`${method} ${path} requires a session`, () => withServer(async (base) => {
    const res = await fetch(base + path, { method });
    assert.equal(res.status, 401);
  }));
}

test('/api/v1/users requires admin', () => withServer(async (base) => {
  const user = issueSessionToken({ id: 'u', email: 'someone@x.com' });
  const admin = issueSessionToken({ id: 'a', email: 'boss@enveraitech.com' });
  assert.equal((await fetch(`${base}/api/v1/users`, { headers: { authorization: `Bearer ${user}` } })).status, 403);
  assert.equal((await fetch(`${base}/api/v1/users`, { headers: { authorization: `Bearer ${admin}` } })).status, 200);
}));

test('history returns only the caller\'s records', () => withServer(async (base) => {
  const t = issueSessionToken({ id: 'u', email: 'nobody-with-history@x.com' });
  const body = await (await fetch(`${base}/api/v1/history`, { headers: { authorization: `Bearer ${t}` } })).json();
  assert.deepEqual(body.history, []);
}));
```

- [ ] **Step 2: Run to verify failure** → evaluate/chat/history return non-401.

- [ ] **Step 3: Wire middleware in `backend/server.js`**

Add imports near the other requires:

```js
const { requireSession, requireAdmin } = require('./middleware/requireSession');
const { createSession } = require('./controllers/sessionController');
```

Replace the route registrations:

```js
app.post('/api/v1/evaluate', requireSession, upload.single('statement'), evaluateMSMECredit);
app.post('/api/v1/chat/xai', requireSession, handleXAIChat);

app.post('/api/v1/auth/send-code', sendOtp);
app.post('/api/v1/auth/verify-code', verifyOtp);
app.post('/api/v1/auth/session', createSession);
app.post('/api/v1/users/login', loginUser);
app.get('/api/v1/users', requireSession, requireAdmin, getAllUsers);
app.get('/api/v1/telemetry/logins', requireSession, requireAdmin, getLoginTelemetry);

app.get('/api/v1/history', requireSession, getHistory);
```

- [ ] **Step 4: History by session** — replace `getHistory` in `historyController.js`:

```js
const { isAdminEmail } = require('../platform/admin');

const getHistory = async (req, res) => {
  const email = req.session.email;
  let history = getHistoryData();
  if (!isAdminEmail(email)) {
    history = history.filter(h => String(h.userEmail || '').toLowerCase() === email);
  }
  history.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  res.json({ status: 'success', history });
};
```

- [ ] **Step 5: Credit controller identity** — in `evaluateMSMECredit` replace lines 17–20 (`userId`…`userRole` from `req.body`) with:

```js
    const { uid: userId, email: userEmail, name: userName, role: userRole } = req.session;
```

and in both `recordToSave` objects replace the `userId`/`userEmail`/`userName`/`userRole` lines with:

```js
        userId,
        userEmail,
        userName: userName || userEmail,
        userRole: userRole || 'Institutional Credit Officer',
```

Replace `const effectiveUserId = userId || 'u_andalaus_master';` (both places) with nothing and `incrementUserUsage(effectiveUserId);` with `incrementUserUsage(userId);`.

- [ ] **Step 6: Run tests, commit**

Run: `npm --prefix backend test` → PASS.

```bash
git add backend/server.js backend/controllers/historyController.js backend/controllers/creditController.js backend/tests/routes.auth.test.js
git commit -m "feat(auth): require sessions on evaluate/chat/history and admin on user telemetry"
```

---

### Task 8: Frontend session handling

**Files:**
- Create: `frontend/src/utils/apiClient.js`
- Modify: `frontend/src/components/auth/VerificationGate.jsx`, `frontend/src/App.jsx`, `frontend/src/components/OrcTerminal/OrcTerminal.jsx:96`, `frontend/src/components/MasterDashboard/MasterDashboard.jsx:17-21`

- [ ] **Step 1: Create `frontend/src/utils/apiClient.js`**

```js
export const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:4000');

const TOKEN_KEY = 'enverai_session_token';
const unauthorizedListeners = new Set();

export function getSessionToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setSessionToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) unauthorizedListeners.forEach(fn => fn());
  return res;
}
```

- [ ] **Step 2: VerificationGate — Firebase sessions only**

Import: `import { API_BASE, setSessionToken } from '../../utils/apiClient';` and delete the local `const API_BASE = ...` line.

Replace the whole `handleAuthenticateUser` function with:

```js
  // Exchanges a Firebase ID token for a server session. The server verifies the
  // token and the email; nothing here trusts a client-supplied identity.
  const handleAuthenticateUser = async ({ idToken }) => {
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'success' && data.user && data.sessionToken) {
        setSessionToken(data.sessionToken);
        localStorage.setItem('enverai_user_session', JSON.stringify(data.user));
        localStorage.setItem('enver_user_email', data.user.email);
        setActiveModal(null);
        onVerified(data.user);
      } else {
        setSessionToken(null);
        setError(data.error || 'Sign-in could not be verified. Please retry.');
      }
    } catch {
      setSessionToken(null);
      setError('The sign-in service could not be reached. Please retry.');
    } finally {
      setAuthLoading(false);
    }
  };
```

In `handleGoogleSignIn`, `handleAppleSignIn` and the `getRedirectResult` effect, call `await handleAuthenticateUser({ idToken: await result.user.getIdToken() });`. In both sign-in handlers, replace the "popup blocked → open manual email modal" fallback (`setActiveModal('google' | 'apple')` and its preceding `setUserEmail('')`/`setUserName('')`) with:

```js
    setAuthLoading(false);
    setError('Sign-in popup was blocked or closed. Allow popups for this site and try again.');
```

Delete the manual email modal for `'google'`/`'apple'` (the JSX rendered when `activeModal === 'google' || activeModal === 'apple'`) and its submit handler, which posted an unverified email to `/users/login`. If `handleCreateAccountClick` / the `'create'` modal also posts to `/users/login`, change the Create Account button to call `handleGoogleSignIn` and delete that modal.

Delete the Azure `/.auth/me` effect ("1. Detect Azure App Service EasyAuth") — it created a session from an unverifiable client-side principal.

- [ ] **Step 3: VerificationGate — remove passwords, keep OTP**

Delete the client-credential (username + passkey) login: its handler (the one posting `authType: 'client_credential'`, including both `fallbackAdmin` blocks and the `validPasskeys` arrays), its state (`clientUsername`, `clientPassword`, `failedAttempts`, `lockoutTimer` and the lockout effect, if used only there), and its JSX (the "Client Login" form / passkey accordion, `auth-passkey-*` classes). If `authMode` only toggled between `'client'` and `'otp'`, render the OTP flow directly and remove the toggle.

In `handleSendCode`, delete the client-side `generatedCode` fallback; only call `setServerDemoCode(data.demoCode)` when the server returned one, and on network failure `setError('Could not send a verification code. Please retry.')` and return.

In `handleVerifyCode`, replace the body of the outer `try` with:

```js
      const res = await fetch(`${API_BASE}/api/v1/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user && data.sessionToken) {
        setSessionToken(data.sessionToken);
        localStorage.setItem('enverai_user_session', JSON.stringify(data.user));
        localStorage.setItem('enver_user_email', cleanEmail);
        onVerified(data.user);
      } else {
        setError(data.error || 'Invalid or expired verification code.');
      }
```

(this removes the `isClientValid` check that accepted any 6-digit code and the hardcoded `742918` / `296296`).

Remove any now-unused imports/state flagged by the build.

- [ ] **Step 4: App.jsx — session restore, logout, 401**

Import: `import { apiFetch, getSessionToken, setSessionToken, onUnauthorized } from './utils/apiClient';` and delete the local `const API_BASE = ...` line (keep usages that remain by importing `API_BASE` too if still referenced after Part 3).

In the mount effect "2. Check saved session", change `if (user && user.id) {` to `if (user && user.id && getSessionToken()) {`.

In `handleLogout`, add `setSessionToken(null);` as the first line.

Add after the mount effect:

```js
  useEffect(() => onUnauthorized(() => {
    handleLogout();
  }), []);
```

Replace `fetch(`${API_BASE}/api/v1/history?userId=${userId}`)` with `apiFetch('/api/v1/history')`, and the chat call `fetch(`${API_BASE}/api/v1/chat/xai`, {...})` with `apiFetch('/api/v1/chat/xai', {...})` (same options).

In `triggerEvaluation` delete the four `formData.append('userId' | 'userEmail' | 'userName' | 'userRole', ...)` lines and replace `fetch(`${API_BASE}/api/v1/evaluate`, {` with `apiFetch('/api/v1/evaluate', {`.

- [ ] **Step 5: OrcTerminal and MasterDashboard**

`OrcTerminal.jsx`: import `apiFetch`; replace `if (API_BASE) { const res = await fetch(`${API_BASE}/api/v1/chat/xai`, {` with `{ const res = await apiFetch('/api/v1/chat/xai', {`.

`MasterDashboard.jsx`: import `apiFetch`; replace the three `fetch(`${API_BASE}/api/v1/...`)` calls with `apiFetch('/api/v1/users')`, `apiFetch('/api/v1/history')`, `apiFetch('/api/v1/telemetry/logins')`.

- [ ] **Step 6: Build and manual check**

Run: `npm --prefix frontend run build` → succeeds.
Manual: `npm run dev:backend` + `npm run dev`; sign in with Google → `localStorage.enverai_session_token` set; `/api/v1/history` request carries `Authorization`; delete the token in devtools and trigger history → app returns to the login gate.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/apiClient.js frontend/src/components/auth/VerificationGate.jsx frontend/src/App.jsx frontend/src/components/OrcTerminal/OrcTerminal.jsx frontend/src/components/MasterDashboard/MasterDashboard.jsx
git commit -m "feat(frontend): server-verified sign-in only; send session token on protected calls"
```

---

### Task 8b: Remove remaining client-side bypasses; admin-only UI

**Files:**
- Modify: `frontend/src/App.jsx` (signup-redirect block ~163-189, `currentView === 'master'` ~842, `onOpenMasterDashboard` ~937), and the component that renders the Master Dashboard button (Grep `onOpenMasterDashboard`)
- Create: `frontend/src/utils/admin.js`

- [ ] **Step 1: Remove the `?admitted=true` URL login** — in `App.jsx` delete block "1. Check if user just arrived from enveraitech.com/signup" (the `params.get('admitted')` / `params.get('signup')` branch that builds `admittedUser`). It logged anyone in from URL parameters.

- [ ] **Step 2: Admin helper** — `frontend/src/utils/admin.js`:

```js
// UI gate only; the server enforces admin access on every admin endpoint.
export function isAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  return at > 0 && email.slice(at + 1) === 'enveraitech.com';
}
```

- [ ] **Step 3: Gate the Master Dashboard** — in `App.jsx` import `isAdminUser`; change `if (currentView === 'master') {` to `if (currentView === 'master' && isAdminUser(currentUser)) {`; pass `onOpenMasterDashboard={isAdminUser(currentUser) ? () => setCurrentView('master') : undefined}`. In the receiving component, render the Master Dashboard button/link only when `onOpenMasterDashboard` is defined.

- [ ] **Step 4: Verify**

Run: `npm --prefix backend test` → all PASS, including "no hardcoded master passwords remain in source".
Run: `npm --prefix frontend run build` → succeeds.
Grep `frontend/src` and `backend` (excluding node_modules and tests) for `Citadel@296|Saddiesink|742918|296296|ENV-ADM|fallbackAdmin|admitted` → no matches.
Manual: a non-`@enveraitech.com` Google account sees no Master Dashboard entry and gets 403 from `/api/v1/users`; an `@enveraitech.com` account sees and loads it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/utils/admin.js <component that renders the Master Dashboard button>
git commit -m "fix(auth): remove URL-param login; Master Dashboard for @enveraitech.com only"
```

---

**Deploy note (owner):** before deploying this branch, set `SESSION_JWT_SECRET` (long random string), `AZURE_STORAGE_CONNECTION_STRING`, and `FIREBASE_PROJECT_ID` in the Container App. Without the first two the server refuses to start in production.
