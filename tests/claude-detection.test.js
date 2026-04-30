import test from 'node:test';
import assert from 'node:assert/strict';
import { detectClaudeCommand } from '../src/cli.js';

test('detectClaudeCommand falls back to claude.cmd on Windows when claude is unavailable', () => {
  const calls = [];
  const runner = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === 'claude') {
      const err = new Error('not found');
      err.code = 'ENOENT';
      throw err;
    }
    if (command === 'claude.cmd') {
      return '1.2.3';
    }
    throw new Error(`unexpected command: ${command}`);
  };

  const result = detectClaudeCommand({
    platform: 'win32',
    runner
  });

  assert.deepEqual(result, {
    command: 'claude.cmd',
    version: '1.2.3'
  });
  assert.deepEqual(calls.map((call) => call.command), ['claude', 'claude.cmd']);
});

test('detectClaudeCommand uses claude first on non-Windows platforms', () => {
  const calls = [];
  const runner = (command, args, options = {}) => {
    calls.push({ command, args, options });
    if (command === 'claude') {
      return '9.9.9';
    }
    throw new Error(`unexpected command: ${command}`);
  };

  const result = detectClaudeCommand({
    platform: 'linux',
    runner
  });

  assert.deepEqual(result, {
    command: 'claude',
    version: '9.9.9'
  });
  assert.deepEqual(calls.map((call) => call.command), ['claude']);
});

test('detectClaudeCommand returns null when no candidate works', () => {
  const calls = [];
  const runner = (command, args, options = {}) => {
    calls.push({ command, args, options });
    throw new Error(`missing ${command}`);
  };

  const result = detectClaudeCommand({
    platform: 'win32',
    runner
  });

  assert.equal(result, null);
  assert.deepEqual(calls.map((call) => call.command), ['claude', 'claude.cmd']);
});
