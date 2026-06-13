import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEventLine, scanTranscriptEvents } from '../../src/stats/transcript-reader.js';

test('parseEventLine extracts ts + sessionId from a valid line', () => {
  const line = JSON.stringify({ type: 'assistant', timestamp: '2026-06-07T12:00:00.000Z', sessionId: 's1' });
  const ev = parseEventLine(line);
  assert.equal(ev.ts, Date.parse('2026-06-07T12:00:00.000Z'));
  assert.equal(ev.sessionId, 's1');
});

test('parseEventLine returns null for blank, malformed, or timestamp-less lines', () => {
  assert.equal(parseEventLine(''), null);
  assert.equal(parseEventLine('   '), null);
  assert.equal(parseEventLine('{not json'), null);
  assert.equal(parseEventLine(JSON.stringify({ type: 'x', sessionId: 's' })), null); // no timestamp
  assert.equal(parseEventLine(JSON.stringify({ timestamp: 'not-a-date' })), null);
});

test('parseEventLine tolerates missing sessionId', () => {
  const ev = parseEventLine(JSON.stringify({ timestamp: '2026-06-07T12:00:00Z' }));
  assert.equal(ev.sessionId, null);
  assert.ok(Number.isFinite(ev.ts));
});

test('scanTranscriptEvents reads jsonl across project dirs and filters by sinceMs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claudex-stats-'));
  try {
    const projA = path.join(root, '-proj-a');
    fs.mkdirSync(projA, { recursive: true });
    const t = (iso, sid) => JSON.stringify({ timestamp: iso, sessionId: sid });
    fs.writeFileSync(path.join(projA, 's1.jsonl'), [
      t('2026-06-01T10:00:00Z', 's1'),
      'garbage line',
      t('2026-06-10T10:00:00Z', 's1'),
      ''
    ].join('\n'));

    const all = await scanTranscriptEvents({ projectsDir: root, sinceMs: 0 });
    assert.equal(all.length, 2);

    const sinceMs = Date.parse('2026-06-05T00:00:00Z');
    const recent = await scanTranscriptEvents({ projectsDir: root, sinceMs });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].sessionId, 's1');
    assert.ok(recent[0].ts >= sinceMs);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('scanTranscriptEvents returns [] when projects dir is absent', async () => {
  const missing = path.join(os.tmpdir(), 'claudex-stats-does-not-exist-xyz-123');
  const events = await scanTranscriptEvents({ projectsDir: missing });
  assert.deepEqual(events, []);
});
