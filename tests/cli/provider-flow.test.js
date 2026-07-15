import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidClaudeProviderName } from '../../src/cli.js';

test('claude provider names use the same discovery-safe rule', () => {
  assert.equal(isValidClaudeProviderName('openrouter_1-test'), true);
  for (const name of ['', 'foo bar', 'foo.bar', '../foo', 'foo/bar']) {
    assert.equal(isValidClaudeProviderName(name), false, name);
  }
});
