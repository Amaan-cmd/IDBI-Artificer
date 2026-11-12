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

class AccountNotFoundError extends Error {
  constructor(accountId) {
    super(`Billing account ${accountId} not found`);
    this.name = 'AccountNotFoundError';
    this.accountId = accountId;
  }
}

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
  const run = (locks.get(accountId) || Promise.resolve()).then(() => fn());
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
    if (!account) throw new AccountNotFoundError(accountId);
    const changes = mutate(account);
    const { etag, ...current } = account;
    if (!changes) return { applied: false, account: current };
    const next = { ...current, ...changes };
    try {
      await store.updateEntity('accounts', next, etag);
      return { applied: true, account: next };
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt >= MAX_ATTEMPTS) throw err;
      await new Promise(r => setTimeout(r, 10 * 2 ** attempt + Math.floor(Math.random() * 10)));
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
      lifetimePurchasedCents: 0, lifetimeSpentCents: 0, recentStripeSessions: '[]', recentRefunds: '[]'
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

const RECENT_REFUNDS = 100;

// Adds a charge back, at most once per chargeId (the last RECENT_REFUNDS
// refunded charge ids are kept on the account). Admin $0 charges need no refund.
async function refund(email, { chargeId, priceCents }, action, reason = '') {
  if (!priceCents) return { ok: true, balanceCents: null };
  if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error(`Invalid refund price: ${priceCents}`);
  if (typeof chargeId !== 'string' || !chargeId) throw new Error('A charge id is required to refund.');
  const accountId = accountIdFor(email);
  return withAccountLock(accountId, async () => {
    const { applied, account } = await updateAccount(accountId, (a) => {
      const recent = JSON.parse(a.recentRefunds || '[]');
      if (recent.includes(chargeId)) return null;
      return {
        balanceCents: a.balanceCents + priceCents,
        lifetimeSpentCents: Math.max(0, (a.lifetimeSpentCents || 0) - priceCents),
        recentRefunds: JSON.stringify([...recent, chargeId].slice(-RECENT_REFUNDS))
      };
    });
    if (!applied) return { ok: true, duplicate: true, balanceCents: account.balanceCents };
    await appendLedger(accountId, {
      type: 'refund', amountCents: priceCents, balanceAfterCents: account.balanceCents, action, reference: chargeId, reason: String(reason).slice(0, 200)
    });
    return { ok: true, balanceCents: account.balanceCents };
  });
}

// stripeevents is the primary dedupe; this in-entity window only covers a failed stripeevents write followed by >50 purchases before Stripe redelivers, which is accepted.
const RECENT_STRIPE_SESSIONS = 50;

// Credits a paid Stripe Checkout Session exactly once. The session id is
// recorded on the account inside the same ETag update as the balance change,
// so a retry after a partial failure can never credit twice or lose a payment.
async function credit(accountId, cents, stripeSessionId) {
  if (typeof accountId !== 'string' || !/^acct_[0-9a-f]{32}$/.test(accountId)) throw new Error(`Invalid billing account id: ${accountId}`);
  if (!Number.isInteger(cents) || cents <= 0) throw new Error(`Invalid credit amount: ${cents}`);
  if (typeof stripeSessionId !== 'string' || !stripeSessionId) throw new Error('A Stripe session id is required to credit.');
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

module.exports = {
  accountIdFor, ensureAccount, charge, refund, credit, getAccountSummary, ACCOUNT_PK, AccountNotFoundError,
  _internal: { appendLedger, updateAccount, withAccountLock }
};
