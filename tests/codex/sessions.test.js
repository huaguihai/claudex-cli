import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  scanSessions,
  readSessionHead,
  readLastActivity,
  classifySessionSource,
  relativeTime,
  formatSessionLine,
  sessionKindTag,
  parseSelection
} from '../../src/codex/sessions.js';

const tmpDirs = [];
process.on('exit', () => {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

async function mktemp(prefix = 'codexx-sessions-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

// Write a rollout-*.jsonl mimicking codex's real format: a session_meta head
// line followed by an event_msg/user_message line carrying the preview text.
// Optional laterEvents: array of { timestamp, type?, payload? } appended after
// the head so last-activity time can differ from create time.
async function writeRollout(sessionsDir, { id, cwd, provider, timestamp, userMessage, ymd, source, parentThreadId, extraMeta, laterEvents }) {
  const [y, m, d] = (ymd || '2026/06/17').split('/');
  const dir = path.join(sessionsDir, y, m, d);
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, `rollout-${timestamp.replace(/[:.]/g, '-')}-${id}.jsonl`);
  const payload = {
    id,
    timestamp,
    cwd,
    model_provider: provider,
    originator: 'codex-tui',
    source: source === undefined ? 'cli' : source,
    ...(parentThreadId ? { parent_thread_id: parentThreadId } : {}),
    ...(extraMeta || {})
  };
  const lines = [
    JSON.stringify({
      timestamp,
      type: 'session_meta',
      payload
    }),
    JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>noise</environment_context>' }] } })
  ];
  if (userMessage !== undefined) {
    lines.push(JSON.stringify({ timestamp, type: 'event_msg', payload: { type: 'user_message', message: userMessage } }));
  }
  if (Array.isArray(laterEvents)) {
    for (const ev of laterEvents) {
      lines.push(JSON.stringify({
        timestamp: ev.timestamp,
        type: ev.type || 'event_msg',
        payload: ev.payload || { type: 'token_count' }
      }));
    }
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

test('scanSessions: sorted by last activity descending (not create time)', async () => {
  const dir = await mktemp();
  // Created earlier, but last activity is newer.
  await writeRollout(dir, {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-10T08:00:00.000Z',
    userMessage: 'old-create-new-active',
    laterEvents: [{ timestamp: '2026-06-18T12:00:00.000Z' }]
  });
  // Created later, but never continued.
  await writeRollout(dir, {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-17T08:00:00.000Z',
    userMessage: 'new-create-no-continue'
  });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out[0].preview, 'old-create-new-active');
  assert.equal(out[1].preview, 'new-create-no-continue');
  assert.equal(out[0].timestamp, '2026-06-18T12:00:00.000Z');
  assert.equal(out[0].startedAt, '2026-06-10T08:00:00.000Z');
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

test('scanSessions: excludes subagent sessions by default', async () => {
  const dir = await mktemp();
  await writeRollout(dir, {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-17T08:00:00.000Z',
    userMessage: 'main thread',
    source: 'cli'
  });
  await writeRollout(dir, {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-16T08:00:00.000Z',
    userMessage: 'spawned agent work',
    source: {
      subagent: {
        thread_spawn: {
          agent_nickname: 'Galileo',
          parent_thread_id: 'aaaaaaaa-0000-0000-0000-000000000001',
          depth: 1
        }
      }
    },
    parentThreadId: 'aaaaaaaa-0000-0000-0000-000000000001'
  });
  await writeRollout(dir, {
    id: 'cccccccc-0000-0000-0000-000000000003',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-15T08:00:00.000Z',
    userMessage: 'guardian review',
    source: { subagent: { other: 'guardian' } }
  });
  const out = await scanSessions({ sessionsDir: dir });
  assert.equal(out.length, 1);
  assert.equal(out[0].preview, 'main thread');
  assert.equal(out[0].kind, 'cli');
});

test('scanSessions: includeSubagents=true keeps subagent sessions with labels', async () => {
  const dir = await mktemp();
  await writeRollout(dir, {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-17T08:00:00.000Z',
    userMessage: 'main thread',
    source: 'cli'
  });
  await writeRollout(dir, {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-16T08:00:00.000Z',
    userMessage: 'spawned agent work',
    source: {
      subagent: {
        thread_spawn: {
          agent_nickname: 'Galileo',
          parent_thread_id: 'aaaaaaaa-0000-0000-0000-000000000001',
          depth: 1
        }
      }
    }
  });
  const out = await scanSessions({ sessionsDir: dir, includeSubagents: true });
  assert.equal(out.length, 2);
  const sub = out.find((s) => s.kind === 'subagent');
  assert.ok(sub);
  assert.equal(sub.subagentLabel, 'Galileo');
  assert.equal(sub.parentThreadId, 'aaaaaaaa-0000-0000-0000-000000000001');
});

// ===== classifySessionSource =====

test('classifySessionSource: cli / null / exec / subagent shapes', () => {
  assert.deepEqual(classifySessionSource('cli'), { kind: 'cli', label: null });
  assert.deepEqual(classifySessionSource(null), { kind: 'cli', label: null });
  assert.deepEqual(classifySessionSource('exec'), { kind: 'exec', label: null });
  assert.deepEqual(classifySessionSource({ subagent: 'review' }), { kind: 'subagent', label: 'review' });
  assert.deepEqual(classifySessionSource({ subagent: { other: 'guardian' } }), {
    kind: 'subagent',
    label: 'guardian'
  });
  assert.deepEqual(
    classifySessionSource({
      subagent: { thread_spawn: { agent_nickname: 'Zeno', parent_thread_id: 'p1' } }
    }),
    { kind: 'subagent', label: 'Zeno' }
  );
  assert.equal(classifySessionSource('vscode').kind, 'other');
});

// ===== readSessionHead / readLastActivity =====

test('readSessionHead: returns null for a file without session_meta', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'rollout-x.jsonl');
  await fsp.writeFile(file, JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: 'hi' } }) + '\n');
  const head = await readSessionHead(file);
  assert.equal(head, null);
});

