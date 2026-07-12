import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decidePostAddTest,
  shouldRunTestInput
} from '../../src/codex/cli.js';

// ===== shouldRunTestInput (default-yes, mirrors claudex) =====

test('shouldRunTestInput: empty / y / yes / 是 / ok → true', () => {
  for (const ans of ['', '   ', 'y', 'Y', 'yes', 'YES', '是', 'ok', 'OK']) {
    assert.equal(shouldRunTestInput(ans), true, `expected true for ${JSON.stringify(ans)}`);
  }
});

test('shouldRunTestInput: n / no / other → false', () => {
  for (const ans of ['n', 'N', 'no', 'NO', 'skip', '0', 'false']) {
    assert.equal(shouldRunTestInput(ans), false, `expected false for ${JSON.stringify(ans)}`);
  }
});

// ===== decidePostAddTest =====

test('decidePostAddTest: --no-test always skips', () => {
  assert.equal(
    decidePostAddTest({ interactive: true, forceTest: true, forceNoTest: true }),
    'skip'
  );
  assert.equal(
    decidePostAddTest({ interactive: false, forceTest: false, forceNoTest: true }),
    'skip'
  );
});

test('decidePostAddTest: --test always runs', () => {
  assert.equal(
    decidePostAddTest({ interactive: false, forceTest: true, forceNoTest: false }),
    'run'
  );
  assert.equal(
    decidePostAddTest({ interactive: true, forceTest: true, forceNoTest: false }),
    'run'
  );
});

test('decidePostAddTest: interactive without flags → ask', () => {
  assert.equal(
    decidePostAddTest({ interactive: true, forceTest: false, forceNoTest: false }),
    'ask'
  );
});

test('decidePostAddTest: non-interactive without flags → skip', () => {
  assert.equal(
    decidePostAddTest({ interactive: false, forceTest: false, forceNoTest: false }),
    'skip'
  );
});
