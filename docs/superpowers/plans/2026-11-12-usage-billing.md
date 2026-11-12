# Usage Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every verified email gets $5.00 credit once; evaluations, Orc chat messages and registry lookups draw it down at fixed prices; users top up via Stripe Payment Links; balances persist in Azure Table Storage and cannot be double-spent.

**Architecture:** `backend/billing/` holds pricing, the ledger service (balance updates under ETag optimistic concurrency plus a per-account in-process lock), a `withCharge` route middleware that charges before the handler and refunds on failure, and the Stripe webhook. Frontend gets a `useBillingAccount` hook, a live balance in the sidebar and billing page, and an out-of-credit modal driven by HTTP 402.

**Tech Stack:** Node 20, Express 5, `@azure/data-tables` via existing `platform/tableStore.js`, `stripe` (signature verification only), `node:test`; React 18 + Vite.

**Spec:** `docs/superpowers/specs/2026-11-11-usage-billing-design.md`

**Branch:** `feat/real-data-and-billing`. Commit only files named in each task (the working tree holds unrelated uncommitted work — never `git add -A`). Run backend tests with `NODE_ENV=development` (local `backend/.env` sets production).

**Deviations from the spec (deliberate):**
1. **Per-account in-process lock** around balance updates in addition to the ETag loop. Without it, 20 concurrent charges with a 5-attempt retry budget cannot all resolve (the spec's own test would fail). The ETag loop still protects against other instances.
2. **Stripe idempotency inside the account update.** The spec writes the `stripeevents` row before crediting; if the balance write then fails, Stripe's retry would see a "duplicate" and the purchase would be lost. Instead the account entity keeps `recentStripeSessions` (JSON array, last 50 ids) and the credit is skipped inside the same ETag update when the id is present — atomically exactly-once. `stripeevents` is still written as an audit row and used as a fast-path duplicate check.
3. **Input validated before charging.** Invalid GSTINs (registry) and empty/invalid evaluate input return 400 before any charge, so the usage table is not littered with charge/refund pairs. A 4xx/5xx after charging still auto-refunds.
4. The account route lives in `backend/controllers/billingController.js` (the codebase has no `routes/` directory). There is no `.env.azure.example`; config goes in `.env.example` and `backend/.env.example`.
5. `refund` takes the charge result (`{ chargeId, priceCents }`) and action rather than looking the charge up.
6. Chat also refunds when there is no completed evaluation to explain (no model call was made).

---

## File map

**Backend — create**
- `backend/billing/pricing.js` — prices, free grant, packs, pack-link builder
- `backend/billing/ledgerService.js` — accounts, charge/refund/credit, summary
- `backend/billing/meter.js` — `withCharge(action, opts)` middleware
- `backend/billing/stripeWebhook.js` — `buildStripeWebhook()` handler
- `backend/controllers/billingController.js` — `GET /api/v1/billing/account`
- `backend/tests/billing/helpers.js`, `ledgerService.test.js`, `meter.test.js`, `stripeWebhook.test.js`, `routes.billing.test.js`

**Backend — modify**
- `backend/package.json` — `stripe` dependency, test glob
- `backend/server.js` — webhook before `express.json()`, billing route, wrap paid routes
- `backend/controllers/registryController.js` — `requireValidGstin`, refund on all-cached / demo
- `backend/controllers/creditController.js` — `validateEvaluateInput`, refund on step 99, real cost
- `backend/controllers/chatController.js` — refund when nothing to explain
- `backend/controllers/userController.js` — `incrementUserUsage(userId, costDollars)`, ensure account on OTP sign-in
- `backend/controllers/sessionController.js` — ensure account on Firebase sign-in
- `backend/tests/routes.registry.test.js` — use a temp table store
- `.env.example`, `backend/.env.example`

**Frontend — create**
- `frontend/src/utils/money.js`
- `frontend/src/hooks/useBillingAccount.js`
- `frontend/src/components/Billing/OutOfCreditModal.jsx` + `.css`

**Frontend — modify**
- `frontend/src/utils/apiClient.js` — 402 + billing-change listeners
- `frontend/src/App.jsx` — hook, modal, 402 handling, `#billing` deep link, props
- `frontend/src/components/AccountBilling/AccountBillingView.jsx` (+ `.css`) — live quota card
- `frontend/src/components/Sidebar/AuditorSidebar.jsx` — live balance
- `frontend/src/components/NewEvaluation/NewEvaluationView.jsx` — price on button
- `frontend/src/components/OrcTerminal/OrcTerminal.jsx` — 402 handling

---

### Task 1: Dependency, test glob, pricing

**Files:**
- Modify: `backend/package.json`
- Create: `backend/billing/pricing.js`
- Create: `backend/tests/billing/helpers.js`
- Test: `backend/tests/billing/pricing.test.js`

- [ ] **Step 1: Install stripe**

Run: `npm --prefix backend install stripe`
Expected: `"stripe"` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Extend the test glob**

In `backend/package.json` change the test script to:

```json
"test": "node --test --test-concurrency=1 tests/*.test.js tests/registry/*.test.js tests/billing/*.test.js"
```

- [ ] **Step 3: Shared test helper**

Create `backend/tests/billing/helpers.js` (not matched by the `*.test.js` glob):

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore, setTableStoreForTests } = require('../../platform/tableStore');

// Points getTableStore() at a fresh file store in a temp directory.
async function useTempStore() {
  const store = createFileTableStore(fs.mkdtempSync(path.join(os.tmpdir(), 'billing-')));
  await store.ensureTables();
  setTableStoreForTests(store);
  return store;
}

