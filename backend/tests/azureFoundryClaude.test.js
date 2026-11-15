const test = require('node:test');
const assert = require('node:assert/strict');
const { anthropicMessagesUrl } = require('../utils/azureFoundryClaude');

const FULL = 'https://enver-odyssey-resource.services.ai.azure.com/anthropic/v1/messages';

test('Foundry endpoint forms all resolve to the Anthropic messages URL', () => {
  for (const endpoint of [
    'https://enver-odyssey-resource.services.ai.azure.com',
    'https://enver-odyssey-resource.services.ai.azure.com/',
    'https://enver-odyssey-resource.services.ai.azure.com/anthropic',
    'https://enver-odyssey-resource.services.ai.azure.com/anthropic/',
    FULL,
    `${FULL}/`,
    '',
    undefined
  ]) {
    assert.equal(anthropicMessagesUrl(endpoint), FULL, `endpoint ${endpoint}`);
  }
});

test('a failed Foundry call logs status and provider message, never the key', async () => {
  const { callAzureFoundryClaude } = require('../utils/azureFoundryClaude');
  const saved = { e: process.env.AZURE_FOUNDRY_ENDPOINT, k: process.env.AZURE_FOUNDRY_API_KEY, f: global.fetch };
  const logs = [];
  const { warn } = console;
  console.warn = (...a) => logs.push(a.join(' '));
  process.env.AZURE_FOUNDRY_ENDPOINT = 'https://x.services.ai.azure.com/anthropic';
  process.env.AZURE_FOUNDRY_API_KEY = 'sk-super-secret-key';
  global.fetch = async () => new Response(JSON.stringify({ error: { message: 'Access denied due to invalid subscription key.' } }), { status: 401 });
  try {
    assert.equal(await callAzureFoundryClaude('sys', 'hi'), null);
    assert.ok(logs.some(l => /HTTP 401/.test(l) && /invalid subscription key/.test(l)), logs.join('\n'));
    assert.ok(!logs.some(l => l.includes('sk-super-secret-key')));
  } finally {
    console.warn = warn;
    global.fetch = saved.f;
    for (const [k, v] of [['AZURE_FOUNDRY_ENDPOINT', saved.e], ['AZURE_FOUNDRY_API_KEY', saved.k]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
