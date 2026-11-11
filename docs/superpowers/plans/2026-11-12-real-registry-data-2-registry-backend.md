# Real Registry Data — Plan Part 2: Registry Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Fetcha's fabricated registry/timeline data with real GSTN and MCA21 data from Sandbox (sandbox.co.in), with provenance, caching, and deterministic score adjustments.

**Architecture:** `backend/services/registry/` holds a Sandbox HTTP client, two providers (GST, MCA) returning a common envelope, a pure filing-metrics calculator, a registry service that orchestrates and caches via `tableStore`, and a pure score-adjustment function. Demo presets move to `backend/demo/` and only load when `DEMO_MODE=true`.

**Tech Stack:** Node 20+ global `fetch`, `node:test` with injected fakes (no network in tests).

**Prerequisite:** Part 1 complete (`tableStore`, `requireSession`).

**Sandbox API facts (from developer.sandbox.co.in, verified 2026-11-11):**
- `POST /authenticate` headers `x-api-key`, `x-api-secret` → `data.access_token` (24h). Subsequent calls: `authorization: <token>` (no Bearer), `x-api-key`, optional `x-api-version`, `x-accept-cache: true`.
- `POST /gst/compliance/public/gstin/search` `{gstin}` → `data.data` {`lgnm`,`tradeNam`,`sts`,`rgdt`,`cxdt`,`ctb`,`dty`,`nba`,`pradr.addr`,`einvoiceStatus`,`lstupdt`}. Not found: HTTP 200, `data.status_cd:"0"`, `data.error.error_cd:"FO8000"`. Bad pattern: `code:422`.
- `POST /gst/compliance/public/gstrs/track?financial_year=FY 2025-26` `{gstin}` → `data.data.EFiledlist[]` {`arn`,`dof` DD-MM-YYYY,`mof`,`ret_prd` MMYYYY,`rtntype`,`status`,`valid`}. No records: `status_cd:"0"`, `error_code:"RET13510"`.
- `POST /kyc/mca/company/master-data` `{cin}` (CIN must match `^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$`) → `data` (object or 1-element array) {`cin`,`company_name`,`company_status`,`company_registration_date`,`authorized_capital`,`paidup_capital`,`company_class`,`company_category`,`company_roc_code`,`nic_code`,`company_industrial_classification`,`registered_office_address`,`listing_status`}. Not found: `code:521`.
- `GET /kyc/mca/company/master-data/search?company_name=…` (≥3 chars) → `data.records[]` {`cin`,`company_name`}. Not found: `code:521`.

---

### Task 9: Sandbox client

**Files:**
- Create: `backend/services/registry/sandboxClient.js`
- Test: `backend/tests/registry/sandboxClient.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandboxClient } = require('../../services/registry/sandboxClient');

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function fakeFetch(handlers) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const h = handlers.shift();
    if (!h) throw new Error(`unexpected call ${url}`);
    return typeof h === 'function' ? h(url, init) : h;
  };
  fn.calls = calls;
  return fn;
}

const AUTH_OK = jsonResponse(200, { code: 200, data: { access_token: 'tok1' } });
const opts = (fetchImpl, extra = {}) => ({ apiKey: 'k', apiSecret: 's', baseUrl: 'https://sb.test', fetchImpl, ...extra });

test('authenticates once and reuses the token', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: { x: 1 }, transaction_id: 't1' }), jsonResponse(200, { code: 200, data: { x: 2 }, transaction_id: 't2' })]);
  const c = createSandboxClient(opts(f));
  const a = await c.post('/a', { q: 1 });
  const b = await c.post('/b', { q: 2 });
  assert.equal(a.ok, true); assert.equal(a.transactionId, 't1');
  assert.equal(b.body.data.x, 2);
  assert.equal(f.calls.filter(c => c.url.endsWith('/authenticate')).length, 1);
  assert.equal(f.calls[1].init.headers.authorization, 'tok1');
  assert.equal(f.calls[1].init.headers['x-api-key'], 'k');
  assert.equal(f.calls[1].init.headers['x-accept-cache'], 'true');
});

test('re-authenticates after token TTL', async () => {
  let now = 0;
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: {} }), jsonResponse(200, { code: 200, data: { access_token: 'tok2' } }), jsonResponse(200, { code: 200, data: {} })]);
  const c = createSandboxClient(opts(f, { now: () => now }));
  await c.post('/a', {});
  now = 24 * 3600 * 1000;
  await c.post('/a', {});
  assert.equal(f.calls[3].init.headers.authorization, 'tok2');
});

test('maps status_cd "0" FO8000 to not_found', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: { status_cd: '0', error: { error_cd: 'FO8000', message: 'No records found' } }, transaction_id: 'tx' })]);
  const r = await createSandboxClient(opts(f)).post('/gst', {});
  assert.deepEqual(r, { ok: false, kind: 'not_found', code: 'FO8000', message: 'No records found', transactionId: 'tx' });
});

test('maps 521 to not_found and 422 to invalid_input', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(521, { code: 521, message: 'not found' }), jsonResponse(422, { code: 422, message: 'Invalid GSTIN pattern' })]);
  const c = createSandboxClient(opts(f));
  assert.equal((await c.post('/x', {})).kind, 'not_found');
  assert.equal((await c.post('/x', {})).kind, 'invalid_input');
});

test('retries once on network error then reports unavailable', async () => {
  const boom = () => { throw new Error('ECONNRESET'); };
  const f = fakeFetch([AUTH_OK, boom, boom]);
  const r = await createSandboxClient(opts(f)).post('/x', {});
  assert.equal(r.ok, false); assert.equal(r.kind, 'unavailable');
});

test('re-authenticates once on 401', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(401, { code: 401, message: 'expired' }), jsonResponse(200, { code: 200, data: { access_token: 'tok2' } }), jsonResponse(200, { code: 200, data: { ok: 1 } })]);
  const r = await createSandboxClient(opts(f)).post('/x', {});
  assert.equal(r.ok, true);
});

test('missing credentials → unavailable without network', async () => {
  const f = fakeFetch([]);
  const r = await createSandboxClient({ apiKey: '', apiSecret: '', fetchImpl: f }).post('/x', {});
  assert.equal(r.kind, 'unavailable'); assert.equal(r.code, 'NO_CREDENTIALS');
});

test('GET sends no body', async () => {
  const f = fakeFetch([AUTH_OK, jsonResponse(200, { code: 200, data: {} })]);
  await createSandboxClient(opts(f)).get('/search?company_name=abc');
  assert.equal(f.calls[1].init.method, 'GET');
  assert.equal(f.calls[1].init.body, undefined);
});
```

- [ ] **Step 2: Run to verify failure** — `npm --prefix backend test` → module not found.

- [ ] **Step 3: Implement**