async function waitFor(check, { timeoutMs = 2000, intervalMs = 10 } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

module.exports = { useTempStore, waitFor };
```

- [ ] **Step 4: Write the failing test**

Create `backend/tests/billing/pricing.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { PRICES_CENTS, FREE_GRANT_CENTS, packLinks } = require('../../billing/pricing');

test('prices and free grant', () => {
  assert.deepEqual(PRICES_CENTS, { evaluate: 50, chat: 5, registryLookup: 2 });
  assert.equal(FREE_GRANT_CENTS, 500);
});

test('pack links carry the account id and email; unset links are null', () => {
  const env = { STRIPE_LINK_10: 'https://buy.stripe.com/abc', STRIPE_LINK_25: ' ', STRIPE_LINK_100: 'https://buy.stripe.com/x?locale=en' };
  const packs = packLinks('acct_' + 'a'.repeat(32), 'a+b@x.com', env);
  assert.deepEqual(packs.map(p => [p.id, p.cents]), [['pack_10', 1000], ['pack_25', 2500], ['pack_100', 10000]]);
  assert.equal(packs[0].url, `https://buy.stripe.com/abc?client_reference_id=acct_${'a'.repeat(32)}&prefilled_email=a%2Bb%40x.com`);
  assert.equal(packs[1].url, null);
  assert.ok(packs[2].url.startsWith('https://buy.stripe.com/x?locale=en&client_reference_id='));
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `cd backend && NODE_ENV=development node --test tests/billing/pricing.test.js`
Expected: FAIL — `Cannot find module '../../billing/pricing'`.

- [ ] **Step 6: Implement**

Create `backend/billing/pricing.js`:

```js
/**
 * Fixed prices per billable action, in US cents. Judgement-based placeholders:
 * validate against actual Gemini / Claude / Sandbox invoices. The evaluation
 * price covers the registry lookups it performs.
 */
const PRICES_CENTS = Object.freeze({ evaluate: 50, chat: 5, registryLookup: 2 });
const FREE_GRANT_CENTS = 500;
const PACKS = Object.freeze([
  { id: 'pack_10', cents: 1000, env: 'STRIPE_LINK_10' },
  { id: 'pack_25', cents: 2500, env: 'STRIPE_LINK_25' },
  { id: 'pack_100', cents: 10000, env: 'STRIPE_LINK_100' }
]);

// Payment Link URLs for an account. url is null when the link is not configured.
function packLinks(accountId, email, env = process.env) {
  return PACKS.map(({ id, cents, env: name }) => {
    const base = String(env[name] || '').trim();
    if (!base) return { id, cents, url: null };
    const sep = base.includes('?') ? '&' : '?';
    return { id, cents, url: `${base}${sep}client_reference_id=${accountId}&prefilled_email=${encodeURIComponent(email)}` };
  });
}

module.exports = { PRICES_CENTS, FREE_GRANT_CENTS, PACKS, packLinks };
```

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && NODE_ENV=development node --test tests/billing/pricing.test.js`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/billing/pricing.js backend/tests/billing/helpers.js backend/tests/billing/pricing.test.js
git commit -m "feat(billing): pricing, packs and stripe dependency"
```

---

### Task 2: Ledger service — accounts and charges

**Files:**
- Create: `backend/billing/ledgerService.js`
- Test: `backend/tests/billing/ledgerService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/billing/ledgerService.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { useTempStore } = require('./helpers');
const ledger = require('../../billing/ledgerService');

test('accountIdFor is deterministic and Stripe-safe', () => {
  const id = ledger.accountIdFor('  User@Example.com ');
  assert.match(id, /^acct_[0-9a-f]{32}$/);
  assert.equal(id, ledger.accountIdFor('user@example.com'));
});

test('ensureAccount grants $5 exactly once, even concurrently', async () => {
  const store = await useTempStore();
  const [a, b] = await Promise.all([ledger.ensureAccount('u@x.com'), ledger.ensureAccount('u@x.com')]);
  assert.equal(a.balanceCents, 500);
  assert.equal(b.balanceCents, 500);
  await ledger.ensureAccount('U@X.com');
  const rows = await store.listEntities('ledger', a.rowKey, { limit: 50 });
  assert.equal(rows.filter(r => r.type === 'grant').length, 1);
  assert.equal(rows[0].amountCents, 500);
});

test('charge deducts and writes a ledger row', async () => {
  const store = await useTempStore();
  const r = await ledger.charge('u@x.com', 'evaluate', '27AADCB2230M1Z2');
  assert.equal(r.ok, true);
  assert.equal(r.balanceCents, 450);
  assert.equal(r.priceCents, 50);
  assert.match(r.chargeId, /^chg_[0-9a-f]{16}$/);
  const rows = await store.listEntities('ledger', ledger.accountIdFor('u@x.com'), { limit: 50 });
  const row = rows.find(x => x.type === 'charge');
  assert.equal(row.amountCents, -50);
  assert.equal(row.balanceAfterCents, 450);
  assert.equal(row.action, 'evaluate');
  assert.equal(row.reference, '27AADCB2230M1Z2');
});

test('ledger lists newest first', async () => {
  const store = await useTempStore();
  await ledger.charge('u@x.com', 'chat');
  await new Promise(r => setTimeout(r, 5));
  await ledger.charge('u@x.com', 'evaluate');
  const rows = await store.listEntities('ledger', ledger.accountIdFor('u@x.com'), { limit: 50 });
  assert.deepEqual(rows.map(r => r.type), ['charge', 'charge', 'grant']);
  assert.equal(rows[0].action, 'evaluate');
});

test('insufficient balance returns INSUFFICIENT_CREDIT without deducting', async () => {
  await useTempStore();
  for (let i = 0; i < 10; i++) assert.equal((await ledger.charge('u@x.com', 'evaluate')).ok, true);
  const r = await ledger.charge('u@x.com', 'evaluate');
  assert.deepEqual(r, { ok: false, code: 'INSUFFICIENT_CREDIT', balanceCents: 0, priceCents: 50 });
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 0);
});

test('20 concurrent $0.50 charges on $5.00: exactly 10 succeed', async () => {
  await useTempStore();
  const results = await Promise.all(Array.from({ length: 20 }, () => ledger.charge('u@x.com', 'evaluate')));
  assert.equal(results.filter(r => r.ok).length, 10);
  assert.equal(results.filter(r => !r.ok && r.code === 'INSUFFICIENT_CREDIT').length, 10);
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 0);
});

test('unknown action throws', async () => {
  await useTempStore();
  await assert.rejects(ledger.charge('u@x.com', 'teleport'), /Unknown billable action/);
});

test('@enveraitech.com is never blocked and is charged $0', async () => {
  const store = await useTempStore();
  for (let i = 0; i < 12; i++) {
    const r = await ledger.charge('boss@enveraitech.com', 'evaluate');
    assert.equal(r.ok, true);
    assert.equal(r.priceCents, 0);
  }
  const acct = await ledger.ensureAccount('boss@enveraitech.com');
  assert.equal(acct.balanceCents, 500);
  const rows = await store.listEntities('ledger', acct.rowKey, { limit: 50 });
  const charges = rows.filter(r => r.type === 'charge');
  assert.equal(charges.length, 12);
  assert.ok(charges.every(r => r.amountCents === 0 && /admin/.test(r.reference)));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && NODE_ENV=development node --test tests/billing/ledgerService.test.js`
Expected: FAIL — `Cannot find module '../../billing/ledgerService'`.

- [ ] **Step 3: Implement**

Create `backend/billing/ledgerService.js`:

```js
/**
 * Prepaid credit ledger. The account's balanceCents is the source of truth;
 * ledger rows are an append-only history (a failed append is logged, never
 * reverses a balance change).
 */
const crypto = require('crypto');
const { getTableStore, ConflictError } = require('../platform/tableStore');
const { normaliseEmail } = require('../platform/session');
const { isAdminEmail } = require('../platform/admin');
const { PRICES_CENTS, FREE_GRANT_CENTS } = require('./pricing');

const ACCOUNT_PK = 'acct';
const MAX_ATTEMPTS = 5;

function accountIdFor(email) {
  return 'acct_' + crypto.createHash('sha256').update(normaliseEmail(email)).digest('hex').slice(0, 32);
}

// Inverted timestamp so listEntities (rowKey order) returns newest first.
function ledgerRowKey(now) {
  return String(9999999999999 - now).padStart(13, '0') + '_' + crypto.randomBytes(3).toString('hex');
}

// Serialises balance updates per account within this process. The ETag loop in
// updateAccount covers writers in other instances.
const locks = new Map();
function withAccountLock(accountId, fn) {
  const run = (locks.get(accountId) || Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  locks.set(accountId, tail);
  tail.then(() => { if (locks.get(accountId) === tail) locks.delete(accountId); });
  return run;
}

async function appendLedger(accountId, row) {
  const now = Date.now();
  try {
    await getTableStore().createEntity('ledger', {
      partitionKey: accountId, rowKey: ledgerRowKey(now), createdAt: new Date(now).toISOString(), ...row
    });
  } catch (err) {
    console.error(`[Billing] Ledger append failed for ${accountId}:`, err.message);
  }
}

// mutate(account) returns the fields to change, or null to leave the account as is.
async function updateAccount(accountId, mutate) {
  const store = getTableStore();
  for (let attempt = 1; ; attempt++) {
    const account = await store.getEntity('accounts', ACCOUNT_PK, accountId);
    if (!account) throw new Error(`Billing account ${accountId} not found`);
    const changes = mutate(account);
    const { etag, ...current } = account;
    if (!changes) return { applied: false, account: current };
    const next = { ...current, ...changes };
    try {
      await store.updateEntity('accounts', next, etag);
      return { applied: true, account: next };
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt >= MAX_ATTEMPTS) throw err;
    }
  }
}

async function ensureAccount(email) {
  const clean = normaliseEmail(email);
  if (!clean.includes('@')) throw new Error('A verified email is required for billing.');
  const accountId = accountIdFor(clean);
  const store = getTableStore();
  const existing = await store.getEntity('accounts', ACCOUNT_PK, accountId);
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    await store.createEntity('accounts', {
      partitionKey: ACCOUNT_PK, rowKey: accountId, email: clean,
      balanceCents: FREE_GRANT_CENTS, freeGrantCents: FREE_GRANT_CENTS, freeGrantedAt: now, createdAt: now,
      lifetimePurchasedCents: 0, lifetimeSpentCents: 0, recentStripeSessions: '[]'
    });
  } catch (err) {
    if (err instanceof ConflictError) return store.getEntity('accounts', ACCOUNT_PK, accountId);
    throw err;
  }
  await appendLedger(accountId, {
    type: 'grant', amountCents: FREE_GRANT_CENTS, balanceAfterCents: FREE_GRANT_CENTS, action: 'free_grant', reference: 'Welcome credit'
  });
  return store.getEntity('accounts', ACCOUNT_PK, accountId);
}

async function charge(email, action, reference = '') {
  const priceCents = PRICES_CENTS[action];
  if (!Number.isInteger(priceCents)) throw new Error(`Unknown billable action: ${action}`);
  const account = await ensureAccount(email);
  const accountId = account.rowKey;
  const chargeId = `chg_${crypto.randomBytes(8).toString('hex')}`;

  if (isAdminEmail(email)) {
    await appendLedger(accountId, {
      type: 'charge', amountCents: 0, balanceAfterCents: account.balanceCents, action, chargeId,
      reference: `admin (no charge)${reference ? ` ${reference}` : ''}`
    });
    return { ok: true, chargeId, balanceCents: account.balanceCents, priceCents: 0 };
  }

  return withAccountLock(accountId, async () => {
    const { applied, account: after } = await updateAccount(accountId, (a) => (a.balanceCents < priceCents ? null : {
      balanceCents: a.balanceCents - priceCents,
      lifetimeSpentCents: (a.lifetimeSpentCents || 0) + priceCents
    }));
    if (!applied) return { ok: false, code: 'INSUFFICIENT_CREDIT', balanceCents: after.balanceCents, priceCents };
    await appendLedger(accountId, {
      type: 'charge', amountCents: -priceCents, balanceAfterCents: after.balanceCents, action, reference, chargeId
    });
    return { ok: true, chargeId, balanceCents: after.balanceCents, priceCents };
  });
}

module.exports = { accountIdFor, ensureAccount, charge, ACCOUNT_PK, _internal: { appendLedger, updateAccount, withAccountLock } };
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && NODE_ENV=development node --test tests/billing/ledgerService.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/billing/ledgerService.js backend/tests/billing/ledgerService.test.js
git commit -m "feat(billing): ledger service with free grant and concurrent-safe charges"
```

---

### Task 3: Ledger service — refund, credit, summary

**Files:**
- Modify: `backend/billing/ledgerService.js`
- Test: `backend/tests/billing/ledgerService.test.js` (append)

- [ ] **Step 1: Append failing tests**

Append to `backend/tests/billing/ledgerService.test.js`:

```js
test('refund restores the balance and writes a refund row', async () => {
  const store = await useTempStore();
  const c = await ledger.charge('u@x.com', 'evaluate', 'G1');
  const r = await ledger.refund('u@x.com', c, 'evaluate', 'pipeline error');
  assert.equal(r.balanceCents, 500);
  const acct = await ledger.ensureAccount('u@x.com');
  assert.equal(acct.balanceCents, 500);
  assert.equal(acct.lifetimeSpentCents, 0);
  const rows = await store.listEntities('ledger', acct.rowKey, { limit: 50 });
  const refundRow = rows.find(x => x.type === 'refund');
  assert.equal(refundRow.amountCents, 50);
  assert.equal(refundRow.reference, c.chargeId);
  assert.equal(refundRow.reason, 'pipeline error');
});

test('refund of an admin $0 charge is a no-op', async () => {
  const store = await useTempStore();
  const c = await ledger.charge('boss@enveraitech.com', 'chat');
  await ledger.refund('boss@enveraitech.com', c, 'chat', 'x');
  const rows = await store.listEntities('ledger', ledger.accountIdFor('boss@enveraitech.com'), { limit: 50 });
  assert.equal(rows.filter(r => r.type === 'refund').length, 0);
});

test('credit adds a purchase once per Stripe session', async () => {
  const store = await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  const first = await ledger.credit(acct.rowKey, 1000, 'cs_test_1');
  assert.deepEqual(first, { duplicate: false, balanceCents: 1500 });
  assert.deepEqual(await ledger.credit(acct.rowKey, 1000, 'cs_test_1'), { duplicate: true });
  const after = await ledger.ensureAccount('u@x.com');
  assert.equal(after.balanceCents, 1500);
  assert.equal(after.lifetimePurchasedCents, 1000);
  const rows = await store.listEntities('ledger', acct.rowKey, { limit: 50 });
  assert.equal(rows.filter(r => r.type === 'purchase').length, 1);
  assert.ok(await store.getEntity('stripeevents', 'checkout', 'cs_test_1'));
});

test('credit for an unknown account throws (webhook returns 500 so Stripe retries)', async () => {
  await useTempStore();
  await assert.rejects(ledger.credit('acct_' + '0'.repeat(32), 1000, 'cs_test_3'), /not found/);
});

test('getAccountSummary returns balance and newest-first ledger', async () => {
  await useTempStore();
  await ledger.charge('u@x.com', 'chat', 'q');
  const s = await ledger.getAccountSummary('u@x.com', { ledgerLimit: 1 });
  assert.equal(s.accountId, ledger.accountIdFor('u@x.com'));
  assert.equal(s.email, 'u@x.com');
  assert.equal(s.balanceCents, 495);
  assert.equal(s.freeGrantCents, 500);
  assert.equal(s.ledger.length, 1);
  assert.deepEqual(Object.keys(s.ledger[0]).sort(), ['action', 'amountCents', 'balanceAfterCents', 'createdAt', 'reference', 'type']);
  assert.equal(s.ledger[0].action, 'chat');
});
```

Then **replace** the placeholder test `'credit is exactly-once even if the stripeevents row was never written'` with this real version (it deletes the audit row through a wrapping store so the fast path misses):

```js
test('credit is exactly-once even if the stripeevents row was never written', async () => {
  const store = await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  // Store wrapper whose stripeevents lookups always miss, as if the audit
  // row had never been written after the balance update.
  const { setTableStoreForTests } = require('../../platform/tableStore');
  setTableStoreForTests({
    ...store,
    getEntity: (t, pk, rk) => (t === 'stripeevents' ? Promise.resolve(null) : store.getEntity(t, pk, rk)),
    createEntity: (t, e) => (t === 'stripeevents' ? Promise.resolve({ etag: 'x' }) : store.createEntity(t, e))
  });
  await ledger.credit(acct.rowKey, 1000, 'cs_test_2');
  assert.deepEqual(await ledger.credit(acct.rowKey, 1000, 'cs_test_2'), { duplicate: true });
  assert.equal((await store.getEntity('accounts', 'acct', acct.rowKey)).balanceCents, 1500);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/ledgerService.test.js`
Expected: FAIL — `ledger.refund is not a function` (and `credit`, `getAccountSummary`).

- [ ] **Step 3: Implement**

In `backend/billing/ledgerService.js`, add above `module.exports`:

```js
// Adds a charge back. Callers refund a given charge at most once (meter.js
// guards this). Admin $0 charges need no refund.
async function refund(email, { chargeId, priceCents }, action, reason = '') {
  if (!priceCents) return { ok: true, balanceCents: null };
  const accountId = accountIdFor(email);
  return withAccountLock(accountId, async () => {
    const { account } = await updateAccount(accountId, (a) => ({
      balanceCents: a.balanceCents + priceCents,
      lifetimeSpentCents: Math.max(0, (a.lifetimeSpentCents || 0) - priceCents)
    }));
    await appendLedger(accountId, {
      type: 'refund', amountCents: priceCents, balanceAfterCents: account.balanceCents, action, reference: chargeId, reason: String(reason).slice(0, 200)
    });
    return { ok: true, balanceCents: account.balanceCents };
  });
}

const RECENT_STRIPE_SESSIONS = 50;

// Credits a paid Stripe Checkout Session exactly once. The session id is
// recorded on the account inside the same ETag update as the balance change,
// so a retry after a partial failure can never credit twice or lose a payment.
async function credit(accountId, cents, stripeSessionId) {
  const store = getTableStore();
  if (await store.getEntity('stripeevents', 'checkout', stripeSessionId)) return { duplicate: true };

  const { applied, account } = await withAccountLock(accountId, () => updateAccount(accountId, (a) => {
    const recent = JSON.parse(a.recentStripeSessions || '[]');
    if (recent.includes(stripeSessionId)) return null;
    return {
      balanceCents: a.balanceCents + cents,
      lifetimePurchasedCents: (a.lifetimePurchasedCents || 0) + cents,
      recentStripeSessions: JSON.stringify([...recent, stripeSessionId].slice(-RECENT_STRIPE_SESSIONS))
    };
  }));

  try {
    await store.createEntity('stripeevents', {
      partitionKey: 'checkout', rowKey: stripeSessionId, accountId, amountCents: cents, processedAt: new Date().toISOString()
    });
  } catch (err) {
    if (!(err instanceof ConflictError)) console.error(`[Billing] stripeevents write failed for ${stripeSessionId}:`, err.message);
  }
  if (!applied) return { duplicate: true };

  await appendLedger(accountId, {
    type: 'purchase', amountCents: cents, balanceAfterCents: account.balanceCents, action: 'top_up', reference: stripeSessionId
  });
  return { duplicate: false, balanceCents: account.balanceCents };
}

async function getAccountSummary(email, { ledgerLimit = 20 } = {}) {
  const account = await ensureAccount(email);
  const rows = await getTableStore().listEntities('ledger', account.rowKey, { limit: ledgerLimit });
  return {
    accountId: account.rowKey,
    email: account.email,
    balanceCents: account.balanceCents,
    freeGrantCents: account.freeGrantCents,
    lifetimePurchasedCents: account.lifetimePurchasedCents || 0,
    lifetimeSpentCents: account.lifetimeSpentCents || 0,
    ledger: rows.map(({ type, amountCents, balanceAfterCents, action, reference, createdAt }) => ({
      type, amountCents, balanceAfterCents, action, reference, createdAt
    }))
  };
}
```

Change the export line to:

```js
module.exports = {
  accountIdFor, ensureAccount, charge, refund, credit, getAccountSummary, ACCOUNT_PK,
  _internal: { appendLedger, updateAccount, withAccountLock }
};
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && NODE_ENV=development node --test tests/billing/ledgerService.test.js`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/billing/ledgerService.js backend/tests/billing/ledgerService.test.js
git commit -m "feat(billing): refunds, exactly-once Stripe credits and account summary"
```

---

### Task 4: `withCharge` middleware

**Files:**
- Create: `backend/billing/meter.js`
- Test: `backend/tests/billing/meter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/billing/meter.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { useTempStore, waitFor } = require('./helpers');
const ledger = require('../../billing/ledgerService');
const { withCharge } = require('../../billing/meter');

async function serve(app, fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

function appWith(email, middleware, handler) {
  const app = express();
  app.use((req, _res, next) => { req.session = { email }; next(); });
  app.get('/x', middleware, handler);
  return app;
}

const balance = async (email) => (await ledger.ensureAccount(email)).balanceCents;

test('charges before the handler and exposes req.billing', async () => {
  await useTempStore();
  let seen = null;
  const app = appWith('u@x.com', withCharge('evaluate'), (req, res) => { seen = req.billing; res.json({ ok: true }); });
  await serve(app, async (base) => assert.equal((await fetch(`${base}/x`)).status, 200));
  assert.match(seen.chargeId, /^chg_/);
  assert.equal(seen.priceCents, 50);
  assert.equal(await balance('u@x.com'), 450);
});

test('402 before the handler runs when credit is insufficient', async () => {
  await useTempStore();
  for (let i = 0; i < 10; i++) await ledger.charge('u@x.com', 'evaluate');
  let ran = false;
  const app = appWith('u@x.com', withCharge('evaluate'), (_req, res) => { ran = true; res.json({}); });
  await serve(app, async (base) => {
    const res = await fetch(`${base}/x`);
    assert.equal(res.status, 402);
    assert.deepEqual(await res.json(), {
      code: 'INSUFFICIENT_CREDIT', balanceCents: 0, priceCents: 50, action: 'evaluate',
      error: 'Not enough credit for this action. Top up to continue.'
    });
  });
  assert.equal(ran, false);
});

test('error status after charging refunds automatically', async () => {
  await useTempStore();
  const app = appWith('u@x.com', withCharge('chat'), (_req, res) => res.status(500).json({ error: 'boom' }));
  await serve(app, async (base) => assert.equal((await fetch(`${base}/x`)).status, 500));
  await waitFor(async () => (await balance('u@x.com')) === 500);
});

test('thrown handler error refunds', async () => {
  await useTempStore();
  const app = appWith('u@x.com', withCharge('chat'), async () => { throw new Error('boom'); });
  await serve(app, async (base) => assert.equal((await fetch(`${base}/x`)).status, 500));
  await waitFor(async () => (await balance('u@x.com')) === 500);
});

test('explicit refund plus error status refunds only once', async () => {
  await useTempStore();
  const app = appWith('u@x.com', withCharge('evaluate'), async (req, res) => {
    await req.billing.refund('step 99');
    res.status(500).end();
  });
  await serve(app, async (base) => assert.equal((await fetch(`${base}/x`)).status, 500));
  await new Promise(r => setTimeout(r, 100));
  assert.equal(await balance('u@x.com'), 500);
});

test('skip() bypasses charging', async () => {
  await useTempStore();
  const app = appWith('u@x.com', withCharge('evaluate', { skip: () => true }), (req, res) => res.json({ id: req.billing.chargeId }));
  await serve(app, async (base) => assert.deepEqual(await (await fetch(`${base}/x`)).json(), { id: null }));
  assert.equal(await balance('u@x.com'), 500);
});

test('billing store failure fails closed with 503', async () => {
  const { setTableStoreForTests } = require('../../platform/tableStore');
  setTableStoreForTests({ getEntity: async () => { throw new Error('down'); } });
  let ran = false;
  const app = appWith('u@x.com', withCharge('evaluate'), (_req, res) => { ran = true; res.json({}); });
  await serve(app, async (base) => {
    const res = await fetch(`${base}/x`);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, 'BILLING_UNAVAILABLE');
  });
  assert.equal(ran, false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/meter.test.js`
Expected: FAIL — `Cannot find module '../../billing/meter'`.

- [ ] **Step 3: Implement**

Create `backend/billing/meter.js`:

```js
const { charge, refund } = require('./ledgerService');

const NO_CHARGE = Object.freeze({ chargeId: null, priceCents: 0, refund: async () => {} });

/**
 * Charges req.session.email for `action` before the route handler runs.
 * 402 when credit is insufficient, 503 when billing is unreachable (fail
 * closed). Any 4xx/5xx response refunds automatically; handlers that report
 * failure inside a 200 stream (SSE step 99) call req.billing.refund(reason).
 *
 * opts.skip(req)      -> true to run the handler without charging (demo presets)
 * opts.reference(req) -> ledger reference (e.g. the GSTIN)
 */
function withCharge(action, { skip, reference } = {}) {
  return async function meter(req, res, next) {
    if (skip && skip(req)) {
      req.billing = NO_CHARGE;
      return next();
    }

    let result;
    try {
      result = await charge(req.session.email, action, reference ? String(reference(req) || '') : '');
    } catch (err) {
      console.error(`[Billing] Charge failed (${action}):`, err.message);
      return res.status(503).json({ code: 'BILLING_UNAVAILABLE', error: 'Billing is temporarily unavailable. Please retry shortly.' });
    }
    if (!result.ok) {
      return res.status(402).json({
        code: result.code, balanceCents: result.balanceCents, priceCents: result.priceCents, action,
        error: 'Not enough credit for this action. Top up to continue.'
      });
    }

    let refunded = null;
    const doRefund = (reason) => {
      if (!refunded) {
        refunded = refund(req.session.email, result, action, reason).catch((err) => {
          console.error(`[Billing] Refund failed for ${result.chargeId}:`, err.message);
        });
      }
      return refunded;
    };
    req.billing = { chargeId: result.chargeId, priceCents: result.priceCents, balanceCents: result.balanceCents, refund: doRefund };
    res.on('finish', () => {
      if (res.statusCode >= 400) doRefund(`HTTP ${res.statusCode}`);
    });
    return next();
  };
}

module.exports = { withCharge };
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && NODE_ENV=development node --test tests/billing/meter.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/billing/meter.js backend/tests/billing/meter.test.js
git commit -m "feat(billing): withCharge middleware with 402, fail-closed 503 and refunds"
```

---

### Task 5: Stripe webhook

**Files:**
- Create: `backend/billing/stripeWebhook.js`
- Test: `backend/tests/billing/stripeWebhook.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/billing/stripeWebhook.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Stripe = require('stripe');
const { useTempStore } = require('./helpers');
const ledger = require('../../billing/ledgerService');
const { buildStripeWebhook } = require('../../billing/stripeWebhook');

const SECRET = 'whsec_test_secret';
const stripe = new Stripe('sk_test_unused');

function appFor(handler) {
  const app = express();
  app.post('/hook', express.raw({ type: 'application/json' }), handler);
  return app;
}

async function post(handler, event, { secret = SECRET, signature } = {}) {
  const payload = JSON.stringify(event);
  const header = signature || stripe.webhooks.generateTestHeaderString({ payload, secret });
  const server = appFor(handler).listen(0);
  await new Promise(r => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/hook`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

function checkoutEvent(accountId, overrides = {}) {
  return {
    id: 'evt_1', type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_A', client_reference_id: accountId, currency: 'usd', amount_total: 1000, payment_status: 'paid', ...overrides } }
  };
}

const handler = buildStripeWebhook({ secret: () => SECRET });

test('valid signature credits once; replay is a no-op', async () => {
  await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  const first = await post(handler, checkoutEvent(acct.rowKey));
  assert.equal(first.status, 200);
  assert.equal(first.body.duplicate, false);
  const again = await post(handler, checkoutEvent(acct.rowKey));
  assert.equal(again.status, 200);
  assert.equal(again.body.duplicate, true);
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 1500);
});

test('bad signature is rejected with 400', async () => {
  await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  const r = await post(handler, checkoutEvent(acct.rowKey), { secret: 'whsec_wrong' });
  assert.equal(r.status, 400);
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 500);
});

test('non-USD, unpaid, or missing/invalid client_reference_id: 200 without credit', async () => {
  await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  for (const o of [{ currency: 'inr' }, { client_reference_id: null }, { client_reference_id: 'acct_nothex' }, { payment_status: 'unpaid' }]) {
    const r = await post(handler, checkoutEvent(acct.rowKey, { id: `cs_${Math.random()}`, ...o }));
    assert.equal(r.status, 200);
    assert.equal(r.body.credited, false);
  }
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 500);
});

test('async_payment_succeeded credits; unrelated events are acknowledged', async () => {
  await useTempStore();
  const acct = await ledger.ensureAccount('u@x.com');
  const e = checkoutEvent(acct.rowKey, { id: 'cs_async', payment_status: 'paid' });
  e.type = 'checkout.session.async_payment_succeeded';
  assert.equal((await post(handler, e)).status, 200);
  assert.equal((await post(handler, { id: 'evt_2', type: 'customer.created', data: { object: {} } })).status, 200);
  assert.equal((await ledger.ensureAccount('u@x.com')).balanceCents, 1500);
});

test('processing error after verification returns 500 so Stripe retries', async () => {
  await useTempStore();
  const failing = buildStripeWebhook({ secret: () => SECRET, creditFn: async () => { throw new Error('store down'); } });
  const r = await post(failing, checkoutEvent('acct_' + 'a'.repeat(32)));
  assert.equal(r.status, 500);
});

test('missing webhook secret returns 503', async () => {
  const r = await post(buildStripeWebhook({ secret: () => '' }), checkoutEvent('acct_' + 'a'.repeat(32)));
  assert.equal(r.status, 503);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/stripeWebhook.test.js`
Expected: FAIL — `Cannot find module '../../billing/stripeWebhook'`.

- [ ] **Step 3: Implement**

Create `backend/billing/stripeWebhook.js`:

```js
/**
 * Stripe webhook for Payment Link top-ups. The stripe package is used only to
 * verify signatures; no Stripe API calls are made, so no secret key is needed.
 */
const Stripe = require('stripe');
const { credit } = require('./ledgerService');

const ACCOUNT_RE = /^acct_[0-9a-f]{32}$/;
const stripe = new Stripe('sk_unused_signature_verification_only');

function buildStripeWebhook({ secret = () => process.env.STRIPE_WEBHOOK_SECRET, creditFn = credit } = {}) {
  return async function stripeWebhook(req, res) {
    const whSecret = String(secret() || '').trim();
    if (!whSecret) {
      console.error('[Billing] STRIPE_WEBHOOK_SECRET is not set; rejecting webhook.');
      return res.status(503).json({ error: 'Webhook not configured.' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], whSecret);
    } catch (err) {
      console.warn('[Billing] Stripe signature rejected:', err.message);
      return res.status(400).json({ error: 'Invalid signature.' });
    }

    const paidCompletion = event.type === 'checkout.session.completed';
    if (!paidCompletion && event.type !== 'checkout.session.async_payment_succeeded') {
      return res.json({ received: true });
    }

    const s = event.data?.object || {};
    const problem =
      (paidCompletion && s.payment_status !== 'paid' && 'not paid') ||
      (!ACCOUNT_RE.test(s.client_reference_id || '') && 'missing or invalid client_reference_id') ||
      (s.currency !== 'usd' && `currency ${s.currency}`) ||
      ((!Number.isInteger(s.amount_total) || s.amount_total <= 0) && 'no amount_total');
    if (problem) {
      // 200 so Stripe does not retry an event we will never credit.
      console.error(`[Billing] Stripe session ${s.id} not credited: ${problem}.`);
      return res.json({ received: true, credited: false });
    }

    try {
      const r = await creditFn(s.client_reference_id, s.amount_total, s.id);
      return res.json({ received: true, credited: !r.duplicate, duplicate: Boolean(r.duplicate) });
    } catch (err) {
      console.error(`[Billing] Crediting Stripe session ${s.id} failed:`, err.message);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  };
}

module.exports = { buildStripeWebhook, stripeWebhook: buildStripeWebhook() };
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd backend && NODE_ENV=development node --test tests/billing/stripeWebhook.test.js`
Expected: PASS (6 tests). If `generateTestHeaderString` is missing, check `backend/node_modules/stripe/package.json` version (needs ≥ 8.x) and reinstall.

- [ ] **Step 5: Commit**

```bash
git add backend/billing/stripeWebhook.js backend/tests/billing/stripeWebhook.test.js
git commit -m "feat(billing): verified Stripe webhook crediting Payment Link top-ups"
```

---

### Task 6: Account route and server wiring for webhook + account

**Files:**
- Create: `backend/controllers/billingController.js`
- Modify: `backend/server.js`
- Test: `backend/tests/billing/routes.billing.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/billing/routes.billing.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
process.env.SESSION_JWT_SECRET = 'test-secret';
process.env.DEMO_MODE = 'false';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_route_test';
process.env.STRIPE_LINK_10 = 'https://buy.stripe.com/ten';
delete process.env.STRIPE_LINK_25;
delete process.env.STRIPE_LINK_100;
const Stripe = require('stripe');
const app = require('../../server');
const { issueSessionToken } = require('../../platform/session');
const { useTempStore } = require('./helpers');

async function withServer(fn) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const auth = (email) => ({ authorization: `Bearer ${issueSessionToken({ id: 'u', email })}` });

test('GET /billing/account requires a session and returns balance, prices, packs, ledger', async () => {
  await useTempStore();
  await withServer(async (base) => {
    assert.equal((await fetch(`${base}/api/v1/billing/account`)).status, 401);
    const res = await fetch(`${base}/api/v1/billing/account`, { headers: auth('u@x.com') });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.accountId, /^acct_[0-9a-f]{32}$/);
    assert.equal(body.balanceCents, 500);
    assert.deepEqual(body.prices, { evaluate: 50, chat: 5, registryLookup: 2 });
    assert.equal(body.packs[0].url, `https://buy.stripe.com/ten?client_reference_id=${body.accountId}&prefilled_email=u%40x.com`);
    assert.equal(body.packs[1].url, null);
    assert.equal(body.ledger[0].type, 'grant');
  });
});

test('webhook route reads the raw body (signature verifies) and skips the session check', async () => {
  await useTempStore();
  await withServer(async (base) => {
    const acct = await (await fetch(`${base}/api/v1/billing/account`, { headers: auth('u@x.com') })).json();
    const payload = JSON.stringify({
      id: 'evt_r', type: 'checkout.session.completed',
      data: { object: { id: 'cs_route', client_reference_id: acct.accountId, currency: 'usd', amount_total: 2500, payment_status: 'paid' } }
    });
    const sig = new Stripe('sk_test_unused').webhooks.generateTestHeaderString({ payload, secret: 'whsec_route_test' });
    const res = await fetch(`${base}/api/v1/billing/stripe-webhook`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': sig }, body: payload
    });
    assert.equal(res.status, 200);
    const after = await (await fetch(`${base}/api/v1/billing/account`, { headers: auth('u@x.com') })).json();
    assert.equal(after.balanceCents, 3000);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/routes.billing.test.js`
Expected: FAIL — 404 on `/api/v1/billing/account`.

- [ ] **Step 3: Implement the controller**

Create `backend/controllers/billingController.js`:

```js
const { getAccountSummary } = require('../billing/ledgerService');
const { PRICES_CENTS, packLinks } = require('../billing/pricing');

async function getBillingAccount(req, res) {
  try {
    const summary = await getAccountSummary(req.session.email);
    return res.json({
      status: 'success',
      ...summary,
      prices: PRICES_CENTS,
      packs: packLinks(summary.accountId, summary.email)
    });
  } catch (err) {
    console.error('[Billing] Account summary failed:', err.message);
    return res.status(503).json({ code: 'BILLING_UNAVAILABLE', error: 'Billing is temporarily unavailable.' });
  }
}

module.exports = { getBillingAccount };
```

- [ ] **Step 4: Wire into server.js**

In `backend/server.js`, add to the requires near the other controllers:

```js
const { getBillingAccount } = require('./controllers/billingController');
const { stripeWebhook } = require('./billing/stripeWebhook');
```

Immediately **before** `app.use(express.json());` insert:

```js
// Stripe needs the raw body for signature verification, so this route is
// registered before express.json(). It ends the response itself, so the /api/
// rate limiter and session middleware registered later never run for it.
app.post('/api/v1/billing/stripe-webhook', express.raw({ type: 'application/json' }), stripeWebhook);
```

After the `// --- History Endpoints ---` block add:

```js
// --- Billing ---
app.get('/api/v1/billing/account', requireSession, getBillingAccount);
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd backend && NODE_ENV=development node --test tests/billing/routes.billing.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/billingController.js backend/server.js backend/tests/billing/routes.billing.test.js
git commit -m "feat(billing): account route and raw-body Stripe webhook route"
```

---

### Task 7: Meter the registry route

**Files:**
- Modify: `backend/controllers/registryController.js`
- Modify: `backend/server.js`
- Modify: `backend/tests/routes.registry.test.js`
- Test: `backend/tests/billing/routes.billing.test.js` (append)

- [ ] **Step 1: Append failing tests**

Append to `backend/tests/billing/routes.billing.test.js`:

```js
test('invalid GSTIN on the registry route is rejected before any charge', async () => {
  const store = await useTempStore();
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/registry/gstin/NOTAGSTIN`, { headers: auth('r@x.com') });
    assert.equal(res.status, 400);
  });
  const { accountIdFor } = require('../../billing/ledgerService');
  assert.equal(await store.getEntity('accounts', 'acct', accountIdFor('r@x.com')), null);
});

test('registry route returns 402 when out of credit', async () => {
  await useTempStore();
  const ledger = require('../../billing/ledgerService');
  for (let i = 0; i < 10; i++) await ledger.charge('broke@x.com', 'evaluate');
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/registry/gstin/27AAACR5055K1Z7`, { headers: auth('broke@x.com') });
    assert.equal(res.status, 402);
    assert.equal((await res.json()).action, 'registryLookup');
  });
});
```

`27AAACR5055K1Z7` has a valid check digit (taken from `backend/tests/gstin.test.js`); the ledger tests' `27AADCB2230M1Z2` is only a free-text reference and need not be valid.

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/routes.billing.test.js`
Expected: the 402 test FAILS (route not metered; it returns 503/200 instead).

- [ ] **Step 3: Implement in registryController.js**

Replace `backend/controllers/registryController.js` with:

```js
const { getRegistryReport } = require('../services/registry/registryService');
const { isDemoMode } = require('../platform/demoMode');
const { demoRegistryReport } = require('../demo/demoEntities');

const { GSTIN_RE, isAcceptedGstin } = require('../utils/gstin');

const paramGstin = (req) => String(req.params.gstin || '').trim().toUpperCase();

function gstinError(gstin) {
  if (!GSTIN_RE.test(gstin)) return 'Enter a valid 15-character GSTIN.';
  if (!isAcceptedGstin(gstin)) return 'Enter a valid 15-character GSTIN (check digit mismatch).';
  return null;
}

// Runs before billing so malformed GSTINs are never charged.
function requireValidGstin(req, res, next) {
  const error = gstinError(paramGstin(req));
  if (error) return res.status(400).json({ code: 'INVALID_GSTIN', error });
  return next();
}

const isDemoRegistryRequest = (req) => isDemoMode() && Boolean(demoRegistryReport(paramGstin(req)));

// Sections served from the registry cache cost us nothing upstream.
const fullyCached = (report) => ['gst', 'filings', 'mca'].every((k) => !report[k] || report[k].cached !== false);

async function getRegistry(req, res) {
  const gstin = paramGstin(req);
  const error = gstinError(gstin);
  if (error) return res.status(400).json({ code: 'INVALID_GSTIN', error });
  if (isDemoMode()) {
    const sample = demoRegistryReport(gstin);
    if (sample) return res.json({ status: 'success', registryReport: sample });
  }
  try {
    const cin = typeof req.query.cin === 'string' && req.query.cin.trim() ? req.query.cin.trim().toUpperCase() : null;
    const registryReport = await getRegistryReport(gstin, { cin });
    if (fullyCached(registryReport)) await req.billing?.refund('cached registry result');
    return res.json({ status: 'success', registryReport });
  } catch (err) {
    console.error('[Registry] Report failed:', err.message);
    return res.status(503).json({ code: 'REGISTRY_UNAVAILABLE', error: 'Registry lookup is temporarily unavailable.' });
  }
}

module.exports = { getRegistry, requireValidGstin, isDemoRegistryRequest, paramGstin, GSTIN_RE };
```

Note: `fullyCached` treats a section without a `cached` flag (e.g. a not-covered MCA placeholder) as free.

- [ ] **Step 4: Wire into server.js**

In `backend/server.js` change the registry require line to:

```js
const { getRegistry, requireValidGstin, isDemoRegistryRequest, paramGstin } = require('./controllers/registryController');
```

Add near the other requires:

```js
const { withCharge } = require('./billing/meter');
```

Replace the two registry route lines with:

```js
const meterRegistry = withCharge('registryLookup', { skip: isDemoRegistryRequest, reference: paramGstin });
app.get('/api/v1/registry/gstin/:gstin', requireSession, requireValidGstin, meterRegistry, getRegistry);
app.get('/api/v1/alternate-data/gstin-probe/:gstin', requireSession, requireValidGstin, meterRegistry, getRegistry);
```

- [ ] **Step 5: Keep the old route test off the real local store**

In `backend/tests/routes.registry.test.js`, after `const { issueSessionToken } = require('../platform/session');` add:

```js
const { useTempStore } = require('./billing/helpers');
test.beforeEach(() => useTempStore());
```

- [ ] **Step 6: Run the affected tests**

Run: `cd backend && NODE_ENV=development node --test tests/billing/routes.billing.test.js tests/routes.registry.test.js tests/registryController.test.js`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add backend/controllers/registryController.js backend/server.js backend/tests/routes.registry.test.js backend/tests/billing/routes.billing.test.js
git commit -m "feat(billing): charge registry lookups; free when fully cached or demo"
```

---

### Task 8: Meter evaluation and chat

**Files:**
- Modify: `backend/controllers/creditController.js`
- Modify: `backend/controllers/chatController.js`
- Modify: `backend/controllers/userController.js` (`incrementUserUsage`)
- Modify: `backend/server.js`
- Test: `backend/tests/billing/routes.billing.test.js` (append)

- [ ] **Step 1: Append failing tests**

Append to `backend/tests/billing/routes.billing.test.js`:

```js
test('evaluate with no input is a 400 and is not charged', async () => {
  const store = await useTempStore();
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/evaluate`, { method: 'POST', headers: auth('e@x.com'), body: new FormData() });
    assert.equal(res.status, 400);
  });
  const { accountIdFor } = require('../../billing/ledgerService');
  assert.equal(await store.getEntity('accounts', 'acct', accountIdFor('e@x.com')), null);
});

