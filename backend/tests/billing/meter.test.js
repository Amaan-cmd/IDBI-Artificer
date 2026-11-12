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
