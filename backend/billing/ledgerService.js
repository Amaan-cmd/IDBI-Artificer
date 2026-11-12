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
