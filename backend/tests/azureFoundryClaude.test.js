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
