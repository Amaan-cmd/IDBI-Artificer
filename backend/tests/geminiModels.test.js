const test = require('node:test');
const assert = require('node:assert');
const models = require('../utils/geminiModels');

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k];
  }
  try { return fn(); } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

test('flash model defaults to gemini-3.5-flash (2.5 is retired)', () => {
  withEnv({ GEMINI_FLASH_MODEL: undefined }, () => {
    assert.strictEqual(models.flashModel(), 'gemini-3.5-flash');
    assert.strictEqual(models.GEMINI_FLASH_MODEL, 'gemini-3.5-flash');
  });
});

test('GEMINI_FLASH_MODEL env overrides the default at call time', () => {
  withEnv({ GEMINI_FLASH_MODEL: 'gemini-x-flash' }, () => {
    assert.strictEqual(models.GEMINI_FLASH_MODEL, 'gemini-x-flash');
  });
});

test('candidate list: requested, flash, extra fallbacks; de-duplicated, no retired defaults', () => {
  withEnv({ GEMINI_FLASH_MODEL: undefined, GEMINI_FALLBACK_MODELS: 'gemini-a, gemini-3.5-flash' }, () => {
    assert.deepStrictEqual(models.candidateModels('gemini-3.1-pro'), ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-a']);
    assert.deepStrictEqual(models.candidateModels(undefined), ['gemini-3.5-flash', 'gemini-a']);
  });
  withEnv({ GEMINI_FALLBACK_MODELS: undefined, GEMINI_FLASH_MODEL: undefined }, () => {
    assert.ok(!models.candidateModels('gemini-3.5-flash').some(m => m.startsWith('gemini-2.')));
  });
});
