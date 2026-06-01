import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBaseUrl } from '../../src/codex/providers.js';

test('normalizeBaseUrl: appends /v1 to bare domain', () => {
  assert.equal(normalizeBaseUrl('https://anyrouter.top'), 'https://anyrouter.top/v1');
  assert.equal(normalizeBaseUrl('https://opencoder.eu.cc'), 'https://opencoder.eu.cc/v1');
});

test('normalizeBaseUrl: appends /v1 when only trailing slash present', () => {
  assert.equal(normalizeBaseUrl('https://anyrouter.top/'), 'https://anyrouter.top/v1');
  assert.equal(normalizeBaseUrl('https://anyrouter.top///'), 'https://anyrouter.top/v1');
});

test('normalizeBaseUrl: leaves /v1 unchanged', () => {
  assert.equal(normalizeBaseUrl('https://api.openai.com/v1'), 'https://api.openai.com/v1');
  assert.equal(normalizeBaseUrl('https://opencoder.eu.cc/v1'), 'https://opencoder.eu.cc/v1');
});

test('normalizeBaseUrl: strips trailing slash on existing path', () => {
  assert.equal(normalizeBaseUrl('https://api.openai.com/v1/'), 'https://api.openai.com/v1');
});

test('normalizeBaseUrl: respects non-/v1 paths', () => {
  assert.equal(normalizeBaseUrl('https://example.com/v2'), 'https://example.com/v2');
  assert.equal(normalizeBaseUrl('https://example.com/v1beta'), 'https://example.com/v1beta');
  assert.equal(normalizeBaseUrl('https://proxy.com/openai/v1'), 'https://proxy.com/openai/v1');
  assert.equal(normalizeBaseUrl('https://proxy.com/api/anthropic'), 'https://proxy.com/api/anthropic');
});

test('normalizeBaseUrl: handles localhost and ports', () => {
  assert.equal(normalizeBaseUrl('http://localhost:11434'), 'http://localhost:11434/v1');
  assert.equal(normalizeBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.equal(normalizeBaseUrl('http://127.0.0.1:8000'), 'http://127.0.0.1:8000/v1');
});

test('normalizeBaseUrl: leaves non-URL strings as-is for downstream validation', () => {
  assert.equal(normalizeBaseUrl('not a url'), 'not a url');
  assert.equal(normalizeBaseUrl(''), '');
});

test('normalizeBaseUrl: ignores non-string input', () => {
  assert.equal(normalizeBaseUrl(null), null);
  assert.equal(normalizeBaseUrl(undefined), undefined);
  assert.equal(normalizeBaseUrl(42), 42);
});

test('normalizeBaseUrl: trims surrounding whitespace', () => {
  assert.equal(normalizeBaseUrl('  https://anyrouter.top  '), 'https://anyrouter.top/v1');
});