test('evaluate returns 402 when out of credit', async () => {
  await useTempStore();
  const ledger = require('../../billing/ledgerService');
  for (let i = 0; i < 10; i++) await ledger.charge('broke2@x.com', 'evaluate');
  await withServer(async (base) => {
    const fd = new FormData();
    fd.append('manualData', JSON.stringify({ businessName: 'X' }));
    const res = await fetch(`${base}/api/v1/evaluate`, { method: 'POST', headers: auth('broke2@x.com'), body: fd });
    assert.equal(res.status, 402);
  });
});

test('chat with nothing to explain is refunded', async () => {
  await useTempStore();
  const { waitFor } = require('./helpers');
  const ledger = require('../../billing/ledgerService');
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/chat/xai`, {
      method: 'POST', headers: { ...auth('c@x.com'), 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'why?', evaluationPayload: null })
    });
    assert.equal(res.status, 200);
  });
  await waitFor(async () => (await ledger.ensureAccount('c@x.com')).balanceCents === 500);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend && NODE_ENV=development node --test tests/billing/routes.billing.test.js`
Expected: the 402 and chat-refund tests FAIL.

- [ ] **Step 3: creditController — validation and refunds**

In `backend/controllers/creditController.js`:

(a) Add above `async function evaluateMSMECredit`:

```js
// Input check shared by the pre-billing middleware and the handler.
function evaluateInputError(req) {
  const { manualData, gstin } = req.body || {};
  if (!req.file && !manualData && !gstin) {
    return { error: 'No input provided. Please enter a GSTIN, upload a file, or enter manual data.' };
  }
  if (!req.file && !manualData && !isAcceptedGstin(String(gstin).trim().toUpperCase())) {
    return { code: 'INVALID_GSTIN', error: 'Enter a valid 15-character GSTIN.' };
  }
  return null;
}

// Runs before billing so empty or malformed requests are never charged.
function validateEvaluateInput(req, res, next) {
  const problem = evaluateInputError(req);
  if (problem) return res.status(400).json(problem);
  return next();
}

// GSTIN-only demo presets are free.
function isDemoEvaluation(req) {
  const gstin = String(req.body?.gstin || '').trim().toUpperCase();
  return isDemoMode() && !req.file && !req.body?.manualData && Boolean(demoFinancials(gstin));
}

// step 99 is the client's terminal-error signal; a failed run is refunded.
function streamFailure(req, res, payload) {
  res.write(`data: ${JSON.stringify({ step: 99, ...payload })}\n\n`);
  req.billing?.refund(payload.error);
}
```

and add these requires at the top:

```js
const { isDemoMode } = require('../platform/demoMode');
const { demoFinancials } = require('../demo/demoEntities');
```

(b) In `evaluateMSMECredit`, replace the two input `if` blocks (the `No input provided` and `INVALID_GSTIN` checks) with:

```js
    const problem = evaluateInputError(req);
    if (problem) return res.status(400).json(problem);
```

(c) Replace **every** `res.write(\`data: ${JSON.stringify({ step: 99, ... })}\n\n\`);` with `streamFailure(req, res, { ... })` keeping the same object fields minus `step`. There are five sites:
- JEV rejection (live path): `streamFailure(req, res, { error: \`JEV System 1 Gatekeeper: Document rejected as inappropriate/fraudulent. ${jevReport.rationale}\`, jevReport });`
- Fallback extraction failed: `streamFailure(req, res, { error: 'Could not extract financials from the uploaded statement. Please upload a clearer statement (PDF or CSV).' });`
- Fallback registry screening: `streamFailure(req, res, { error: 'Registry screening could not be completed. Please retry.' });`
- JEV rejection (fallback path): same as the first, with the fallback `jevReport`.
- Outer catch (headers already sent): inside the existing `try { ... } catch { /* stream already closed */ }` use `streamFailure(req, res, { error: error.message || 'Failed to evaluate credit profile' });`

Verify none remain: `grep -n "step: 99" backend/controllers/creditController.js` → only the line inside `streamFailure`.

(d) Replace both `incrementUserUsage(userId);` with:

```js
      incrementUserUsage(userId, (req.billing?.priceCents || 0) / 100);
```

(e) Update the export:

```js
module.exports = { evaluateMSMECredit, verifiedStatementName, validateEvaluateInput, isDemoEvaluation };
```

- [ ] **Step 4: userController — real cost**

In `backend/controllers/userController.js` replace `incrementUserUsage` with:

```js
// costDollars is the price actually charged for the action (0 for admins and demo presets).
const incrementUserUsage = async (userId, costDollars = 0) => {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.calls = (user.calls || 0) + 1;
    user.cost = Math.round(((user.cost || 0) + costDollars) * 100) / 100;
    saveUsers(users);
  }
};
```

- [ ] **Step 5: chatController — refund when nothing to explain**

In `backend/controllers/chatController.js`, inside the `if (!decision) {` block, before its `return res.json(...)`, add:

```js
      await req.billing?.refund('no completed evaluation to explain');
```

- [ ] **Step 6: Wire into server.js**

Change the credit controller require to:

```js
const { evaluateMSMECredit, validateEvaluateInput, isDemoEvaluation } = require('./controllers/creditController');
```

Replace the evaluate and chat routes with:

```js
app.post('/api/v1/evaluate', requireSession, upload.single('statement'), validateEvaluateInput,
  withCharge('evaluate', { skip: isDemoEvaluation, reference: (req) => req.body.gstin || req.file?.originalname || 'manual data' }),
  evaluateMSMECredit);

// Agent 3 Conversational Forensic Interrogation
app.post('/api/v1/chat/xai', requireSession, withCharge('chat', { reference: (req) => req.body?.evaluationPayload?.gstin || '' }), handleXAIChat);
```

(The `withCharge` require was added in Task 7. The `upload.single` must stay before `validateEvaluateInput` so `req.body`/`req.file` are parsed.)

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && NODE_ENV=development npm test`
Expected: all PASS. If `creditController.stream.test.js` or `chatController.test.js` call handlers directly, they keep working because `req.billing` is optional-chained.

- [ ] **Step 8: Commit**

```bash
git add backend/controllers/creditController.js backend/controllers/chatController.js backend/controllers/userController.js backend/server.js backend/tests/billing/routes.billing.test.js
git commit -m "feat(billing): charge evaluations and Orc chat; refund failed runs"
```

---

### Task 9: Create the account at sign-in, env config

**Files:**
- Modify: `backend/controllers/sessionController.js`
- Modify: `backend/controllers/userController.js` (`verifyOtp`)
- Modify: `.env.example`, `backend/.env.example`

- [ ] **Step 1: sessionController**

In `backend/controllers/sessionController.js`, add `const { ensureAccount } = require('../billing/ledgerService');` and an injectable dependency `ensureBillingAccount = ensureAccount` in `buildCreateSession`'s parameter object. Before the final `return res.json(...)` add:

```js
    // Eager $5 grant; charge() also creates the account, so failure only delays it.
    ensureBillingAccount(identity.email).catch((err) => console.error('[Billing] ensureAccount at sign-in failed:', err.message));
```

- [ ] **Step 2: verifyOtp**

In `backend/controllers/userController.js`, add `const { ensureAccount } = require('../billing/ledgerService');` with the other requires, and immediately before `return res.json({ status: 'success', user, sessionToken: issueSessionToken(user) });` in `verifyOtp` add:

```js
  ensureAccount(cleanEmail).catch((err) => console.error('[Billing] ensureAccount at sign-in failed:', err.message));
```

Check for a require cycle: `node -e "require('./backend/controllers/userController')"` must print nothing and exit 0 (ledgerService does not require userController).

- [ ] **Step 3: Env examples**

Append to both `.env.example` and `backend/.env.example`:

```
# Billing (Stripe Payment Links; webhook signing secret from the Stripe dashboard)
STRIPE_WEBHOOK_SECRET=
STRIPE_LINK_10=
STRIPE_LINK_25=
STRIPE_LINK_100=
```

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && NODE_ENV=development npm test`
Expected: all PASS. (`tests/session.test.js` uses `buildCreateSession` — if it asserts on the injected deps list, pass `ensureBillingAccount: async () => {}` there.)

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/sessionController.js backend/controllers/userController.js .env.example backend/.env.example
git commit -m "feat(billing): grant free credit at sign-in; document Stripe env vars"
```

---

### Task 10: Frontend plumbing — apiClient, money, hook

**Files:**
- Modify: `frontend/src/utils/apiClient.js`
- Create: `frontend/src/utils/money.js`
- Create: `frontend/src/hooks/useBillingAccount.js`

No frontend test runner exists; verification is `npm --prefix frontend run build` plus the manual run in Task 13.

- [ ] **Step 1: apiClient listeners**

In `frontend/src/utils/apiClient.js`, add after `onUnauthorized`:

```js
const paymentRequiredListeners = new Set();
const billingChangeListeners = new Set();

// Fired with the 402 body ({ action, priceCents, balanceCents }) when a paid action is refused.
export function onPaymentRequired(listener) {
  paymentRequiredListeners.add(listener);
  return () => paymentRequiredListeners.delete(listener);
}

// Fired after any response from a billable endpoint, so balances can refresh.
export function onBillingChange(listener) {
  billingChangeListeners.add(listener);
  return () => billingChangeListeners.delete(listener);
}

const BILLABLE_PATHS = ['/api/v1/evaluate', '/api/v1/chat/xai', '/api/v1/registry/', '/api/v1/alternate-data/gstin-probe/'];
```

Replace the body of `apiFetch` after the `fetch` call with:

```js
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) unauthorizedListeners.forEach(fn => fn());
  if (res.status === 402) {
    const info = await res.clone().json().catch(() => ({}));
    paymentRequiredListeners.forEach(fn => fn(info));
  }
  if (BILLABLE_PATHS.some(p => path.startsWith(p))) billingChangeListeners.forEach(fn => fn());
  return res;
```

- [ ] **Step 2: money.js**

Create `frontend/src/utils/money.js`:

```js
export function formatCents(cents) {
  return typeof cents === 'number' && Number.isFinite(cents) ? `$${(cents / 100).toFixed(2)}` : '—';
}
```

- [ ] **Step 3: useBillingAccount**

Create `frontend/src/hooks/useBillingAccount.js`:

```js
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, onBillingChange } from '../utils/apiClient';

