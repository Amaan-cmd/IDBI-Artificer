const fs = require('fs');
const os = require('os');
const path = require('path');
const { createFileTableStore, setTableStoreForTests } = require('../../platform/tableStore');

// Points getTableStore() at a fresh file store in a temp directory.
async function useTempStore() {
  const store = createFileTableStore(fs.mkdtempSync(path.join(os.tmpdir(), 'billing-')));
  await store.ensureTables();
  setTableStoreForTests(store);
  return store;
}

async function waitFor(check, { timeoutMs = 2000, intervalMs = 10 } = {}) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

module.exports = { useTempStore, waitFor };
