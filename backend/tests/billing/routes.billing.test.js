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
      data: { object: { id: 'cs_route', client_reference_id: acct.accountId, mode: 'payment', currency: 'usd', amount_total: 2500, payment_status: 'paid' } }
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
