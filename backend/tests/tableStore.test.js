const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore, ConflictError } = require('../platform/tableStore');

function freshStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablestore-'));
  return createFileTableStore(dir);
}

test('create then get returns entity with etag', async () => {
  const s = freshStore();
  await s.ensureTables(['accounts']);
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 500 });
  const e = await s.getEntity('accounts', 'acct', 'a1');
  assert.equal(e.balanceCents, 500);
  assert.ok(e.etag);
});

test('getEntity returns null when missing', async () => {
  const s = freshStore();
  assert.equal(await s.getEntity('accounts', 'acct', 'nope'), null);
});

test('createEntity twice throws ConflictError', async () => {
  const s = freshStore();
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1' });
  await assert.rejects(s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1' }), ConflictError);
});

test('updateEntity with stale etag throws ConflictError', async () => {
  const s = freshStore();
  await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 500 });
  const e = await s.getEntity('accounts', 'acct', 'a1');
  await s.updateEntity('accounts', { ...e, balanceCents: 450 }, e.etag);
  await assert.rejects(s.updateEntity('accounts', { ...e, balanceCents: 400 }, e.etag), ConflictError);
  assert.equal((await s.getEntity('accounts', 'acct', 'a1')).balanceCents, 450);
});

test('upsert overwrites and listEntities filters by partition in rowKey order', async () => {
  const s = freshStore();
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'b', v: 1 });
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'a', v: 2 });
  await s.upsertEntity('ledger', { partitionKey: 'p2', rowKey: 'c', v: 3 });
  await s.upsertEntity('ledger', { partitionKey: 'p1', rowKey: 'b', v: 9 });
  const rows = await s.listEntities('ledger', 'p1', { limit: 10 });
  assert.deepEqual(rows.map(r => [r.rowKey, r.v]), [['a', 2], ['b', 9]]);
});

const { getTableStore, setTableStoreForTests } = require('../platform/tableStore');

test('getTableStore refuses to start in production without a connection string', () => {
  const saved = { conn: process.env.AZURE_STORAGE_CONNECTION_STRING, env: process.env.NODE_ENV };
  delete process.env.AZURE_STORAGE_CONNECTION_STRING;
  process.env.NODE_ENV = 'production';
  setTableStoreForTests(null);
  try {
    assert.throws(() => getTableStore(), /AZURE_STORAGE_CONNECTION_STRING/);
  } finally {
    if (saved.conn !== undefined) process.env.AZURE_STORAGE_CONNECTION_STRING = saved.conn;
    if (saved.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.env;
    setTableStoreForTests(null);
  }
});

test('setTableStoreForTests overrides the singleton', () => {
  const fake = { marker: true };
  setTableStoreForTests(fake);
  assert.equal(getTableStore(), fake);
  setTableStoreForTests(null);
});