test('readSessionHead: classifies subagent and extracts parent_thread_id', async () => {
  const dir = await mktemp();
  const file = await writeRollout(dir, {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-16T08:00:00.000Z',
    userMessage: 'spawned',
    source: {
      subagent: {
        thread_spawn: {
          agent_nickname: 'Epicurus',
          parent_thread_id: 'parent-id-1',
          depth: 1
        }
      }
    },
    parentThreadId: 'parent-id-1'
  });
  const head = await readSessionHead(file);
  assert.equal(head.kind, 'subagent');
  assert.equal(head.subagentLabel, 'Epicurus');
  assert.equal(head.parentThreadId, 'parent-id-1');
});

test('readSessionHead: tsMs/timestamp follow last activity; startedAt keeps create time', async () => {
  const dir = await mktemp();
  const file = await writeRollout(dir, {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    cwd: '/root',
    provider: 'claudex-provider-a',
    timestamp: '2026-06-01T00:00:00.000Z',
    userMessage: 'started on A',
    laterEvents: [
      { timestamp: '2026-06-02T00:00:00.000Z' },
      { timestamp: '2026-06-03T15:30:00.000Z' }
    ]
  });
  const head = await readSessionHead(file);
  assert.equal(head.startedAt, '2026-06-01T00:00:00.000Z');
  assert.equal(head.timestamp, '2026-06-03T15:30:00.000Z');
  assert.equal(head.tsMs, Date.parse('2026-06-03T15:30:00.000Z'));
  // Provider label remains creation-time provider (A), even if later turns
  // happened under another active provider config.
  assert.equal(head.provider, 'claudex-provider-a');
  assert.equal(head.providerLabel, 'provider-a');
});

test('readLastActivity: reads trailing event timestamp without full-file scan', async () => {
  const dir = await mktemp();
  const file = await writeRollout(dir, {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    cwd: '/root',
    provider: 'opencoder',
    timestamp: '2026-06-01T00:00:00.000Z',
    userMessage: 'x',
    laterEvents: [{ timestamp: '2026-06-09T09:09:09.000Z' }]
  });
  const act = await readLastActivity(file);
  assert.equal(act.timestamp, '2026-06-09T09:09:09.000Z');
  assert.equal(act.tsMs, Date.parse('2026-06-09T09:09:09.000Z'));
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

test('sessionKindTag: empty for cli, labeled for subagent/exec', () => {
  assert.equal(sessionKindTag({ kind: 'cli' }), '');
  assert.equal(sessionKindTag({ kind: 'exec' }), '[exec]');
  assert.equal(sessionKindTag({ kind: 'subagent' }), '[subagent]');
  assert.equal(sessionKindTag({ kind: 'subagent', subagentLabel: 'Galileo' }), '[subagent:Galileo]');
});

test('formatSessionLine: includes index, time, provider label, preview', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  const line = formatSessionLine(
    { tsMs: now - 3 * 86400 * 1000, providerLabel: 'gpt_any_linuxdo', preview: 'hello world', kind: 'cli' },
    1,
    { nowMs: now }
  );
  assert.match(line, /1\./);
  assert.match(line, /3d ago/);
  assert.match(line, /gpt_any_linuxdo/);
  assert.match(line, /hello world/);
  assert.equal(line.includes('[subagent]'), false);
});

test('formatSessionLine: tags subagent sessions', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  const line = formatSessionLine(
    {
      tsMs: now,
      providerLabel: 'opencoder',
      preview: 'spawned agent work',
      kind: 'subagent',
      subagentLabel: 'Galileo'
    },
    2,
    { nowMs: now }
  );
  assert.match(line, /\[subagent:Galileo\]/);
  assert.match(line, /spawned agent work/);
});

test('formatSessionLine: truncates long preview', () => {
  const now = Date.parse('2026-06-17T12:00:00.000Z');
  const line = formatSessionLine(
    { tsMs: now, providerLabel: 'p', preview: 'x'.repeat(200), kind: 'cli' },
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
