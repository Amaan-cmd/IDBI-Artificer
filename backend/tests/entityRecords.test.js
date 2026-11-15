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
