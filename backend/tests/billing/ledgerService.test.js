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