// Loads /billing/account. Refreshes after billable calls and on window focus
// (to pick up Stripe top-ups completed in another tab).
export function useBillingAccount(enabled) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/billing/account');
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setAccount(body);
        setError(null);
      } else if (res.status !== 401) {
        setError(body.error || `Billing unavailable (HTTP ${res.status})`);
      }
    } catch {
      setError('Billing unavailable. Check your connection.');
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAccount(null);
      return undefined;
    }
    refresh();
    const unsubscribe = onBillingChange(refresh);
    window.addEventListener('focus', refresh);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, refresh]);

  return { account, error, refresh };
}
```

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/apiClient.js frontend/src/utils/money.js frontend/src/hooks/useBillingAccount.js
git commit -m "feat(billing-ui): billing account hook and 402/billing-change listeners"
```

---

### Task 11: Out-of-credit modal, App wiring, 402 handling

**Files:**
- Create: `frontend/src/components/Billing/OutOfCreditModal.jsx`, `OutOfCreditModal.css`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/OrcTerminal/OrcTerminal.jsx`

- [ ] **Step 1: Modal**

Create `frontend/src/components/Billing/OutOfCreditModal.jsx`:

```jsx
import React from 'react';
import { X, Wallet } from 'lucide-react';
import { formatCents } from '../../utils/money';
import './OutOfCreditModal.css';

