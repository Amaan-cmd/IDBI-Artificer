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

// --- Consistency guards shared by both stores (billing ledger relies on these) ---

const { createAzureTableStore } = require('../platform/tableStore');

function restError(statusCode) {
  const err = new Error(`HTTP ${statusCode}`);
  err.statusCode = statusCode;
  return err;
}

// Minimal fake TableClient: records calls and fails with the given status.
function fakeAzureStore({ updateStatus } = {}) {
  const calls = [];
  const fakeClient = {
    async updateEntity(body, mode, opts) {
      calls.push({ op: 'updateEntity', body, mode, opts });
      if (updateStatus) throw restError(updateStatus);
      return { etag: 'W/"new"' };
    },
    async createEntity(body) {
      calls.push({ op: 'createEntity', body });
      return { etag: 'W/"c"' };
    }
  };
  const store = createAzureTableStore('unused', { clientFactory: () => fakeClient });
  return { store, calls };
}

for (const badEtag of [undefined, null, '', '*']) {
  test(`file store updateEntity rejects missing/wildcard etag (${JSON.stringify(badEtag)})`, async () => {
    const s = freshStore();
    await s.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 500 });
    await assert.rejects(s.updateEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', balanceCents: 0 }, badEtag), ConflictError);
    assert.equal((await s.getEntity('accounts', 'acct', 'a1')).balanceCents, 500);
  });

  test(`azure store updateEntity rejects missing/wildcard etag without calling SDK (${JSON.stringify(badEtag)})`, async () => {
    const { store, calls } = fakeAzureStore();
    await assert.rejects(store.updateEntity('accounts', { partitionKey: 'acct', rowKey: 'a1' }, badEtag), ConflictError);
    assert.equal(calls.length, 0);
  });
}

test('file store updateEntity on a missing row throws ConflictError', async () => {
  const s = freshStore();
  await assert.rejects(s.updateEntity('accounts', { partitionKey: 'acct', rowKey: 'nope' }, 'abc'), ConflictError);
});

test('azure store updateEntity maps 404 (missing row) to ConflictError', async () => {
  const { store } = fakeAzureStore({ updateStatus: 404 });
  await assert.rejects(store.updateEntity('accounts', { partitionKey: 'acct', rowKey: 'nope' }, 'W/"x"'), ConflictError);
});

test('azure store updateEntity maps 412 to ConflictError and passes etag + Replace', async () => {
  const { store, calls } = fakeAzureStore({ updateStatus: 412 });
  await assert.rejects(store.updateEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', etag: 'stale' }, 'W/"x"'), ConflictError);
  assert.equal(calls[0].mode, 'Replace');
  assert.equal(calls[0].opts.etag, 'W/"x"');
  assert.equal('etag' in calls[0].body, false);
});

test('azure store createEntity does not send an etag property', async () => {
  const { store, calls } = fakeAzureStore();
  await store.createEntity('accounts', { partitionKey: 'acct', rowKey: 'a1', etag: 'W/"old"' });
  assert.equal('etag' in calls[0].body, false);
});

test('file store does not silently discard a corrupt table file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tablestore-'));
  const s = createFileTableStore(dir);
  await s.createEntity('ledger', { partitionKey: 'p', rowKey: 'r1' });
  fs.writeFileSync(path.join(dir, 'ledger.json'), '{not json');
  await assert.rejects(s.createEntity('ledger', { partitionKey: 'p', rowKey: 'r2' }));
  assert.equal(fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8'), '{not json');
});
