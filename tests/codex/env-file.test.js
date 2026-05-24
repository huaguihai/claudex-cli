import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  spliceClaudexEnv,
  removeClaudexEnv,
  applyClaudexEnv,
  clearClaudexEnv,
  readEnvFile,
  writeEnvFile,
  ENV_MARKER_BEGIN,
  ENV_MARKER_END
} from '../../src/codex/env-file.js';

async function mktemp(prefix = 'codexx-envfile-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  return path.join(dir, '.env');
}

// ===== pure splice/remove =====

test('spliceClaudexEnv: inserts into empty file', () => {
  const out = spliceClaudexEnv('', { OPENAI_API_KEY: 'sk-test' });
  assert.ok(out.includes(ENV_MARKER_BEGIN));
  assert.ok(out.includes(ENV_MARKER_END));
  assert.ok(out.includes('OPENAI_API_KEY=sk-test'));
});

test('spliceClaudexEnv: appends to file with user content (preserves user lines)', () => {
  const existing = `MY_VAR=foo\nANOTHER=bar\n`;
  const out = spliceClaudexEnv(existing, { OPENAI_API_KEY: 'sk' });
  assert.ok(out.startsWith('MY_VAR=foo\nANOTHER=bar'));
  assert.ok(out.includes('OPENAI_API_KEY=sk'));
});

test('spliceClaudexEnv: replaces existing block in place', () => {
  const initial = spliceClaudexEnv('MY=v\n', { OPENAI_API_KEY: 'old' });
  const updated = spliceClaudexEnv(initial, { OPENAI_API_KEY: 'new' });
  assert.ok(updated.includes('OPENAI_API_KEY=new'));
  assert.ok(!updated.includes('OPENAI_API_KEY=old'));
  assert.ok(updated.includes('MY=v'));
  // exactly one BEGIN
  const begins = updated.split(ENV_MARKER_BEGIN).length - 1;
  assert.equal(begins, 1);
});

test('spliceClaudexEnv: refuses dangling BEGIN', () => {
  const broken = `MY=v\n${ENV_MARKER_BEGIN}\nfoo\n(no end)\n`;
  assert.throws(() => spliceClaudexEnv(broken, { OPENAI_API_KEY: 'x' }), /dangling BEGIN/);
});

test('removeClaudexEnv: removes block + collapses leading blank', () => {
  const initial = spliceClaudexEnv('USER=v\n', { OPENAI_API_KEY: 'x' });
  const { rawAfter, removed } = removeClaudexEnv(initial);
  assert.equal(removed, true);
  assert.ok(!rawAfter.includes(ENV_MARKER_BEGIN));
  assert.ok(!rawAfter.includes('OPENAI_API_KEY'));
  assert.ok(rawAfter.includes('USER=v'));
});

test('removeClaudexEnv: no-op when block absent', () => {
  const { rawAfter, removed } = removeClaudexEnv('MY=v\n');
  assert.equal(removed, false);
  assert.equal(rawAfter, 'MY=v\n');
});

test('formatPairs: escapes special characters by single-quoting', () => {
  const out = spliceClaudexEnv('', { TRICKY: 'has spaces and #' });
  assert.ok(out.includes("TRICKY='has spaces and #'"));
});

test('formatPairs: leaves safe values bare', () => {
  const out = spliceClaudexEnv('', { SIMPLE: 'sk-abc123' });
  assert.ok(out.includes('SIMPLE=sk-abc123'));
  assert.ok(!out.includes("'sk-abc123'"));
});

test('formatPairs: skips undefined / null values', () => {
  const out = spliceClaudexEnv('', { KEEP: 'v', SKIP: undefined, ALSO_SKIP: null });
  assert.ok(out.includes('KEEP=v'));
  assert.ok(!out.includes('SKIP'));
});

// ===== file I/O =====

test('readEnvFile: returns "" when file absent', async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'env-test-'));
  const file = path.join(dir, '.env');
  assert.equal(await readEnvFile(file), '');
});

test('writeEnvFile + readEnvFile round-trip', async () => {
  const file = await mktemp();
  await writeEnvFile('OPENAI_API_KEY=sk\n', file);
  assert.equal(await readEnvFile(file), 'OPENAI_API_KEY=sk\n');
});

test('writeEnvFile: chmod 600 on Unix', async () => {
  if (process.platform === 'win32') return;
  const file = await mktemp();
  await writeEnvFile('K=V\n', file);
  const stat = await fsp.stat(file);
  assert.equal(stat.mode & 0o777, 0o600);
});

test('writeEnvFile: empty content deletes the file', async () => {
  const file = await mktemp();
  await writeEnvFile('K=V\n', file);
  await writeEnvFile('', file);
  let exists = true;
  try {
    await fsp.access(file);
  } catch {
    exists = false;
  }
  assert.equal(exists, false);
});

test('applyClaudexEnv: end-to-end insert into empty', async () => {
  const file = await mktemp();
  await applyClaudexEnv({ OPENAI_API_KEY: 'sk-xyz' }, file);
  const back = await readEnvFile(file);
  assert.ok(back.includes('OPENAI_API_KEY=sk-xyz'));
  assert.ok(back.includes(ENV_MARKER_BEGIN));
});

test('applyClaudexEnv: preserves user content across writes', async () => {
  const file = await mktemp();
  await writeEnvFile('USER_VAR=keep_me\n', file);
  await applyClaudexEnv({ OPENAI_API_KEY: 'sk-1' }, file);
  await applyClaudexEnv({ OPENAI_API_KEY: 'sk-2' }, file);
  const back = await readEnvFile(file);
  assert.ok(back.includes('USER_VAR=keep_me'));
  assert.ok(back.includes('OPENAI_API_KEY=sk-2'));
  assert.ok(!back.includes('OPENAI_API_KEY=sk-1'));
});

test('clearClaudexEnv: removes block, keeps user content', async () => {
  const file = await mktemp();
  await writeEnvFile('USER_VAR=keep\n', file);
  await applyClaudexEnv({ OPENAI_API_KEY: 'sk' }, file);
  const r = await clearClaudexEnv(file);
  assert.equal(r.removed, true);
  const back = await readEnvFile(file);
  assert.ok(back.includes('USER_VAR=keep'));
  assert.ok(!back.includes('OPENAI_API_KEY'));
});

test('clearClaudexEnv: deletes file if only block was present', async () => {
  const file = await mktemp();
  await applyClaudexEnv({ OPENAI_API_KEY: 'sk' }, file);
  await clearClaudexEnv(file);
  assert.equal(await readEnvFile(file), '');
  let exists = true;
  try {
    await fsp.access(file);
  } catch {
    exists = false;
  }
  assert.equal(exists, false);
});
