import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  scanSessions,
  readSessionHead,
  relativeTime,
  formatSessionLine,
  parseSelection
} from '../../src/codex/sessions.js';

async function mktemp(prefix = 'codexx-sessions-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

// Write a rollout-*.jsonl mimicking codex's real format: a session_meta head
// line followed by an event_msg/user_message line carrying the preview text.
async function writeRollout(sessionsDir, { id, cwd, provider, timestamp, userMessage, ymd, source }) {
  const [y, m, d] = (ymd || '2026/06/17').split('/');
  const dir = path.join(sessionsDir, y, m, d);
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `rollout-${timestamp.replace(/[:.]/g, '-')}-${id}.jsonl`);
  const lines = [
    JSON.stringify({
      timestamp,
      type: 'session_meta',
      payload: { id, timestamp, cwd, model_provider: provider, originator: 'codex-tui', source: source || 'cli' }
    }),
    JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>noise</environment_context>' }] } })
  ];
  if (userMessage !== undefined) {
    lines.push(JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: userMessage } }));
  }
  await fsp.writeFile(file, lines.join('\n') + '\n');
  return file;
}

// ===== scanSessions =====

test('scanSessions: missing dir returns []', async () => {
  const out = await scanSessions({ sessionsDir: path.join(os.tmpdir(), 'does-not-exist-' + crypto.randomBytes(4).toString('hex')) });
  assert.deepEqual(out, []);
});

test('scanSessions: lists sessions across all providers (no provider filter)', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'claudex-gpt_any_linuxdo', timestamp: '2026-06-17T08:00:00.000Z', userMessage: '运行 ls' });
  await writeRollout(dir, { id: 'bbbbbbbb-0000-0000-0000-000000000002', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-16T08:00:00.000Z', userMessage: '港股打新' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out.length, 2);
  const providers = out.map((s) => s.provider).sort();
  assert.deepEqual(providers, ['claudex-gpt_any_linuxdo', 'opencoder']);
});

test('scanSessions: cwd filter keeps only matching sessions, across providers', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root/projA', provider: 'claudex-gpt_any_linuxdo', timestamp: '2026-06-17T08:00:00.000Z', userMessage: 'a' });
  await writeRollout(dir, { id: 'bbbbbbbb-0000-0000-0000-000000000002', cwd: '/root/projB', provider: 'opencoder', timestamp: '2026-06-16T08:00:00.000Z', userMessage: 'b' });
  await writeRollout(dir, { id: 'cccccccc-0000-0000-0000-000000000003', cwd: '/root/projA', provider: 'opencoder', timestamp: '2026-06-15T08:00:00.000Z', userMessage: 'c' });
  const out = await scanSessions({ sessionsDir: dir, cwd: '/root/projA' });
  assert.equal(out.length, 2);
  assert.ok(out.every((s) => s.cwd === '/root/projA'));
});

test('scanSessions: sorted by timestamp descending', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-10T08:00:00.000Z', userMessage: 'old' });
  await writeRollout(dir, { id: 'bbbbbbbb-0000-0000-0000-000000000002', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-17T08:00:00.000Z', userMessage: 'new' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out[0].preview, 'new');
  assert.equal(out[1].preview, 'old');
});

test('scanSessions: extracts preview from user_message, skipping environment_context', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-17T08:00:00.000Z', userMessage: '现在在不在' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out[0].preview, '现在在不在');
});

test('scanSessions: session with no user_message still listed with empty preview', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-17T08:00:00.000Z' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out.length, 1);
  assert.equal(out[0].preview, '');
});

test('scanSessions: provider label strips claudex- prefix', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'claudex-gpt_any_linuxdo', timestamp: '2026-06-17T08:00:00.000Z', userMessage: 'x' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out[0].providerLabel, 'gpt_any_linuxdo');
});

test('scanSessions: excludes non-interactive (exec) sessions by default, matching codex picker', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-17T08:00:00.000Z', userMessage: 'interactive', source: 'cli' });
  await writeRollout(dir, { id: 'bbbbbbbb-0000-0000-0000-000000000002', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-16T08:00:00.000Z', userMessage: 'exec run', source: 'exec' });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out.length, 1);
  assert.equal(out[0].preview, 'interactive');
});

test('scanSessions: includeNonInteractive=true keeps exec sessions', async () => {
  const dir = await mktemp();
  await writeRollout(dir, { id: 'aaaaaaaa-0000-0000-0000-000000000001', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-17T08:00:00.000Z', userMessage: 'interactive', source: 'cli' });
  await writeRollout(dir, { id: 'bbbbbbbb-0000-0000-0000-000000000002', cwd: '/root', provider: 'opencoder', timestamp: '2026-06-16T08:00:00.000Z', userMessage: 'exec run', source: 'exec' });
  const out = await scanSessions({ sessionsDir: dir, includeNonInteractive: true });
  assert.equal(out.length, 2);
});

// ===== readSessionHead =====

test('readSessionHead: returns null for a file without session_meta', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'rollout-x.jsonl');
  await fsp.writeFile(file, JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: 'hi' } }) + '\n');
  const head = await readSessionHead(file);
  assert.equal(head, null);
});

// ===== pure helpers =====

test('relativeTime: buckets', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  assert.equal(relativeTime(now - 30 * 1000, now), 'just now');
  assert.equal(relativeTime(now - 5 * 60 * 1000, now), '5m ago');
  assert.equal(relativeTime(now - 3 * 3600 * 1000, now), '3h ago');
  assert.equal(relativeTime(now - 2 * 86400 * 1000, now), '2d ago');
  assert.equal(relativeTime(NaN, now), '?');
});

test('formatSessionLine: includes index, time, provider label, preview', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  const line = formatSessionLine(
    { tsMs: now - 3 * 86400 * 1000, providerLabel: 'gpt_any_linuxdo', preview: 'hello world' },
    1,
    { nowMs: now }
  );
  assert.match(line, /1\./);
  assert.match(line, /3d ago/);
  assert.match(line, /gpt_any_linuxdo/);
  assert.match(line, /hello world/);
});

test('formatSessionLine: truncates long preview', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  const line = formatSessionLine(
    { tsMs: now, providerLabel: 'p', preview: 'x'.repeat(200) },
    1,
    { nowMs: now, previewMax: 20 }
  );
  assert.ok(line.includes('…'));
  assert.ok(line.length < 80);
});

test('parseSelection: valid / invalid', () => {
  assert.equal(parseSelection('1', 5), 0);
  assert.equal(parseSelection('5', 5), 4);
  assert.equal(parseSelection('  3 ', 5), 2);
  assert.equal(parseSelection('0', 5), null);
  assert.equal(parseSelection('6', 5), null);
  assert.equal(parseSelection('abc', 5), null);
  assert.equal(parseSelection('', 5), null);
});