```js
/**
 * HTTP client for Sandbox (sandbox.co.in) public GST and MCA21 APIs.
 * Never logs credentials or tokens.
 */
const DEFAULT_BASE_URL = 'https://api.sandbox.co.in';
const TOKEN_TTL_MS = 23 * 3600 * 1000;
const NOT_FOUND_CODES = new Set(['FO8000', 'RET13510']);

function createSandboxClient({
  apiKey = process.env.SANDBOX_API_KEY,
  apiSecret = process.env.SANDBOX_API_SECRET,
  baseUrl = process.env.SANDBOX_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = (...args) => fetch(...args),
  timeoutMs = 10000,
  now = () => Date.now()
} = {}) {
  let token = null;
  let tokenExpiresAt = 0;

  const request = (url, init) => fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

  async function getToken() {
    if (token && now() < tokenExpiresAt) return { token };
    if (!apiKey || !apiSecret) {
      return { error: { ok: false, kind: 'unavailable', code: 'NO_CREDENTIALS', message: 'Sandbox credentials are not configured', transactionId: null } };
    }
    try {
      const res = await request(`${baseUrl}/authenticate`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'x-api-secret': apiSecret, 'x-api-version': '1.0' }
      });
      const body = await res.json().catch(() => null);
      const accessToken = body?.data?.access_token;
      if (!res.ok || !accessToken) {
        console.warn(`[Sandbox] Authentication failed (HTTP ${res.status})`);
        return { error: { ok: false, kind: 'unavailable', code: `AUTH_${res.status}`, message: 'Sandbox authentication failed', transactionId: body?.transaction_id || null } };
      }
      token = accessToken;
      tokenExpiresAt = now() + TOKEN_TTL_MS;
      return { token };
    } catch (err) {
      return { error: { ok: false, kind: 'unavailable', code: 'NETWORK', message: err.message, transactionId: null } };
    }
  }

  async function send(method, pathAndQuery, body, attempt = 0, reauthenticated = false) {
    const auth = await getToken();
    if (auth.error) return auth.error;

    let res;
    try {
      res = await request(`${baseUrl}${pathAndQuery}`, {
        method,
        headers: {
          authorization: auth.token,
          'x-api-key': apiKey,
          'x-api-version': '1.0.0',
          'Content-Type': 'application/json',
          'x-accept-cache': 'true'
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (err) {
      if (attempt < 1) return send(method, pathAndQuery, body, attempt + 1, reauthenticated);
      return { ok: false, kind: 'unavailable', code: 'NETWORK', message: err.message, transactionId: null };
    }

    if ((res.status === 401 || res.status === 403) && !reauthenticated) {
      token = null;
      return send(method, pathAndQuery, body, attempt, true);
    }
    if (res.status >= 500 && res.status !== 521 && attempt < 1) {
      return send(method, pathAndQuery, body, attempt + 1, reauthenticated);
    }

    const json = await res.json().catch(() => null);
    const transactionId = json?.transaction_id || null;
    if (!json) return { ok: false, kind: 'provider_error', code: `HTTP_${res.status}`, message: 'Unreadable provider response', transactionId };

    const code = Number(json.code ?? res.status);
    if (code === 200 && json.data && json.data.status_cd === '0') {
      const e = json.data.error || {};
      const errorCode = e.error_cd || e.error_code || 'UNKNOWN';
      return { ok: false, kind: NOT_FOUND_CODES.has(errorCode) ? 'not_found' : 'provider_error', code: errorCode, message: e.message || 'Provider error', transactionId };
    }
    if (code === 200) return { ok: true, body: json, transactionId };
    if (code === 521 || code === 404) return { ok: false, kind: 'not_found', code: String(code), message: json.message || 'Not found', transactionId };
    if (code === 400 || code === 422) return { ok: false, kind: 'invalid_input', code: String(code), message: json.message || 'Invalid input', transactionId };
    return { ok: false, kind: 'unavailable', code: String(code), message: json.message || `HTTP ${res.status}`, transactionId };
  }

  return {
    post: (pathAndQuery, body) => send('POST', pathAndQuery, body),
    get: (pathAndQuery) => send('GET', pathAndQuery, undefined)
  };
}

let defaultClient = null;
function getSandboxClient() {
  if (!defaultClient) defaultClient = createSandboxClient();
  return defaultClient;
}

module.exports = { createSandboxClient, getSandboxClient };
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/services/registry/sandboxClient.js backend/tests/registry/sandboxClient.test.js
git commit -m "feat(registry): Sandbox API client with token caching and error normalisation"
```

---

### Task 10: GST provider

**Files:**
- Create: `backend/services/registry/gstProvider.js`, `backend/tests/fixtures/sandbox/gstin-search.json`, `backend/tests/fixtures/sandbox/gstrs-track.json`
- Test: `backend/tests/registry/gstProvider.test.js`

- [ ] **Step 1: Fixtures** (from the Sandbox docs examples)

`gstin-search.json`:

```json
{ "code": 200, "data": { "data": {
  "ctb": "Private Limited Company", "dty": "Regular", "einvoiceStatus": "No", "gstin": "24AAACQ1234A1Z5",
  "lgnm": "QUICKO INFOSOFT PRIVATE LIMITED", "tradeNam": "Quicko", "lstupdt": "18/10/2024", "rgdt": "01/07/2017",
  "nba": ["Supplier of Services"], "sts": "Active", "cxdt": "",
  "pradr": { "addr": { "bno": "B/701", "bnm": "Amrapali Lakeview Tower", "st": "Vastrapur", "loc": "Ahmedabad", "dst": "Ahmedabad", "stcd": "Gujarat", "pncd": "380015", "flno": "" }, "ntr": "" }
}, "status_cd": "1" }, "timestamp": 1763446641000, "transaction_id": "5248feb5-dd09-4f0d-9a42-14b34b849087" }
```

`gstrs-track.json`:

```json
{ "code": 200, "data": { "data": { "EFiledlist": [
  { "arn": "AA240925000001A", "dof": "10-10-2025", "mof": "ONLINE", "ret_prd": "092025", "rtntype": "GSTR1", "status": "Filed", "valid": "Y" },
  { "arn": "AA240925000002B", "dof": "25-10-2025", "mof": "ONLINE", "ret_prd": "092025", "rtntype": "GSTR3B", "status": "Filed", "valid": "Y" }
] }, "status_cd": "1" }, "timestamp": 1763446641000, "transaction_id": "7495493a-b127-4eca-a304-a550fbc98447" }
```

- [ ] **Step 2: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const gst = require('../../services/registry/gstProvider');
const SEARCH = require('../fixtures/sandbox/gstin-search.json');
const TRACK = require('../fixtures/sandbox/gstrs-track.json');

const fixedNow = () => new Date('2026-11-11T08:00:00Z');
const clientReturning = (result) => {
  const calls = [];
  return { calls, post: async (p, b) => { calls.push({ p, b }); return result; }, get: async () => result };
};

test('searchGstin maps the GST record', async () => {
  const c = clientReturning({ ok: true, body: SEARCH, transactionId: 'tx1' });
  const r = await gst.searchGstin('24AAACQ1234A1Z5', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/gst/compliance/public/gstin/search');
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'GSTN via Sandbox');
  assert.equal(r.transactionId, 'tx1');
  assert.equal(r.fetchedAt, '2026-11-11T08:00:00.000Z');
  assert.deepEqual(r.data, {
    gstin: '24AAACQ1234A1Z5', legalName: 'QUICKO INFOSOFT PRIVATE LIMITED', tradeName: 'Quicko', status: 'Active',
    registrationDate: '2017-07-01', cancellationDate: null, constitution: 'Private Limited Company', taxpayerType: 'Regular',
    natureOfBusiness: ['Supplier of Services'],
    principalAddress: 'B/701, Amrapali Lakeview Tower, Vastrapur, Ahmedabad, Ahmedabad, Gujarat, 380015',
    einvoiceStatus: 'No', lastUpdated: '2024-10-18'
  });
});

test('searchGstin not found → unavailable with reason', async () => {
  const r = await gst.searchGstin('24AAACQ1234A1Z5', { client: clientReturning({ ok: false, kind: 'not_found', code: 'FO8000', transactionId: 'tx' }) });
  assert.equal(r.status, 'unavailable');
  assert.equal(r.reason, 'GSTIN not found on GST portal');
});

test('trackReturns maps filings and passes financial year', async () => {
  const c = clientReturning({ ok: true, body: TRACK, transactionId: 'tx2' });
  const r = await gst.trackReturns('24AAACQ1234A1Z5', 'FY 2025-26', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/gst/compliance/public/gstrs/track?financial_year=FY%202025-26');
  assert.deepEqual(r.data[1], { returnType: 'GSTR3B', period: '2025-09', filedOn: '2025-10-25', arn: 'AA240925000002B', mode: 'ONLINE', status: 'Filed', valid: true });
});

test('trackReturns RET13510 → ok with empty list', async () => {
  const r = await gst.trackReturns('24AAACQ1234A1Z5', 'FY 2025-26', { client: clientReturning({ ok: false, kind: 'not_found', code: 'RET13510', transactionId: 'tx' }), now: fixedNow });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.data, []);
});

test('financialYearOf', () => {
  assert.equal(gst.financialYearOf(new Date('2026-11-11T00:00:00Z')), 'FY 2026-27');
  assert.equal(gst.financialYearOf(new Date('2026-02-01T00:00:00Z')), 'FY 2025-26');
});
```

- [ ] **Step 3: Run to verify failure** → module not found.

- [ ] **Step 4: Implement**

```js
/**
 * GSTN public data (registration + return filing history) via Sandbox.
 */
const { getSandboxClient } = require('./sandboxClient');

const SOURCE = 'GSTN via Sandbox';

