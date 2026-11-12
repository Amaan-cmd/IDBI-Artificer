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
