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