function ddmmyyyyToIso(value) {
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(String(value || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function formatAddress(addr = {}) {
  return [addr.bno, addr.flno, addr.bnm, addr.st, addr.loc || addr.locality, addr.dst, addr.stcd, addr.pncd]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .join(', ');
}

function unavailable(result, notFoundReason, failureLabel) {
  return {
    status: 'unavailable',
    reason: result.kind === 'not_found' ? notFoundReason : `${failureLabel} (${result.code})`,
    source: SOURCE,
    transactionId: result.transactionId || null
  };
}

function mapGstinRecord(d) {
  return {
    gstin: d.gstin,
    legalName: d.lgnm || '',
    tradeName: d.tradeNam || '',
    status: d.sts || '',
    registrationDate: ddmmyyyyToIso(d.rgdt),
    cancellationDate: ddmmyyyyToIso(d.cxdt),
    constitution: d.ctb || '',
    taxpayerType: d.dty || '',
    natureOfBusiness: Array.isArray(d.nba) ? d.nba : [],
    principalAddress: formatAddress(d.pradr?.addr),
    einvoiceStatus: d.einvoiceStatus || '',
    lastUpdated: ddmmyyyyToIso(d.lstupdt)
  };
}

function mapFiling(f) {
  const p = String(f.ret_prd || '');
  return {
    returnType: String(f.rtntype || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    period: /^\d{6}$/.test(p) ? `${p.slice(2)}-${p.slice(0, 2)}` : null,
    filedOn: ddmmyyyyToIso(f.dof),
    arn: f.arn || '',
    mode: f.mof || '',
    status: f.status || '',
    valid: f.valid === 'Y'
  };
}

function financialYearOf(date) {
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() + 1 >= 4 ? year : year - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

async function searchGstin(gstin, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const r = await client.post('/gst/compliance/public/gstin/search', { gstin });
  if (!r.ok) return unavailable(r, 'GSTIN not found on GST portal', 'GST portal lookup failed');
  const d = r.body?.data?.data;
  if (!d) return { status: 'unavailable', reason: 'Empty GST portal response', source: SOURCE, transactionId: r.transactionId };
  return { status: 'ok', data: mapGstinRecord(d), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

async function trackReturns(gstin, financialYear, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const r = await client.post(`/gst/compliance/public/gstrs/track?financial_year=${encodeURIComponent(financialYear)}`, { gstin });
  if (!r.ok) {
    if (r.code === 'RET13510') {
      return { status: 'ok', data: [], source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
    }
    return unavailable(r, 'No filing records found', 'GST filing history lookup failed');
  }
  const list = r.body?.data?.data?.EFiledlist || [];
  return { status: 'ok', data: list.map(mapFiling).filter(f => f.period), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

module.exports = { searchGstin, trackReturns, financialYearOf, SOURCE };
```

- [ ] **Step 5: Run tests** → PASS.
- [ ] **Step 6: Commit**

```bash
git add backend/services/registry/gstProvider.js backend/tests/registry/gstProvider.test.js backend/tests/fixtures/sandbox/
git commit -m "feat(registry): GSTN registration and filing-history provider"
```

---

### Task 11: MCA provider

**Files:**
- Create: `backend/services/registry/mcaProvider.js`, `backend/tests/fixtures/sandbox/mca-master.json`, `backend/tests/fixtures/sandbox/mca-search.json`
- Test: `backend/tests/registry/mcaProvider.test.js`

- [ ] **Step 1: Fixtures**

`mca-master.json`:

```json
{ "code": 200, "timestamp": 1782021074236, "data": [ {
  "updated_at": 1783351002317, "@entity": "in.co.sandbox.kyc.mca.company_master_data",
  "cin": "U72900GJ2015PTC082637", "company_name": "QUICKO INFOSOFT PRIVATE LIMITED", "company_roc_code": "ROC Ahmedabad",
  "company_category": "Company limited by shares", "company_sub_category": "Non-government company", "company_class": "Private",
  "authorized_capital": 15200000, "paidup_capital": 14566670, "company_registration_date": "2015-03-19",
  "registered_office_address": "B/701, Amrapali Lakeview Tower, Vastrapur, Ahmedabad, Gujarat, 380015-India",
  "listing_status": "Unlisted", "company_status": "Active", "company_state_code": "gujarat", "company_origin": "India",
  "nic_code": "72900", "company_industrial_classification": "Business Services" } ],
  "transaction_id": "321e98ad-b002-4c4e-ad6b-34121e06c127" }
```

`mca-search.json`:

```json
{ "code": 200, "timestamp": 1783319160519, "data": { "@entity": "in.co.sandbox.kyc.mca.company_master_data_search_response",
  "records": [
    { "@entity": "in.co.sandbox.kyc.mca.company_master_data_search_result", "cin": "U72900GJ2015PTC082637", "company_name": "QUICKO INFOSOFT PRIVATE LIMITED" },
    { "@entity": "in.co.sandbox.kyc.mca.company_master_data_search_result", "cin": "U72900GJ2019PTC111111", "company_name": "QUICKO INFOSOFT SERVICES PRIVATE LIMITED" }
  ], "limit": 5, "offset": 0, "count": 2, "has_more": false },
  "transaction_id": "5979f864-959f-4cf3-9c24-ecc9f2bd6431" }
```

- [ ] **Step 2: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const mca = require('../../services/registry/mcaProvider');
const MASTER = require('../fixtures/sandbox/mca-master.json');
const SEARCH = require('../fixtures/sandbox/mca-search.json');

const fixedNow = () => new Date('2026-11-11T08:00:00Z');
const client = (result) => { const calls = []; const f = async (p, b) => { calls.push({ p, b }); return result; }; return { calls, post: f, get: f }; };

test('getCompany maps array-shaped data', async () => {
  const c = client({ ok: true, body: MASTER, transactionId: 'tx' });
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/kyc/mca/company/master-data');
  assert.equal(r.status, 'ok');
  assert.equal(r.source, 'MCA21 via Sandbox');
  assert.deepEqual(r.data, {
    cin: 'U72900GJ2015PTC082637', companyName: 'QUICKO INFOSOFT PRIVATE LIMITED', status: 'Active',
    incorporationDate: '2015-03-19', authorizedCapital: 15200000, paidUpCapital: 14566670, companyClass: 'Private',
    companyCategory: 'Company limited by shares', rocCode: 'ROC Ahmedabad', nicCode: '72900', industry: 'Business Services',
    registeredAddress: 'B/701, Amrapali Lakeview Tower, Vastrapur, Ahmedabad, Gujarat, 380015-India', listingStatus: 'Unlisted'
  });
});

test('getCompany accepts object-shaped data', async () => {
  const body = { ...MASTER, data: MASTER.data[0] };
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: client({ ok: true, body, transactionId: 'tx' }), now: fixedNow });
  assert.equal(r.data.status, 'Active');
});

test('getCompany rejects non-CIN without calling provider', async () => {
  const c = client({ ok: true });
  const r = await mca.getCompany('ACG-1117', { client: c });
  assert.equal(r.status, 'unavailable');
  assert.equal(c.calls.length, 0);
});

test('getCompany not found', async () => {
  const r = await mca.getCompany('U72900GJ2015PTC082637', { client: client({ ok: false, kind: 'not_found', code: '521', transactionId: 'tx' }) });
  assert.equal(r.reason, 'Company not found on MCA21');
});

test('findCompanyByName returns the unique exact normalised match', async () => {
  const c = client({ ok: true, body: SEARCH, transactionId: 'tx' });
  const r = await mca.findCompanyByName('Quicko Infosoft Pvt. Ltd.', { client: c, now: fixedNow });
  assert.equal(c.calls[0].p, '/kyc/mca/company/master-data/search?company_name=Quicko%20Infosoft%20Pvt.%20Ltd.');
  assert.equal(r.status, 'ok');
  assert.equal(r.data.cin, 'U72900GJ2015PTC082637');
});

test('findCompanyByName with no exact match → ambiguous candidates', async () => {
  const r = await mca.findCompanyByName('Quicko', { client: client({ ok: true, body: SEARCH, transactionId: 'tx' }) });
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.candidates.length, 2);
  assert.deepEqual(r.candidates[0], { cin: 'U72900GJ2015PTC082637', name: 'QUICKO INFOSOFT PRIVATE LIMITED' });
});

test('normaliseCompanyName', () => {
  assert.equal(mca.normaliseCompanyName('M/s. Apex & Co. Pvt. Ltd.'), 'APEX AND CO PRIVATE LIMITED');
});
```

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement**

```js
/**
 * MCA21 company master data via Sandbox. Directors, charges and litigation are
 * not offered by this provider.
 */
const { getSandboxClient } = require('./sandboxClient');

const SOURCE = 'MCA21 via Sandbox';
const CIN_RE = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const NOT_COVERED = Object.freeze({ status: 'unavailable', reason: 'Not covered by current data provider', source: null });

function normaliseCompanyName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/^M\/S\.?\s*/, '')
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => (t === 'PVT' ? 'PRIVATE' : t === 'LTD' ? 'LIMITED' : t))
    .join(' ');
}

function mapCompany(d) {
  return {
    cin: d.cin,
    companyName: d.company_name || '',
    status: d.company_status || '',
    incorporationDate: d.company_registration_date || null,
    authorizedCapital: d.authorized_capital ?? null,
    paidUpCapital: d.paidup_capital ?? null,
    companyClass: d.company_class || '',
    companyCategory: d.company_category || '',
    rocCode: d.company_roc_code || '',
    nicCode: d.nic_code || '',
    industry: d.company_industrial_classification || '',
    registeredAddress: d.registered_office_address || '',
    listingStatus: d.listing_status || ''
  };
}

async function getCompany(cin, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const clean = String(cin || '').trim().toUpperCase();
  if (!CIN_RE.test(clean)) {
    return { status: 'unavailable', reason: `MCA21 master data supports company CINs only (got ${clean || 'none'})`, source: SOURCE };
  }
  const r = await client.post('/kyc/mca/company/master-data', { cin: clean });
  if (!r.ok) {
    return {
      status: 'unavailable',
      reason: r.kind === 'not_found' ? 'Company not found on MCA21' : `MCA21 lookup failed (${r.code})`,
      source: SOURCE,
      transactionId: r.transactionId || null
    };
  }
  const d = Array.isArray(r.body?.data) ? r.body.data[0] : r.body?.data;
  if (!d) return { status: 'unavailable', reason: 'Empty MCA21 response', source: SOURCE, transactionId: r.transactionId };
  return { status: 'ok', data: mapCompany(d), source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
}

async function findCompanyByName(legalName, { client = getSandboxClient(), now = () => new Date() } = {}) {
  const name = String(legalName || '').trim();
  if (name.length < 3) return { status: 'unavailable', reason: 'Legal name too short to search MCA21', source: SOURCE };

  const r = await client.get(`/kyc/mca/company/master-data/search?company_name=${encodeURIComponent(name)}`);
  if (!r.ok) {
    return {
      status: 'unavailable',
      reason: r.kind === 'not_found' ? 'No MCA21 company matches the GST legal name' : `MCA21 search failed (${r.code})`,
      source: SOURCE,
      transactionId: r.transactionId || null
    };
  }
  const records = r.body?.data?.records || [];
  const target = normaliseCompanyName(name);
  const exact = records.filter(rec => normaliseCompanyName(rec.company_name) === target);
  if (exact.length === 1) {
    return { status: 'ok', data: { cin: exact[0].cin, companyName: exact[0].company_name }, source: SOURCE, fetchedAt: now().toISOString(), transactionId: r.transactionId };
  }
  if (records.length === 0) {
    return { status: 'unavailable', reason: 'No MCA21 company matches the GST legal name', source: SOURCE, transactionId: r.transactionId };
  }
  return {
    status: 'ambiguous',
    candidates: records.slice(0, 10).map(rec => ({ cin: rec.cin, name: rec.company_name || '' })),
    source: SOURCE,
    transactionId: r.transactionId
  };
}

module.exports = { getCompany, findCompanyByName, normaliseCompanyName, NOT_COVERED, SOURCE };
```

- [ ] **Step 5: Run tests** → PASS.
- [ ] **Step 6: Commit**

```bash
git add backend/services/registry/mcaProvider.js backend/tests/registry/mcaProvider.test.js backend/tests/fixtures/sandbox/mca-*.json
git commit -m "feat(registry): MCA21 master data provider with exact-name CIN resolution"
```

---

### Task 12: Filing metrics

**Files:**
- Create: `backend/services/registry/filingMetrics.js`
- Test: `backend/tests/registry/filingMetrics.test.js`

Window: the last 12 months of tax periods whose due date has passed as of `asOf` (12 monthly or 4 quarterly periods), not before the registration month.

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeFilingMetrics } = require('../../services/registry/filingMetrics');

const asOf = new Date('2026-11-11T00:00:00Z'); // Oct GSTR-1 due Nov 11 (not passed), Oct GSTR-3B due Nov 20
const monthsBack = (n) => { const out = []; let y = 2026, m = 9; for (let i = 0; i < n; i++) { out.push([y, m]); m -= 1; if (m === 0) { m = 12; y -= 1; } } return out; };
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const next = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);

function monthlyFilings({ skip3b = [], late3bDays = 0 } = {}) {
  const out = [];
  for (const [y, m] of monthsBack(12)) {
    const [ny, nm] = next(y, m);
    const period = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ returnType: 'GSTR1', period, filedOn: iso(ny, nm, 10), status: 'Filed', valid: true });
    if (!skip3b.includes(period)) out.push({ returnType: 'GSTR3B', period, filedOn: iso(ny, nm, 20 + late3bDays), status: 'Filed', valid: true });
  }
  return out;
}

test('regular monthly filer', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings(), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.frequency, 'monthly');
  assert.equal(r.primary.returnType, 'GSTR3B');
  assert.equal(r.primary.expectedPeriods, 12);
  assert.deepEqual(r.primary.missingPeriods, []);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('late GSTR-3B by 8 days → IRREGULAR', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings({ late3bDays: 8 }), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.primary.lateFilings, 12);
  assert.equal(r.primary.averageDaysLate, 8);
  assert.equal(r.filingDiscipline, 'IRREGULAR');
});

test('three missing GSTR-3B → DELINQUENT', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings({ skip3b: ['2026-09', '2026-05', '2026-01'] }), registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.deepEqual(r.primary.missingPeriods, ['2026-01', '2026-05', '2026-09']);
  assert.equal(r.filingDiscipline, 'DELINQUENT');
});

test('quarterly (QRMP) filer detected from quarter-end periods', () => {
  const filings = ['2025-12', '2026-03', '2026-06', '2026-09'].flatMap(p => {
    const [y, m] = p.split('-').map(Number); const [ny, nm] = next(y, m);
    return [{ returnType: 'GSTR1', period: p, filedOn: iso(ny, nm, 13), status: 'Filed', valid: true },
            { returnType: 'GSTR3B', period: p, filedOn: iso(ny, nm, 22), status: 'Filed', valid: true }];
  });
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Regular', asOf });
  assert.equal(r.frequency, 'quarterly');
  assert.equal(r.primary.expectedPeriods, 4);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('composition dealer uses CMP08 quarterly', () => {
  const filings = ['2025-12', '2026-03', '2026-06', '2026-09'].map(p => {
    const [y, m] = p.split('-').map(Number); const [ny, nm] = next(y, m);
    return { returnType: 'CMP08', period: p, filedOn: iso(ny, nm, 15), status: 'Filed', valid: true };
  });
  const r = computeFilingMetrics({ filings, registrationDate: '2017-07-01', taxpayerType: 'Composition', asOf });
  assert.equal(r.primary.returnType, 'CMP08');
  assert.equal(r.gstr1, null);
  assert.equal(r.filingDiscipline, 'REGULAR');
});

test('window starts at registration month', () => {
  const r = computeFilingMetrics({ filings: monthlyFilings(), registrationDate: '2026-07-15', taxpayerType: 'Regular', asOf });
  assert.equal(r.primary.expectedPeriods, 3); // Jul, Aug, Sep 2026
});

test('no filing data → UNKNOWN', () => {
  assert.equal(computeFilingMetrics({ filings: null }).filingDiscipline, 'UNKNOWN');
});

test('registered after window → UNKNOWN (insufficient history)', () => {
  const r = computeFilingMetrics({ filings: [], registrationDate: '2026-10-20', taxpayerType: 'Regular', asOf });
  assert.equal(r.filingDiscipline, 'UNKNOWN');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
/**
 * GST filing discipline over the last 12 months, from public filing history.
 * Due dates: GSTR-1 11th (monthly) / 13th (quarterly) of the following month;
 * GSTR-3B 20th / 24th; CMP-08 18th after the quarter.
 */
const DUE_DAY = {
  GSTR1: { monthly: 11, quarterly: 13 },
  GSTR3B: { monthly: 20, quarterly: 24 },
  CMP08: { quarterly: 18 }
};
const QUARTER_END_MONTHS = new Set([3, 6, 9, 12]);
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const periodKey = (y, m) => `${y}-${pad(m)}`;
const parsePeriod = (p) => p.split('-').map(Number);

function dueDate(y, m, returnType, frequency) {
  const [dy, dm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return Date.UTC(dy, dm - 1, DUE_DAY[returnType][frequency]);
}

function detectFrequency(returnType, filings) {
  if (returnType === 'CMP08') return 'quarterly';
  const months = filings.filter(f => f.returnType === returnType).map(f => parsePeriod(f.period)[1]);
  if (months.length > 0 && months.every(m => QUARTER_END_MONTHS.has(m))) return 'quarterly';
  return 'monthly';
}

function expectedPeriods(returnType, frequency, asOf, registrationDate) {
  const asOfMs = asOf.getTime();
  const reg = registrationDate ? new Date(`${registrationDate}T00:00:00Z`) : null;
  const regKey = reg ? periodKey(reg.getUTCFullYear(), reg.getUTCMonth() + 1) : null;
  const windowStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 12, 1));
  const out = [];
  let y = windowStart.getUTCFullYear();
  let m = windowStart.getUTCMonth() + 1;
  for (let i = 0; i < 14; i++) {
    const isPeriod = frequency === 'monthly' || QUARTER_END_MONTHS.has(m);
    const key = periodKey(y, m);
    if (isPeriod && dueDate(y, m, returnType, frequency) < asOfMs && (!regKey || key >= regKey)) out.push(key);
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
  return frequency === 'monthly' ? out.slice(-12) : out.slice(-4);
}

function computeReturnMetrics(returnType, filings, { asOf, registrationDate }) {
  const frequency = detectFrequency(returnType, filings);
  const expected = expectedPeriods(returnType, frequency, asOf, registrationDate);
  const filedByPeriod = new Map();
  for (const f of filings) {
    if (f.returnType === returnType && f.valid !== false && /filed/i.test(f.status || 'Filed')) filedByPeriod.set(f.period, f);
  }

  const missingPeriods = [];
  const lateDays = [];
  for (const key of expected) {
    const f = filedByPeriod.get(key);
    if (!f) { missingPeriods.push(key); continue; }
    const [y, m] = parsePeriod(key);
    const days = f.filedOn ? Math.ceil((Date.parse(`${f.filedOn}T00:00:00Z`) - dueDate(y, m, returnType, frequency)) / DAY_MS) : 0;
    if (days > 0) lateDays.push(days);
  }
  const filedPeriods = [...filedByPeriod.keys()].sort();

  return {
    returnType,
    frequency,
    expectedPeriods: expected.length,
    filedPeriods: expected.length - missingPeriods.length,
    missingPeriods,
    lateFilings: lateDays.length,
    averageDaysLate: lateDays.length ? Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10 : 0,
    lastFiledPeriod: filedPeriods.length ? filedPeriods[filedPeriods.length - 1] : null
  };
}

function computeFilingMetrics({ filings, registrationDate = null, taxpayerType = '', asOf = new Date() } = {}) {
  if (!Array.isArray(filings)) {
    return { frequency: null, primary: null, gstr1: null, filingDiscipline: 'UNKNOWN' };
  }
  const isComposition = /composition/i.test(taxpayerType || '');
  const primary = computeReturnMetrics(isComposition ? 'CMP08' : 'GSTR3B', filings, { asOf, registrationDate });
  const gstr1 = isComposition ? null : computeReturnMetrics('GSTR1', filings, { asOf, registrationDate });

  let filingDiscipline;
  if (primary.expectedPeriods === 0) {
    filingDiscipline = 'UNKNOWN';
  } else {
    const missing = Math.max(primary.missingPeriods.length, gstr1 ? gstr1.missingPeriods.length : 0);
    if (missing >= 3) filingDiscipline = 'DELINQUENT';
    else if (missing >= 1 || primary.averageDaysLate > 5) filingDiscipline = 'IRREGULAR';
    else filingDiscipline = 'REGULAR';
  }

  return { frequency: primary.frequency, primary, gstr1, filingDiscipline };
}

module.exports = { computeFilingMetrics };
```

- [ ] **Step 4: Run tests** → PASS. If the window test fails by one period, check `expectedPeriods` against the dates in the test comments; the test cases are the source of truth.
- [ ] **Step 5: Commit**

```bash
git add backend/services/registry/filingMetrics.js backend/tests/registry/filingMetrics.test.js
git commit -m "feat(registry): GST filing discipline metrics"
```

---

### Task 13: Registry service with caching

**Files:**
- Create: `backend/services/registry/registryService.js`
- Test: `backend/tests/registry/registryService.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore } = require('../../platform/tableStore');
const { getRegistryReport } = require('../../services/registry/registryService');

const GSTIN = '24AAACQ1234A1Z5';
const now = () => Date.parse('2026-11-11T08:00:00Z');
const store = () => createFileTableStore(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')));
const ok = (data) => ({ status: 'ok', data, source: 'test', fetchedAt: '2026-11-11T08:00:00.000Z', transactionId: 'tx' });

function providers({ constitution = 'Private Limited Company', gstStatus = 'ok', mcaSearch } = {}) {
  const calls = { search: 0, track: 0, company: 0, find: 0 };
  return {
    calls,
    gst: {
      searchGstin: async () => { calls.search++; return gstStatus === 'ok' ? ok({ legalName: 'QUICKO INFOSOFT PRIVATE LIMITED', constitution, status: 'Active', registrationDate: '2017-07-01', taxpayerType: 'Regular' }) : { status: 'unavailable', reason: 'down', source: 'test' }; },
      trackReturns: async () => { calls.track++; return ok([]); },
      financialYearOf: () => 'FY 2026-27'
    },
    mca: {
      findCompanyByName: async () => { calls.find++; return mcaSearch || ok({ cin: 'U72900GJ2015PTC082637', companyName: 'X' }); },
      getCompany: async (cin) => { calls.company++; return ok({ cin, status: 'Active' }); }
    }
  };
}

test('builds a full report for a company', async () => {
  const p = providers();
  const r = await getRegistryReport(GSTIN, { store: store(), providers: p, now });
  assert.equal(r.gstin, GSTIN);
  assert.equal(r.pan, 'AAACQ1234A');
  assert.equal(r.gst.status, 'ok');
  assert.equal(r.filings.status, 'ok');
  assert.equal(p.calls.track, 2); // current + previous FY
  assert.equal(r.mca.data.cin, 'U72900GJ2015PTC082637');
  assert.equal(r.directors.status, 'unavailable');
  assert.ok(r.filingMetrics);
});

test('proprietorship skips MCA', async () => {
  const p = providers({ constitution: 'Proprietorship' });
  const r = await getRegistryReport(GSTIN, { store: store(), providers: p, now });
  assert.equal(r.mca.reason, 'Not an MCA-registered entity type');
  assert.equal(p.calls.find, 0);
});

test('explicit cin bypasses name search', async () => {
  const p = providers();
  const r = await getRegistryReport(GSTIN, { cin: 'U72900GJ2019PTC111111', store: store(), providers: p, now });
  assert.equal(p.calls.find, 0);
  assert.equal(r.mca.data.cin, 'U72900GJ2019PTC111111');
});

test('ambiguous MCA match is returned and not cached', async () => {
  const s = store();
  const amb = { status: 'ambiguous', candidates: [{ cin: 'A', name: 'a' }], source: 'test' };
  const p = providers({ mcaSearch: amb });
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  const r = await getRegistryReport(GSTIN, { store: s, providers: p, now });
  assert.equal(r.mca.status, 'ambiguous');
  assert.equal(p.calls.find, 2);
});

test('second call is served from cache', async () => {
  const s = store();
  const p = providers();
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  const r = await getRegistryReport(GSTIN, { store: s, providers: p, now });
  assert.equal(p.calls.search, 1);
  assert.equal(p.calls.track, 2);
  assert.equal(r.gst.cached, true);
  assert.equal(r.mca.cached, true);
});

test('filings cache expires after 24h but GST does not', async () => {
  const s = store();
  const p = providers();
  await getRegistryReport(GSTIN, { store: s, providers: p, now });
  await getRegistryReport(GSTIN, { store: s, providers: p, now: () => now() + 25 * 3600 * 1000 });
  assert.equal(p.calls.search, 1);
  assert.equal(p.calls.track, 4);
});

test('GST outage → sections unavailable, never fabricated', async () => {
  const r = await getRegistryReport(GSTIN, { store: store(), providers: providers({ gstStatus: 'down' }), now });
  assert.equal(r.gst.status, 'unavailable');
  assert.equal(r.mca.status, 'unavailable');
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
/**
 * Assembles a registry report for a GSTIN from real providers, with caching
 * and provenance. Sections fail independently and are never fabricated.
 */
const { getTableStore } = require('../../platform/tableStore');
const gstProvider = require('./gstProvider');
const mcaProvider = require('./mcaProvider');
const { computeFilingMetrics } = require('./filingMetrics');

const HOUR = 3600 * 1000;
const TTL = { gst: 7 * 24 * HOUR, filings: 24 * HOUR, mca: 7 * 24 * HOUR };
const COMPANY_CONSTITUTION = /(private limited|public limited|limited liability partnership|\bllp\b|one person company|unlimited company|public sector undertaking)/i;
const NOT_COVERED = mcaProvider.NOT_COVERED;

async function cached(store, gstin, section, ttlMs, fetcher, now) {
  try {
    const hit = await store.getEntity('registrycache', gstin, section);
    if (hit && now() - Date.parse(hit.storedAt) < ttlMs) {
      return { ...JSON.parse(hit.payload), cached: true };
    }
  } catch (err) {
    console.warn(`[Registry] Cache read failed for ${gstin}/${section}: ${err.message}`);
  }
  const fresh = await fetcher();
  if (fresh.status === 'ok') {
    await store.upsertEntity('registrycache', {
      partitionKey: gstin,
      rowKey: section,
      payload: JSON.stringify(fresh),
      storedAt: new Date(now()).toISOString()
    }).catch(err => console.warn(`[Registry] Cache write failed for ${gstin}/${section}: ${err.message}`));
  }
  return { ...fresh, cached: false };
}

async function fetchFilings(gstin, gst, now) {
  const current = gst.financialYearOf(new Date(now()));
  const startYear = Number(current.slice(3, 7));
  const previous = `FY ${startYear - 1}-${String(startYear % 100).padStart(2, '0')}`;
  const results = await Promise.all([gst.trackReturns(gstin, previous), gst.trackReturns(gstin, current)]);
  const okResults = results.filter(r => r.status === 'ok');
  if (okResults.length === 0) return results[1];

  const seen = new Set();
  const data = [];
  for (const f of okResults.flatMap(r => r.data)) {
    const key = `${f.returnType}|${f.period}|${f.arn}`;
    if (!seen.has(key)) { seen.add(key); data.push(f); }
  }
  return {
    status: 'ok',
    data,
    partial: okResults.length < results.length,
    source: okResults[0].source,
    fetchedAt: new Date(now()).toISOString(),
    transactionId: okResults.map(r => r.transactionId).filter(Boolean).join(',')
  };
}

async function resolveMca(store, gstin, gst, cin, mca, now) {
  if (gst.status !== 'ok') {
    return { status: 'unavailable', reason: 'GST registration unavailable, so the MCA entity could not be resolved', source: null };
  }
  if (cin) {
    const clean = String(cin).trim().toUpperCase();
    return cached(store, gstin, `mca:${clean}`, TTL.mca, () => mca.getCompany(clean), now);
  }
  if (!COMPANY_CONSTITUTION.test(gst.data.constitution || '')) {
    return { status: 'unavailable', reason: 'Not an MCA-registered entity type', source: null };
  }
  return cached(store, gstin, 'mca:auto', TTL.mca, async () => {
    const found = await mca.findCompanyByName(gst.data.legalName);
    if (found.status !== 'ok') return found;
    return mca.getCompany(found.data.cin);
  }, now);
}

async function getRegistryReport(gstin, {
  cin = null,
  store = getTableStore(),
  providers = { gst: gstProvider, mca: mcaProvider },
  now = () => Date.now()
} = {}) {
  const g = String(gstin).trim().toUpperCase();
  const gst = await cached(store, g, 'gst', TTL.gst, () => providers.gst.searchGstin(g), now);
  const filings = await cached(store, g, 'filings', TTL.filings, () => fetchFilings(g, providers.gst, now), now);
  const mca = await resolveMca(store, g, gst, cin, providers.mca, now);

  const filingMetrics = computeFilingMetrics({
    filings: filings.status === 'ok' ? filings.data : null,
    registrationDate: gst.status === 'ok' ? gst.data.registrationDate : null,
    taxpayerType: gst.status === 'ok' ? gst.data.taxpayerType : '',
    asOf: new Date(now())
  });

  return {
    gstin: g,
    pan: g.slice(2, 12),
    gst,
    filings,
    filingMetrics,
    mca,
    directors: NOT_COVERED,
    charges: NOT_COVERED,
    litigation: NOT_COVERED,
    generatedAt: new Date(now()).toISOString()
  };
}

module.exports = { getRegistryReport };
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/services/registry/registryService.js backend/tests/registry/registryService.test.js
git commit -m "feat(registry): registry report service with per-section caching"
```

---

### Task 14: Registry score adjustments

**Files:**
- Create: `backend/services/registry/registryAdjustments.js`
- Test: `backend/tests/registry/registryAdjustments.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { applyRegistryAdjustments } = require('../../services/registry/registryAdjustments');

const sec = (data) => ({ status: 'ok', data, source: 'GSTN via Sandbox', fetchedAt: '2026-11-11T08:00:00.000Z', transactionId: 'tx1' });
const report = ({ gstStatus = 'Active', mcaStatus = 'Active', discipline = 'REGULAR', mca } = {}) => ({
  gst: sec({ status: gstStatus, cancellationDate: '2026-06-26' }),
  filings: sec([]),
  filingMetrics: { filingDiscipline: discipline },
  mca: mca || sec({ status: mcaStatus })
});
const decision = (score) => ({ score, riskLevel: 'X', citations: ['existing'] });

test('regular filer, active company → +15', () => {
  const d = applyRegistryAdjustments(decision(700), report());
  assert.equal(d.score, 715);
  assert.equal(d.riskLevel, 'MEDIUM');
  assert.equal(d.registryAdjustments.length, 1);
  assert.ok(d.citations.some(c => c.includes('txn tx1')));
});

test('struck-off company and delinquent filer', () => {
  const d = applyRegistryAdjustments(decision(800), report({ mcaStatus: 'Strike Off', discipline: 'DELINQUENT' }));
  assert.equal(d.score, 590);
  assert.equal(d.riskLevel, 'HIGH');
});

test('cancelled GST caps at 479 with red flag', () => {
  const d = applyRegistryAdjustments(decision(850), report({ gstStatus: 'Cancelled' }));
  assert.equal(d.score, 479);
  assert.equal(d.riskLevel, 'HIGH');
  assert.ok(d.redFlags.includes('GST registration Cancelled since 2026-06-26'));
});

test('clamps to 320..885', () => {
  assert.equal(applyRegistryAdjustments(decision(880), report()).score, 885);
  assert.equal(applyRegistryAdjustments(decision(330), report({ mcaStatus: 'Dormant', discipline: 'DELINQUENT' })).score, 320);
});

test('unavailable sections add caveats and no points', () => {
  const r = { gst: { status: 'unavailable' }, filings: { status: 'unavailable' }, filingMetrics: { filingDiscipline: 'UNKNOWN' }, mca: { status: 'unavailable', reason: 'down' } };
  const d = applyRegistryAdjustments(decision(700), r);
  assert.equal(d.score, 700);
  assert.deepEqual(d.caveats, ['Not verified: GST registration', 'Not verified: MCA21 company status', 'Not verified: GST filing history']);
});

test('non-MCA entity type is not a caveat', () => {
  const d = applyRegistryAdjustments(decision(700), report({ mca: { status: 'unavailable', reason: 'Not an MCA-registered entity type' } }));
  assert.deepEqual(d.caveats, []);
});

test('missing report or score returns decision unchanged', () => {
  const dec = decision(700);
  assert.equal(applyRegistryAdjustments(dec, null), dec);
  assert.deepEqual(applyRegistryAdjustments({ score: null }, report()), { score: null });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
/**
 * Deterministic score adjustments from verified registry facts. Applied after
 * synthesis so they do not depend on the LLM following instructions.
 */
const FILING_POINTS = { DELINQUENT: -60, IRREGULAR: -20, REGULAR: 15 };
const MIN_SCORE = 320;
const MAX_SCORE = 885;
const NOT_MCA_ENTITY = 'Not an MCA-registered entity type';

const riskFor = (score) => (score >= 750 ? 'LOW' : score >= 620 ? 'MEDIUM' : 'HIGH');
const cite = (section) => `${section.source} · fetched ${section.fetchedAt} · txn ${section.transactionId}`;

function applyRegistryAdjustments(decision, report) {
  if (!decision || typeof decision.score !== 'number' || !report) return decision;

  const adjustments = [];
  const caveats = [...(decision.caveats || [])];
  const redFlags = [...(decision.redFlags || [])];
  let score = decision.score;
  let cap = null;

  const { gst, mca, filings, filingMetrics } = report;

  if (gst?.status === 'ok') {
    const status = gst.data.status || '';
    if (/cancel|suspend/i.test(status)) {
      cap = 479;
      redFlags.push(`GST registration ${status}${gst.data.cancellationDate ? ` since ${gst.data.cancellationDate}` : ''}`);
      adjustments.push({ label: `GST registration ${status}`, points: 0, cap: 479, citation: cite(gst) });
    }
  } else {
    caveats.push('Not verified: GST registration');
  }

  if (mca?.status === 'ok' && mca.data.status) {
    if (!/^active$/i.test(mca.data.status.trim())) {
      score -= 150;
      adjustments.push({ label: `MCA21 company status: ${mca.data.status}`, points: -150, citation: cite(mca) });
    }
  } else if (mca?.reason !== NOT_MCA_ENTITY) {
    caveats.push('Not verified: MCA21 company status');
  }

  const discipline = filingMetrics?.filingDiscipline;
  if (discipline in FILING_POINTS) {
    score += FILING_POINTS[discipline];
    adjustments.push({ label: `GST filing discipline: ${discipline}`, points: FILING_POINTS[discipline], citation: cite(filings) });
  } else {
    caveats.push('Not verified: GST filing history');
  }

  score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
  if (cap !== null) score = Math.min(score, cap);

  return {
    ...decision,
    score,
    riskLevel: riskFor(score),
    registryAdjustments: adjustments,
    caveats,
    redFlags,
    citations: [
      ...(decision.citations || []),
      ...adjustments.map(a => `[Registry] ${a.label}${a.points ? ` (${a.points > 0 ? '+' : ''}${a.points} pts)` : ''} — ${a.citation}`)
    ]
  };
}

module.exports = { applyRegistryAdjustments };
```

- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit**

```bash
git add backend/services/registry/registryAdjustments.js backend/tests/registry/registryAdjustments.test.js
git commit -m "feat(registry): deterministic score adjustments from registry facts"
```

---

### Task 15: Demo mode module

**Files:**
- Create: `backend/platform/demoMode.js`, `backend/demo/demoEntities.js`
- Test: `backend/tests/demoEntities.test.js`

- [ ] **Step 1: Move presets.** Create `backend/demo/demoEntities.js` by moving the `KNOWN_GSTINS` object literal from `backend/services/scraperService.js` (starts at line 31, `const KNOWN_GSTINS = {`, through its closing `};`) verbatim, then append:

```js
const SAMPLE_SOURCE = 'Sample data (demo mode)';

function isDemoEntity(gstin) {
  return Boolean(KNOWN_GSTINS[String(gstin || '').trim().toUpperCase()]);
}

function demoRegistryReport(gstin) {
  const g = String(gstin).trim().toUpperCase();
  const k = KNOWN_GSTINS[g];
  if (!k) return null;
  const fetchedAt = new Date().toISOString();
  const section = (data) => ({ status: 'ok', data, source: SAMPLE_SOURCE, fetchedAt, transactionId: 'sample', cached: false });
  const unavailable = { status: 'unavailable', reason: 'Not included in sample data', source: SAMPLE_SOURCE };
  return {
    gstin: g,
    pan: g.slice(2, 12),
    sampleData: true,
    gst: section({ gstin: g, legalName: k.legalEntityName, tradeName: k.tradeName || '', status: 'Active', registrationDate: k.incorporationDate || null, cancellationDate: null, constitution: k.cin && k.cin.startsWith('U') ? 'Private Limited Company' : 'Proprietorship', taxpayerType: k.taxpayerType || 'Regular', natureOfBusiness: [], principalAddress: k.principalPlace || '', einvoiceStatus: '', lastUpdated: null }),
    filings: section([]),
    filingMetrics: { frequency: 'monthly', primary: null, gstr1: null, filingDiscipline: 'REGULAR' },
    mca: k.cin && /^[LU]\d{5}/.test(k.cin) ? section({ cin: k.cin, companyName: k.legalEntityName, status: k.mcaStatus || 'Active', incorporationDate: k.incorporationDate || null }) : { status: 'unavailable', reason: 'Not an MCA-registered entity type', source: null },
    directors: unavailable,
    charges: unavailable,
    litigation: unavailable,
    generatedAt: fetchedAt
  };
}

function demoFinancials(gstin) {
  const g = String(gstin).trim().toUpperCase();
  const k = KNOWN_GSTINS[g];
  if (!k || !Array.isArray(k.monthlyCredits)) return null;
  const totalRevenue = k.monthlyCredits.reduce((a, b) => a + b, 0);
  return {
    businessName: k.legalEntityName,
    gstin: g,
    sampleData: true,
    taxpayerType: k.taxpayerType || 'Regular',
    monthlyCredits: k.monthlyCredits,
    monthlyDebits: k.monthlyDebits,
    totalRevenue,
    bankClosingBalance: k.closingBalance,
    dailyClosingBalances: k.dailyClosingBalances,
    sanctionedOdLimit: k.sanctionedOdLimit,
    peakOdUsage: k.peakOdUsage,
    gstr1OutwardTaxable: k.gstr1OutwardTaxable,
    gstr1DeclaredTax: k.gstr1DeclaredTax,
    gstr3bTaxPaid: k.gstr3bTaxPaid,
    monthlyEmiObligations: k.monthlyEmiObligations,
    inwardBounces: k.inwardBounces || 0
  };
}

module.exports = { KNOWN_GSTINS, isDemoEntity, demoRegistryReport, demoFinancials, SAMPLE_SOURCE };
```

`backend/platform/demoMode.js`:

```js
function isDemoMode() {
  return process.env.DEMO_MODE === 'true';
}

module.exports = { isDemoMode };
```

- [ ] **Step 2: Test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { demoRegistryReport, demoFinancials, isDemoEntity } = require('../demo/demoEntities');

test('preset is a demo entity with sample provenance', () => {
  assert.equal(isDemoEntity('27AAHCE5539J1ZA'), true);
  const r = demoRegistryReport('27AAHCE5539J1ZA');
  assert.equal(r.sampleData, true);
  assert.equal(r.gst.source, 'Sample data (demo mode)');
  assert.equal(demoFinancials('27AAHCE5539J1ZA').sampleData, true);
});

test('unknown GSTIN is not a demo entity', () => {
  assert.equal(isDemoEntity('29ABCDE1234F1Z5'), false);
  assert.equal(demoRegistryReport('29ABCDE1234F1Z5'), null);
});
```

Run: `npm --prefix backend test` → PASS (scraperService still has its own copy until Task 19; that's fine).

- [ ] **Step 3: Commit**

```bash
git add backend/demo/demoEntities.js backend/platform/demoMode.js backend/tests/demoEntities.test.js
git commit -m "feat(demo): isolate preset entities behind DEMO_MODE"
```

---

### Task 16: Registry route

**Files:**
- Create: `backend/controllers/registryController.js`
- Modify: `backend/server.js` (alternate-data routes)
- Test: `backend/tests/routes.registry.test.js`

- [ ] **Step 1: Implement controller**

```js
const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoRegistryReport } = require('../demo/demoEntities');

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

async function getRegistry(req, res) {
  const gstin = String(req.params.gstin || '').trim().toUpperCase();
  if (!GSTIN_RE.test(gstin)) {
    return res.status(400).json({ code: 'INVALID_GSTIN', error: 'Enter a valid 15-character GSTIN.' });
  }
  if (isDemoMode()) {
    const sample = demoRegistryReport(gstin);
    if (sample) return res.json({ status: 'success', registryReport: sample });
  }
  try {
    const cin = typeof req.query.cin === 'string' && req.query.cin.trim() ? req.query.cin.trim().toUpperCase() : null;
    const registryReport = await getRegistryReport(gstin, { cin });
    return res.json({ status: 'success', registryReport });
  } catch (err) {
    console.error('[Registry] Report failed:', err.message);
    return res.status(503).json({ code: 'REGISTRY_UNAVAILABLE', error: 'Registry lookup is temporarily unavailable.' });
  }
}

module.exports = { getRegistry, GSTIN_RE };
```

- [ ] **Step 2: Routes in `backend/server.js`**

Delete the `require('./services/scraperService')` line, the `/api/v1/alternate-data/gst/:gstin` route and the existing `/api/v1/alternate-data/gstin-probe/:gstin` route. Wrap the AA route in demo mode and add the registry routes:

```js
const { getRegistry } = require('./controllers/registryController');
const { isDemoMode } = require('./platform/demoMode');

if (isDemoMode()) {
  app.get('/api/v1/alternate-data/account-aggregator/:businessId', (req, res) => {
    /* existing handler body unchanged */
  });
}

app.get('/api/v1/registry/gstin/:gstin', requireSession, getRegistry);
app.get('/api/v1/alternate-data/gstin-probe/:gstin', requireSession, getRegistry);
```

- [ ] **Step 3: Route test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
const app = require('../server');
const { issueSessionToken } = require('../platform/session');

test('registry route validates GSTIN and requires a session', async () => {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/v1/registry/gstin/24AAACQ1234A1Z5`)).status, 401);
    const auth = { authorization: `Bearer ${issueSessionToken({ id: 'u', email: 'a@b.com' })}` };
    assert.equal((await fetch(`${base}/api/v1/registry/gstin/NOTAGSTIN`, { headers: auth })).status, 400);
  } finally {
    server.close();
  }
});
```

Run: `npm --prefix backend test` → PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/controllers/registryController.js backend/server.js backend/tests/routes.registry.test.js
git commit -m "feat(registry): GET /api/v1/registry/gstin/:gstin; remove fabricated GST timeline route"
```

---

### Task 17: Ingestion agent uses real registry data

**Files:**
- Modify: `backend/agents/ingestionAgent.js:6,40-42,111-263,273,302`, `backend/utils/grokClient.js:9,93-97`

- [ ] **Step 1: Imports** — replace line 6 with:

```js
const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoFinancials, demoRegistryReport } = require('../demo/demoEntities');
```

- [ ] **Step 2: No default GSTIN** — in `extractHeuristicFinancials` (line 42) change the fallback `: "27AAHCE5539J1ZA")` to `: null)`. In Route B (line 166) change `(manualData.gstin || gstin || '27AADCB2230M1Z2').toUpperCase()` to `(manualData.gstin || gstin || '').toUpperCase() || null`.

- [ ] **Step 3: Route A** — rename `liveScraperData` to `registryReport` throughout `ingestAlternateData` and replace the scraper block (lines 149–157) with:

```js
    if (enableScraper && resolvedGstin) {
      try {
        registryReport = isDemoMode() && demoRegistryReport(resolvedGstin)
          ? demoRegistryReport(resolvedGstin)
          : await getRegistryReport(resolvedGstin);
      } catch (regErr) {
        console.warn(`[Fetcha: Registry Notice]: ${regErr.message}`);
      }
    }
```

In the prompt (line 273) replace the `Live Scraped Web Intelligence` line with:

```js
${registryReport ? `Verified registry facts (GSTN / MCA21, with provenance). Use for entity identity only; do not derive financial figures from them:\n${JSON.stringify({ gst: registryReport.gst, mca: registryReport.mca, filingMetrics: registryReport.filingMetrics }, null, 2)}` : ''}
```

and the schema line `"scrapedRegistryData": ...` with `"registryReport": null`. After each successful parse (`return structuredFinancials;` for Grok and Gemini) and before the heuristic return, attach the report by replacing those three returns with:

```js
        return { ...structuredFinancials, registryReport, scrapedRegistryData: registryReport };
```

and

```js
  return { ...extractHeuristicFinancials(rawContentToParse, originalFileName), registryReport, scrapedRegistryData: registryReport };
```

- [ ] **Step 4: Route C** — replace the whole Route C body (lines 200–260) with:

```js
  else if (gstin || (typeof manualData === 'string' && manualData.match(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i))) {
    const targetGstin = (gstin || manualData).trim().toUpperCase();
    if (isDemoMode() && demoFinancials(targetGstin)) {
      const sample = demoFinancials(targetGstin);
      const report = demoRegistryReport(targetGstin);
      return { ...sample, totalCreditVolume: sample.totalRevenue, monthsAnalyzed: sample.monthlyCredits.length, transactions: [], registryReport: report, scrapedRegistryData: report };
    }
    console.log(`[Fetcha] Registry screening for ${targetGstin} (no statement uploaded)`);
    return { reportType: 'REGISTRY_SCREENING', gstin: targetGstin, registryReport: await getRegistryReport(targetGstin) };
  }
```

- [ ] **Step 5: grokClient tools** — in `backend/utils/grokClient.js` replace line 9 with `const { getRegistryReport } = require('../services/registry/registryService');` and lines 93–97 with:

```js
            if (toolCall.function.name === 'scrape_gstin_registry') {
              toolResult = await getRegistryReport(args.gstin);
            } else if (toolCall.function.name === 'query_mca_master_data') {
              toolResult = { status: 'unavailable', reason: 'Use the GSTIN registry report; MCA is resolved from it.' };
            }
```

- [ ] **Step 6: Verify load, commit**

Run: `node -e "require('./backend/agents/ingestionAgent'); require('./backend/utils/grokClient')"` → no error. `npm --prefix backend test` → PASS.

```bash
git add backend/agents/ingestionAgent.js backend/utils/grokClient.js
git commit -m "feat(fetcha): real registry reports in ingestion; GSTIN-only runs become registry screenings"
```

---

### Task 18: Credit controller — screening, adjustments, no fabricated fallback

**Files:**
- Modify: `backend/controllers/creditController.js`

- [ ] **Step 1: Import** at top:

```js
const { applyRegistryAdjustments } = require('../services/registry/registryAdjustments');
```

- [ ] **Step 2: Screening short-circuit** — immediately after `const structuredData = await ingestAlternateData(...)` (line 72) insert:

```js
      if (structuredData.reportType === 'REGISTRY_SCREENING') {
        const report = structuredData.registryReport;
        const screeningPayload = {
          status: 'success',
          reportType: 'REGISTRY_SCREENING',
          gstin: structuredData.gstin,
          businessName: report?.gst?.status === 'ok' ? report.gst.data.legalName : structuredData.gstin,
          registryReport: report
        };
        addHistoryRecord({
          userId, userEmail, userName: userName || userEmail, userRole: userRole || 'Institutional Credit Officer',
          name: screeningPayload.businessName, gstin: screeningPayload.gstin, score: null, risk: null,
          reason: 'Registry screening (no statement uploaded)', fullPayload: screeningPayload
        });
        res.write(`data: ${JSON.stringify({ step: 4, payload: screeningPayload })}\n\n`);
        cleanup();
        return res.end();
      }
```

- [ ] **Step 3: Apply adjustments** — replace `const finalDecision = await synthesizeScore(structuredData, calculationMatrix, scraperData);` with:

```js
      const finalDecision = applyRegistryAdjustments(
        await synthesizeScore(structuredData, calculationMatrix, structuredData.registryReport),
        structuredData.registryReport
      );
```

and add `registryReport: structuredData.registryReport || null,` to `responsePayload`. Change `gstin: structuredData.gstin || gstin || '27AAHCE5539J1ZA',` in `recordToSave` to `gstin: structuredData.gstin || gstin || null,`. Delete the `scraperData` parsing block (lines 23–30).

- [ ] **Step 4: Fallback without fabrication** — replace the `catch (ingErr) { fallbackStructured = { ... 9680000 ... }; }` block with:

```js
      } catch (ingErr) {
        console.warn('[Credit Engine] Fallback extraction failed:', ingErr.message);
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        res.write(`data: ${JSON.stringify({ step: 99, error: 'Could not extract financials from the uploaded statement. Please upload a clearer statement (PDF or CSV).' })}\n\n`);
        cleanup();
        return res.end();
      }
      if (fallbackStructured.reportType === 'REGISTRY_SCREENING') {
        res.write(`data: ${JSON.stringify({ step: 99, error: 'Registry screening could not be completed. Please retry.' })}\n\n`);
        cleanup();
        return res.end();
      }
```

In the fallback path: replace `synthesizeScore(fallbackStructured, deterministic, scraperData, { deterministicOnly: true })` with `applyRegistryAdjustments(await synthesizeScore(fallbackStructured, deterministic, fallbackStructured.registryReport, { deterministicOnly: true }), fallbackStructured.registryReport)`; replace `gstin: fallbackStructured.gstin || gstin || '27AADCB2230M1Z2',` with `gstin: fallbackStructured.gstin || gstin || null,`; add `registryReport: fallbackStructured.registryReport || null,` to its `responsePayload`.

- [ ] **Step 5: Verify, commit**

Run: `node -e "require('./backend/controllers/creditController')"` and `npm --prefix backend test` → PASS.

```bash
git add backend/controllers/creditController.js
git commit -m "feat(credit): registry screening results, registry score adjustments, no fabricated fallback"
```

---

### Task 19: Delete fabricated scraper code

**Files:**
- Delete: `backend/services/scraperService.js`

- [ ] **Step 1: Confirm no references remain**

Run: Grep for `scraperService` in `backend/` (excluding node_modules).
Expected: no matches. If any remain, switch them to `registryService` / `demoEntities` as in Tasks 16–17.

- [ ] **Step 2: Delete and verify**

```bash
git rm backend/services/scraperService.js
node -e "require('./backend/server')"
npm --prefix backend test
```

Expected: server module loads; all tests PASS.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(fetcha): remove hash-derived registry fabrication"
```
