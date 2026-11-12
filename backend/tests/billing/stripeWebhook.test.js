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
