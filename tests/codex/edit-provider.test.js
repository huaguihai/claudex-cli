import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  writeProvider,
  readProvider,
  editProvider
} from '../../src/codex/providers.js';

async function mktemp(prefix = 'codexx-edit-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

const VALID_PROVIDER = {
  name: 'openrouter',
  base_url: 'https://openrouter.ai/api/v1',
  api_key: 'sk-or-v1-FAKE',
  model: 'anthropic/claude-sonnet-4.5',
  wire_api: 'chat'
};

test('editProvider: updates only patched fields', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await editProvider('openrouter', { model: 'gpt-5-codex' }, { dir });
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.model, 'gpt-5-codex');
  assert.equal(back.base_url, VALID_PROVIDER.base_url); // unchanged
  assert.equal(back.api_key, VALID_PROVIDER.api_key);
  assert.ok(back.updated_at);
});

test('editProvider: ignores attempt to rename', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await editProvider('openrouter', { name: 'evil', model: 'x' }, { dir });
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.name, 'openrouter'); // unchanged
  assert.equal(back.model, 'x');
});

test('editProvider: ignores attempt to change schema_version / created_at', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  const before = await readProvider('openrouter', { dir });
  await editProvider('openrouter', { schema_version: 99, created_at: '1970-01-01' }, { dir });
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.schema_version, before.schema_version);
  assert.equal(back.created_at, before.created_at);
});

test('editProvider: normalises new base_url', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await editProvider('openrouter', { base_url: 'https://other.example.com' }, { dir });
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.base_url, 'https://other.example.com/v1');
});

test('editProvider: rejects invalid wire_api', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await assert.rejects(
    () => editProvider('openrouter', { wire_api: 'grpc' }, { dir }),
    /wire_api/
  );
  // Original value preserved on failure
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.wire_api, 'chat');
});

test('editProvider: rejects empty api_key', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await assert.rejects(
    () => editProvider('openrouter', { api_key: '' }, { dir }),
    /api_key/
  );
});

test('editProvider: throws if provider not found', async () => {
  const dir = await mktemp();
  await assert.rejects(
    () => editProvider('ghost', { model: 'x' }, { dir }),
    /not found/
  );
});

test('editProvider: skips undefined values', async () => {
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await editProvider('openrouter', { model: undefined, base_url: undefined, api_key: 'sk-new' }, { dir });
  const back = await readProvider('openrouter', { dir });
  assert.equal(back.model, VALID_PROVIDER.model); // unchanged
  assert.equal(back.api_key, 'sk-new');
});

test('editProvider: writes chmod 600', async () => {
  if (process.platform === 'win32') return;
  const dir = await mktemp();
  await writeProvider(VALID_PROVIDER, { dir });
  await editProvider('openrouter', { model: 'gpt-5-codex' }, { dir });
  const stat = await fsp.stat(path.join(dir, 'openrouter.json'));
  assert.equal(stat.mode & 0o777, 0o600);
});
