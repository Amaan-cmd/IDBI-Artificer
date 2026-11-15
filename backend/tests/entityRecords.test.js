const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore } = require('../platform/tableStore');
const records = require('../platform/entityRecords');

const freshStore = () => createFileTableStore(fs.mkdtempSync(path.join(os.tmpdir(), 'artificer-records-')));

test('pack/unpack round-trips records larger than one table property', () => {
  const big = { id: 'h1', fullPayload: { blob: 'x'.repeat(100000) } };
  const packed = records.pack(big);
  assert.equal(packed.chunks, 4);
  for (let i = 0; i < packed.chunks; i++) assert.ok(packed[`payload${i}`].length <= 30000);
  assert.deepEqual(records.unpack(packed), big);
});

test('users: save, look up by email (case-insensitive), update, list', async () => {
  const store = freshStore();
  await records.saveUser({ id: 'u1', email: 'a.b+tag@bank.com', calls: 0 }, store);
  const found = await records.getUserByEmail('A.B+TAG@bank.com', store);
  assert.equal(found.user.id, 'u1');
  const updated = await records.updateUser('a.b+tag@bank.com', (u) => ({ ...u, calls: u.calls + 1 }), store);
  assert.equal(updated.calls, 1);
  assert.equal(await records.updateUser('nobody@bank.com', (u) => u, store), null);
  assert.deepEqual((await records.listUsers(store)).map(u => u.calls), [1]);
});

test('history lists newest first and keeps oversized records without the payload', async () => {
  const store = freshStore();
  await records.addHistory({ id: 'old', timestamp: '2026-01-01T00:00:00Z', userEmail: 'A@x.com' }, store);
  await records.addHistory({ id: 'new', timestamp: '2026-06-01T00:00:00Z', userEmail: 'a@x.com' }, store);
  await records.addHistory({ id: 'huge', timestamp: '2026-03-01T00:00:00Z', fullPayload: 'y'.repeat(600000) }, store);
  const list = await records.listHistory(store);
  assert.deepEqual(list.map(h => h.id), ['new', 'huge', 'old']);
  assert.equal(list[1].fullPayload, null);
  assert.equal(list[1].fullPayloadOmitted, true);
});

test('OTP: correct code works once; only a hash is stored', async () => {
  const store = freshStore();
  const code = await records.issueOtp('a@x.com', { store, now: 1000 });
  assert.match(code, /^\d{6}$/);
  const raw = await store.getEntity('otpcodes', 'otp', 'a%40x.com');
  assert.ok(!JSON.stringify(raw).includes(code), 'plain code must not be stored');
  assert.equal(await records.verifyOtpCode('a@x.com', code, { store, now: 2000 }), true);
  assert.equal(await records.verifyOtpCode('a@x.com', code, { store, now: 3000 }), false, 'single use');
});

test('OTP: expires, and is burned after 5 wrong guesses', async () => {
  const store = freshStore();
  let code = await records.issueOtp('a@x.com', { store, now: 0 });
  assert.equal(await records.verifyOtpCode('a@x.com', code, { store, now: records.OTP_TTL_MS + 1 }), false);

  code = await records.issueOtp('b@x.com', { store, now: 0 });
  const wrong = code === '111111' ? '222222' : '111111';
  for (let i = 0; i < records.MAX_OTP_ATTEMPTS; i++) {
    assert.equal(await records.verifyOtpCode('b@x.com', wrong, { store, now: 10 }), false);
  }
  assert.equal(await records.verifyOtpCode('b@x.com', code, { store, now: 20 }), false, 'burned after max attempts');
});

test('OTP: one code per address per cooldown; clearOtp lifts it', async () => {
  const store = freshStore();
  await records.issueOtp('a@x.com', { store, now: 1000 });
  await assert.rejects(records.issueOtp('a@x.com', { store, now: 30000 }), records.OtpCooldownError);
  await records.issueOtp('b@x.com', { store, now: 30000 });
  await records.clearOtp('a@x.com', { store });
  await records.issueOtp('a@x.com', { store, now: 31000 });
  await records.issueOtp('a@x.com', { store, now: 31000 + records.OTP_RESEND_MS });
});
