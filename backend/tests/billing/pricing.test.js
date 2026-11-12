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
