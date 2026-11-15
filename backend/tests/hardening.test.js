const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ---------- Grok tool validates GSTIN before billed lookups ----------

const { runGrokTool } = require('../utils/grokClient');

test('scrape_gstin_registry rejects invalid GSTINs without calling the registry', async () => {
  const calls = [];
  const deps = { getRegistryReport: async (g) => { calls.push(g); return { status: 'ok' }; } };
  for (const gstin of [undefined, '', 'ABC', '27AAACR5055K1Z', '27AAACR5055K1ZXX', { x: 1 }, '27AAACR5055K1Z7; DROP', '27AAACR5055K1Z5']) {
    const out = await runGrokTool('scrape_gstin_registry', { gstin }, deps);
    assert.deepEqual(out, { status: 'unavailable', reason: 'Invalid GSTIN' });
  }
  assert.deepEqual(calls, []);
});

test('scrape_gstin_registry normalises and forwards a valid GSTIN', async () => {
  const calls = [];
  const deps = { getRegistryReport: async (g) => { calls.push(g); return { status: 'ok', gstin: g }; } };
  const out = await runGrokTool('scrape_gstin_registry', { gstin: ' 27aaacr5055k1z7 ' }, deps);
  assert.deepEqual(calls, ['27AAACR5055K1Z7']);
  assert.deepEqual(out, { status: 'ok', gstin: '27AAACR5055K1Z7' });
});

test('query_mca_master_data stays unavailable and unknown tools return null', async () => {
  const deps = { getRegistryReport: async () => { throw new Error('must not be called'); } };
  assert.equal((await runGrokTool('query_mca_master_data', {}, deps)).status, 'unavailable');
  assert.equal(await runGrokTool('nope', {}, deps), null);
});

test('registryController and grokClient share one GSTIN regex', () => {
  const { GSTIN_RE } = require('../utils/gstin');
  assert.equal(require('../controllers/registryController').GSTIN_RE, GSTIN_RE);
});

// ---------- startup env check ----------

const { missingRecommendedEnv } = require('../server');

test('missingRecommendedEnv lists absent recommended variable names only', () => {
  const env = { SANDBOX_API_KEY: 'k', SANDBOX_API_SECRET: '', ENTRA_TENANT_ID: '  ', ENTRA_CLIENT_ID: 'c', ENTRA_TENANT_SUBDOMAIN: 's' };
  assert.deepEqual(missingRecommendedEnv(env), ['SANDBOX_API_SECRET', 'ENTRA_TENANT_ID']);
  assert.deepEqual(missingRecommendedEnv({ SANDBOX_API_KEY: 'a', SANDBOX_API_SECRET: 'b', ENTRA_TENANT_ID: 't', ENTRA_CLIENT_ID: 'c', ENTRA_TENANT_SUBDOMAIN: 's' }), []);
});

// ---------- containers run in production mode ----------

test('runtime Docker images set NODE_ENV=production', () => {
  const root = path.join(__dirname, '..', '..');
  const rootDf = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
  const runner = rootDf.slice(rootDf.lastIndexOf('FROM '));
  assert.match(runner, /^ENV NODE_ENV=production$/m);
  const builder = rootDf.slice(0, rootDf.lastIndexOf('FROM '));
  assert.doesNotMatch(builder, /NODE_ENV=production/, 'frontend build stage needs devDependencies');
  const backendDf = fs.readFileSync(path.join(root, 'backend', 'Dockerfile'), 'utf8');
  assert.match(backendDf, /^ENV NODE_ENV=production$/m);
});
