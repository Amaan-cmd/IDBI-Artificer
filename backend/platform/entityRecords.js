/**
 * Users, evaluation history, login audit and OTP codes in table storage, so
 * they survive redeploys and are shared across replicas. Records are stored
 * as JSON split across payload properties: an Azure Table string property
 * holds at most 64 KiB (32K UTF-16 chars) and an entity at most 1 MiB.
 */
const crypto = require('crypto');
const { getTableStore, ConflictError } = require('./tableStore');

const CHUNK_CHARS = 30000;
const MAX_CHUNKS = 15;
const HISTORY_LIMIT = 500;
const LOGIN_LIMIT = 500;
const USER_LIMIT = 2000;

// Row keys may not contain / \ # ? or control characters.
const emailKey = (email) => encodeURIComponent(String(email).trim().toLowerCase());
// Newest first: Azure returns rows in ascending row-key order.
const newestFirstKey = (ms = Date.now()) => `${String(9e15 - ms).padStart(16, '0')}_${crypto.randomBytes(4).toString('hex')}`;

function pack(obj) {
  const json = JSON.stringify(obj);
  const chunks = Math.ceil(json.length / CHUNK_CHARS) || 1;
  if (chunks > MAX_CHUNKS) throw new Error(`Record too large for table storage (${json.length} chars)`);
  const out = { chunks };
  for (let i = 0; i < chunks; i++) out[`payload${i}`] = json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
  return out;
}

function unpack(entity) {
  if (!entity) return null;
  let json = '';
  for (let i = 0; i < (entity.chunks || 0); i++) json += entity[`payload${i}`] || '';
  try { return JSON.parse(json); } catch { return null; }
}

// ---------- Users ----------

async function getUserByEmail(email, store = getTableStore()) {
  const e = await store.getEntity('users', 'user', emailKey(email));
  return e ? { user: unpack(e), etag: e.etag } : null;
}

async function saveUser(user, store = getTableStore()) {
  await store.upsertEntity('users', { partitionKey: 'user', rowKey: emailKey(user.email), userId: user.id, ...pack(user) });
  return user;
}

async function listUsers(store = getTableStore()) {
  return (await store.listEntities('users', 'user', { limit: USER_LIMIT })).map(unpack).filter(Boolean);
}

// Read-modify-write with optimistic concurrency, retried on conflicts.
async function updateUser(email, mutate, store = getTableStore()) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const found = await getUserByEmail(email, store);
    if (!found || !found.user) return null;
    const next = mutate({ ...found.user });
    try {
      await store.updateEntity('users', { partitionKey: 'user', rowKey: emailKey(email), userId: next.id, ...pack(next) }, found.etag);
      return next;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
    }
  }
  throw new Error(`User update kept conflicting for ${email}`);
}

// ---------- History ----------

async function addHistory(record, store = getTableStore()) {
  let entity;
  try {
    entity = pack(record);
  } catch (err) {
    // An oversized report is kept without its full payload rather than dropped.
    console.warn('[History] Record too large; storing summary only:', err.message);
    entity = pack({ ...record, fullPayload: null, fullPayloadOmitted: true });
  }
  await store.createEntity('history', {
    partitionKey: 'history',
    rowKey: newestFirstKey(Date.parse(record.timestamp) || Date.now()),
    userEmail: String(record.userEmail || '').toLowerCase(),
    ...entity
  });
}

async function listHistory(store = getTableStore()) {
  return (await store.listEntities('history', 'history', { limit: HISTORY_LIMIT })).map(unpack).filter(Boolean);
}

// ---------- Login audit ----------

async function addLogin(record, store = getTableStore()) {
  await store.createEntity('logins', { partitionKey: 'login', rowKey: newestFirstKey(), ...pack(record) });
}

async function listLogins(store = getTableStore()) {
  return (await store.listEntities('logins', 'login', { limit: LOGIN_LIMIT })).map(unpack).filter(Boolean);
}

// ---------- OTP codes ----------

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_MS = 60 * 1000;

class OtpCooldownError extends Error {
  constructor(retryAfterSec) { super('A code was sent recently'); this.retryAfterSec = retryAfterSec; }
}
const hashCode = (email, code) => crypto.createHash('sha256').update(`${emailKey(email)}:${code}`).digest('hex');

// Issues a new code, replacing any earlier one. Only a hash is stored. One
// code per address per OTP_RESEND_MS, so the endpoint cannot flood an inbox.
async function issueOtp(email, { store = getTableStore(), now = Date.now() } = {}) {
  const prev = await store.getEntity('otpcodes', 'otp', emailKey(email));
  if (prev && prev.issuedAt && now - prev.issuedAt < OTP_RESEND_MS) {
    throw new OtpCooldownError(Math.ceil((OTP_RESEND_MS - (now - prev.issuedAt)) / 1000));
  }
  const code = crypto.randomInt(100000, 1000000).toString();
  await store.upsertEntity('otpcodes', {
    partitionKey: 'otp', rowKey: emailKey(email), codeHash: hashCode(email, code), expiresAt: now + OTP_TTL_MS, attempts: 0, issuedAt: now
  });
  return code;
}

// Keeps issuedAt so a burned code still counts toward the resend cooldown.
const burn = (store, email, issuedAt = 0) => store.upsertEntity('otpcodes', { partitionKey: 'otp', rowKey: emailKey(email), codeHash: '', expiresAt: 0, attempts: MAX_OTP_ATTEMPTS, issuedAt });

// Withdraws an issued code that could not be delivered, lifting the cooldown.
const clearOtp = (email, { store = getTableStore() } = {}) => burn(store, email, 0);

// True once for a correct, unexpired code; a code is burned after use or after
// MAX_OTP_ATTEMPTS wrong guesses.
async function verifyOtpCode(email, code, { store = getTableStore(), now = Date.now() } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const e = await store.getEntity('otpcodes', 'otp', emailKey(email));
    if (!e || !e.codeHash || e.expiresAt <= now || e.attempts >= MAX_OTP_ATTEMPTS) return false;
    const expected = Buffer.from(e.codeHash, 'hex');
    const given = Buffer.from(hashCode(email, String(code)), 'hex');
    if (crypto.timingSafeEqual(expected, given)) {
      await burn(store, email, e.issuedAt || 0);
      return true;
    }
    try {
      await store.updateEntity('otpcodes', { partitionKey: 'otp', rowKey: emailKey(email), codeHash: e.codeHash, expiresAt: e.expiresAt, attempts: (e.attempts || 0) + 1, issuedAt: e.issuedAt || 0 }, e.etag);
      return false;
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
    }
  }
  return false;
}

module.exports = {
  getUserByEmail, saveUser, listUsers, updateUser,
  addHistory, listHistory, addLogin, listLogins,
  issueOtp, verifyOtpCode, clearOtp, OtpCooldownError, MAX_OTP_ATTEMPTS, OTP_TTL_MS, OTP_RESEND_MS,
  pack, unpack
};