const ACTION_LABELS = { evaluate: 'An evaluation', chat: 'An Orc message', registryLookup: 'A registry lookup' };

export default function OutOfCreditModal({ info, account, onClose, onOpenBilling }) {
  if (!info) return null;
  const packs = account?.packs || [];
  return (
    <div className="ooc-backdrop" role="dialog" aria-modal="true" aria-labelledby="ooc-title" onClick={onClose}>
      <div className="ooc-card" onClick={(e) => e.stopPropagation()}>
        <button className="ooc-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="ooc-icon"><Wallet size={22} /></div>
        <h3 id="ooc-title">Not enough credit</h3>
        <p>
          {ACTION_LABELS[info.action] || 'This action'} costs {formatCents(info.priceCents)}. Your balance is {formatCents(info.balanceCents)}.
        </p>
        <div className="ooc-packs">
          {packs.map((p) => (
            <button
              key={p.id}
              className="ooc-pack"
              disabled={!p.url}
              title={p.url ? undefined : 'Coming soon'}
              onClick={() => p.url && window.open(p.url, '_blank', 'noopener,noreferrer')}
            >
              {p.url ? `Add ${formatCents(p.cents)}` : `${formatCents(p.cents)} · Coming soon`}
            </button>
          ))}
        </div>
        <button className="ooc-link" onClick={() => { onClose(); onOpenBilling(); }}>Open Account &amp; Billing</button>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/Billing/OutOfCreditModal.css`:

```css
.ooc-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.ooc-card { position: relative; width: min(420px, 92vw); background: #111113; border: 1px solid #27272a; border-radius: 12px; padding: 24px; color: #e4e4e7; text-align: center; }
.ooc-card h3 { margin: 8px 0; font-size: 18px; }
.ooc-card p { color: #a1a1aa; font-size: 14px; margin: 0 0 16px; }
.ooc-icon { color: #10b981; display: flex; justify-content: center; }
.ooc-close { position: absolute; top: 12px; right: 12px; background: none; border: 0; color: #a1a1aa; cursor: pointer; }
.ooc-packs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 12px; }
.ooc-pack { background: #10b981; color: #052e1f; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
.ooc-pack:disabled { background: #27272a; color: #71717a; cursor: not-allowed; }
.ooc-link { background: none; border: 0; color: #10b981; cursor: pointer; text-decoration: underline; font-size: 13px; }
```

- [ ] **Step 2: App.jsx — hook, modal, deep link**

In `frontend/src/App.jsx`:

(a) Imports: add `onPaymentRequired` to the `./utils/apiClient` import, and:

```js
import OutOfCreditModal from './components/Billing/OutOfCreditModal';
import { useBillingAccount } from './hooks/useBillingAccount';
```

(b) Next to the existing `useEffect(() => onUnauthorized(...))` (≈ line 183 — hooks must stay above the `if (!isLoggedIn) return ...` early return) add:

```js
  const billing = useBillingAccount(isLoggedIn);
  const [creditPrompt, setCreditPrompt] = useState(null);
  useEffect(() => onPaymentRequired(setCreditPrompt), []);

  // Stripe Payment Links return to /#billing after a top-up.
  useEffect(() => {
    if (window.location.hash === '#billing') setActiveNav('billing');
  }, []);
```

If `isLoggedIn` is declared below line 183, place this block after its declaration (still above any early return).

(c) Render the modal inside the logged-in layout root (next to `<AuditorSidebar`'s parent `citadel-app-layout` div, as its last child):

```jsx
        <OutOfCreditModal
          info={creditPrompt}
          account={billing.account}
          onClose={() => setCreditPrompt(null)}
          onOpenBilling={() => { setActiveNav('billing'); setShowSplitWorkspace(false); }}
        />
```

(d) Pass props:
- `<AuditorSidebar ... balanceCents={billing.account?.balanceCents} />`
- `<AccountBillingView currentUser={currentUser} billing={billing} />`
- `<NewEvaluationView ... prices={billing.account?.prices} />`

- [ ] **Step 3: App.jsx — 402 handling (no fabricated fallback)**

(a) In `triggerEvaluation`, right after the existing `if (response.status === 401) { ... return; }` block add:

```js
      if (response.status === 402) {
        // OutOfCreditModal is already shown by the apiFetch listener.
        setLoading(false);
        return;
      }
```

and at the end of `triggerEvaluation` (after the result/error is applied) ensure refunds show: add `billing.refresh();` right before each `setLoading(false)` that ends a completed or failed SSE run — simplest is one call in the code path after the SSE read loop finishes, before the `if (sseError)` check:

```js
    billing.refresh();
```

(b) In the workspace chat handler (≈ line 811, `apiFetch('/api/v1/chat/xai'`), right after the `apiFetch(...)` call and before `const resData = await res.json();` add:

```js
      if (res.status === 402) {
        setChatMessages(prev => [...prev, { role: 'agent', text: 'Out of credit. Top up on the Account & Billing page to keep asking Orc.' }]);
        setIsChatSending(false);
        return;
      }
```

- [ ] **Step 4: OrcTerminal — 402 handling**

In `frontend/src/components/OrcTerminal/OrcTerminal.jsx`, after the `const res = await apiFetch('/api/v1/chat/xai', {...});` statement and before `const data = await res.json();` add:

```js
        if (res.status === 402) {
          setMessages(prev => [
            ...prev,
            { id: `orc_${Date.now()}`, sender: 'orc', text: 'Out of credit. Top up on the Account & Billing page to keep asking Orc.' }
          ]);
          setLoading(false);
          return;
        }
```

- [ ] **Step 5: Build**

Run: `npm --prefix frontend run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Billing frontend/src/App.jsx frontend/src/components/OrcTerminal/OrcTerminal.jsx
git commit -m "feat(billing-ui): out-of-credit modal and 402 handling without fabricated fallbacks"
```

(`App.jsx` has no unrelated uncommitted changes per `git status`; re-check with `git diff --stat frontend/src/App.jsx` before adding.)

---

### Task 12: Live balance in sidebar, billing page, evaluate button

**Files:**
- Modify: `frontend/src/components/Sidebar/AuditorSidebar.jsx`
- Modify: `frontend/src/components/AccountBilling/AccountBillingView.jsx`, `AccountBillingView.css`
- Modify: `frontend/src/components/NewEvaluation/NewEvaluationView.jsx`

`AccountBillingView.css` and `AuditorSidebar.css` have unrelated uncommitted edits. Commit them only if you changed them in this task, using `git add -p` to stage just your hunks.

- [ ] **Step 1: Sidebar**

In `AuditorSidebar.jsx`, add `balanceCents` to the component's destructured props and `import { formatCents } from '../../utils/money';`. Replace the `sidebar-quota-card` block's contents with:

```jsx
          <div className="sidebar-quota-card">
            <div className="quota-header">
              <span className="quota-label">CREDIT BALANCE</span>
              <span className="quota-val">{formatCents(balanceCents)}</span>
            </div>
            <div className="quota-bar-track">
              <div className="quota-bar-fill" style={{ width: `${Math.min(100, Math.max(0, ((balanceCents || 0) / 500) * 100))}%` }} />
            </div>
            <span className="quota-meta">Prepaid usage credit</span>
          </div>
```

- [ ] **Step 2: Billing page quota card**

In `AccountBillingView.jsx`:
- Change the signature to `export default function AccountBillingView({ currentUser, billing })`.
- Add `import { formatCents } from '../../utils/money';` and `Wallet` to the lucide import.
- Add constants above the component:

```js
const PRICE_ROWS = [
  { key: 'evaluate', label: 'Credit evaluation' },
  { key: 'chat', label: 'Orc message' },
  { key: 'registryLookup', label: 'Registry lookup' }
];
const LEDGER_LABELS = { free_grant: 'Welcome credit', evaluate: 'Evaluation', chat: 'Orc message', registryLookup: 'Registry lookup', top_up: 'Top-up' };
```

- Replace the whole `{/* Credit Quota Card */}` `<div className="billing-card quota-card">…</div>` with:

```jsx
        {/* Credit Balance Card */}
        <div className="billing-card quota-card">
          <div className="card-top-row">
            <span className="card-tag">PREPAID USAGE CREDIT</span>
            <span className="quota-cycle">Credit never expires</span>
          </div>

          {billing?.error && !billing?.account ? (
            <div className="quota-big-num"><span className="num-denom">{billing.error}</span></div>
          ) : (
            <>
              <div className="quota-big-num">
                <span className="num-val">{formatCents(billing?.account?.balanceCents)}</span>
                <span className="num-denom">credit remaining</span>
              </div>
              <div className="quota-bar-track">
                <div
                  className="quota-bar-fill"
                  style={{ width: `${(() => {
                    const a = billing?.account;
                    if (!a) return 0;
                    const max = Math.max(a.freeGrantCents || 500, (a.freeGrantCents || 0) + (a.lifetimePurchasedCents || 0));
                    return Math.min(100, (a.balanceCents / max) * 100);
                  })()}%` }}
                />
              </div>
              {billing?.account && billing.account.lifetimeSpentCents < billing.account.freeGrantCents && (
                <span className="quota-cycle">Includes {formatCents(billing.account.freeGrantCents)} free credit</span>
              )}

              <div className="quota-footer-details">
                {PRICE_ROWS.map(({ key, label }) => (
                  <div className="detail-col" key={key}>
                    <span className="dt-lbl">{label.toUpperCase()}</span>
                    <span className="dt-val">{formatCents(billing?.account?.prices?.[key])}</span>
                  </div>
                ))}
              </div>

              <div className="billing-pack-row">
                {(billing?.account?.packs || []).map((p) => (
                  <button
                    key={p.id}
                    className="billing-pack-btn"
                    disabled={!p.url}
                    title={p.url ? undefined : 'Coming soon'}
                    onClick={() => p.url && window.open(p.url, '_blank', 'noopener,noreferrer')}
                  >
                    <Wallet size={14} /> {p.url ? `Add ${formatCents(p.cents)}` : `${formatCents(p.cents)} · Coming soon`}
                  </button>
                ))}
              </div>

              {billing?.account?.ledger?.length > 0 && (
                <table className="billing-ledger">
                  <thead>
                    <tr><th>Date</th><th>Action</th><th>Reference</th><th>Amount</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {billing.account.ledger.map((row, i) => (
                      <tr key={`${row.createdAt}_${i}`}>
                        <td>{new Date(row.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{row.type === 'refund' ? `Refund · ${LEDGER_LABELS[row.action] || row.action}` : (LEDGER_LABELS[row.action] || row.action)}</td>
                        <td className="mono">{row.reference || '—'}</td>
                        <td className={row.amountCents >= 0 ? 'text-emerald' : ''}>{row.amountCents >= 0 ? '+' : '−'}{formatCents(Math.abs(row.amountCents))}</td>
                        <td>{formatCents(row.balanceAfterCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
```

- Append to `AccountBillingView.css`:

```css
.billing-pack-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.billing-pack-btn { display: inline-flex; align-items: center; gap: 6px; background: #10b981; color: #052e1f; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 600; cursor: pointer; }
.billing-pack-btn:disabled { background: #27272a; color: #71717a; cursor: not-allowed; }
.billing-ledger { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 12px; }
.billing-ledger th, .billing-ledger td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #27272a; }
.billing-ledger th { color: #71717a; font-weight: 500; }
.billing-ledger .mono { font-family: ui-monospace, monospace; }
```

- [ ] **Step 3: Price on the evaluate button**

In `NewEvaluationView.jsx` add `prices` to the destructured props and `import { formatCents } from '../../utils/money';`. Inside the button's `<span>`, after the label expression, append the price when not loading:

```jsx
                    {!loading && prices?.evaluate != null ? ` · ${formatCents(prices.evaluate)}` : ''}
```

- [ ] **Step 4: Build**

Run: `npm --prefix frontend run build`
Expected: build succeeds; `grep -n "842\|158 Runs\|Renews Nov" frontend/src/components` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar/AuditorSidebar.jsx frontend/src/components/AccountBilling/AccountBillingView.jsx frontend/src/components/NewEvaluation/NewEvaluationView.jsx
git add -p frontend/src/components/AccountBilling/AccountBillingView.css   # only the appended billing rules
git commit -m "feat(billing-ui): live balance, prices, top-up buttons and usage history"
```

---

### Task 13: Full verification

- [ ] **Step 1: Backend suite**

Run: `cd backend && NODE_ENV=development npm test`
Expected: all PASS, 0 failures.

- [ ] **Step 2: Frontend build**

Run: `npm --prefix frontend run build`
Expected: success.

- [ ] **Step 3: Live smoke (local)**

Start backend with `NODE_ENV=development node backend/server.js` and `npm run dev`. Sign in with a non-admin email (OTP code is in the backend log). Check:
1. Sidebar shows `$5.00`; billing page shows `$5.00 credit remaining`, prices, "Coming soon" pack buttons (no `STRIPE_LINK_*` set), and a "Welcome credit +$5.00" row.
2. Registry probe of a valid GSTIN → balance `$4.98`; probing the same GSTIN again (cached) → refunded, balance stays `$4.98` with a refund row.
3. Evaluation → `$4.48`; a forced failure (upload a non-statement file) → refund row, balance unchanged.
4. Set balance low by editing `backend/data/local-store/accounts.json` (`balanceCents: 10`) → evaluation shows the out-of-credit modal and no fabricated result.
5. Admin (`@enveraitech.com`) account: actions succeed, balance never moves, ledger rows are `$0.00` admin.

- [ ] **Step 4: Stripe test-mode check (optional, needs Stripe CLI)**

`stripe listen --forward-to localhost:4000/api/v1/billing/stripe-webhook` → put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`, restart backend, then `stripe trigger checkout.session.completed --add checkout_session:client_reference_id=<accountId from /billing/account>` and confirm the balance rises.

---

## Owner setup (after deploy)

1. Stripe → create three Payment Links (USD $10, $25, $100); set each success URL to `https://<app>/#billing`.
2. Stripe → Webhooks → endpoint `https://<app>/api/v1/billing/stripe-webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Put the three link URLs in `STRIPE_LINK_10/25/100` in Azure app settings.
