import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  readAuthJson,
  writeAuthJson,
  detectChatGptAuth,
  inspectAuthJson,
  buildAuthForProvider,
  backupChatGptTokensIfPresent
} from '../../src/codex/auth-json.js';

async function mktemp(prefix = 'codexx-auth-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

const PROVIDER = {
  name: 'openrouter',
  base_url: 'https://openrouter.ai/api/v1',
  api_key: 'sk-or-v1-FAKE',
  model: 'anthropic/claude-sonnet-4.5'
};

const FIXED_TS = '2026-05-17T12:00:00.000Z';

test('readAuthJson: missing file → null', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'auth.json');
  assert.equal(await readAuthJson(file), null);
});

test('readAuthJson: reads JSON object', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'auth.json');
  await fsp.writeFile(file, JSON.stringify({ OPENAI_API_KEY: 'sk-test' }));
  const back = await readAuthJson(file);
  assert.deepEqual(back, { OPENAI_API_KEY: 'sk-test' });
});

test('writeAuthJson: writes atomic with chmod 600', async () => {
  if (process.platform === 'win32') return;
  const dir = await mktemp();
  const file = path.join(dir, 'auth.json');
  await writeAuthJson({ OPENAI_API_KEY: 'sk-secret', auth_mode: 'apikey' }, file);
  const stat = await fsp.stat(file);
  assert.equal(stat.mode & 0o777, 0o600);
  const back = await readAuthJson(file);
  assert.equal(back.OPENAI_API_KEY, 'sk-secret');
  assert.equal(back.auth_mode, 'apikey');
});

test('writeAuthJson: keys sorted alphabetically for deterministic output', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'auth.json');
  await writeAuthJson({ z: 1, a: 2, m: 3 }, file);
  const raw = await fsp.readFile(file, 'utf8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed), ['a', 'm', 'z']);
});

test('writeAuthJson: creates parent dir if missing', async () => {
  const dir = await mktemp();
  const file = path.join(dir, 'sub', 'nested', 'auth.json');
  await writeAuthJson({ OPENAI_API_KEY: 'x' }, file);
  const back = await readAuthJson(file);
  assert.equal(back.OPENAI_API_KEY, 'x');
});

test('detectChatGptAuth: false for null / empty / api-key-only', () => {
  assert.equal(detectChatGptAuth(null), false);
  assert.equal(detectChatGptAuth({}), false);
  assert.equal(detectChatGptAuth({ OPENAI_API_KEY: 'sk' }), false);
  assert.equal(detectChatGptAuth({ OPENAI_API_KEY: 'sk', auth_mode: 'apikey' }), false);
});

test('detectChatGptAuth: true when tokens.id_token present', () => {
  assert.equal(detectChatGptAuth({ tokens: { id_token: 'jwt' } }), true);
});

test('detectChatGptAuth: true when tokens.access_token present', () => {
  assert.equal(detectChatGptAuth({ tokens: { access_token: 'tok' } }), true);
});

test('detectChatGptAuth: true when auth_mode = "chatgpt"', () => {
  assert.equal(detectChatGptAuth({ auth_mode: 'chatgpt' }), true);
});

test('detectChatGptAuth: true when auth_mode = "chatgptAuthTokens"', () => {
  assert.equal(detectChatGptAuth({ auth_mode: 'chatgptAuthTokens' }), true);
});

test('inspectAuthJson: returns full summary for present file', () => {
  const r = inspectAuthJson({
    OPENAI_API_KEY: 'sk',
    auth_mode: 'apikey',
    _claudex_managed: true,
    _claudex_provider: 'openrouter'
  });
  assert.deepEqual(r, {
    present: true,
    hasApiKey: true,
    hasChatGptTokens: false,
    authMode: 'apikey',
    claudexManaged: true,
    claudexProvider: 'openrouter'
  });
});

test('inspectAuthJson: handles null/empty input', () => {
  const r = inspectAuthJson(null);
  assert.equal(r.present, false);
  assert.equal(r.hasApiKey, false);
});

test('inspectAuthJson: detects ChatGPT tokens', () => {
  const r = inspectAuthJson({ auth_mode: 'chatgpt', tokens: { id_token: 'jwt' } });
  assert.equal(r.hasChatGptTokens, true);
  assert.equal(r.authMode, 'chatgpt');
});

test('buildAuthForProvider: produces expected schema', () => {
  const auth = buildAuthForProvider(PROVIDER, { ts: FIXED_TS });
  assert.equal(auth.OPENAI_API_KEY, 'sk-or-v1-FAKE');
  assert.equal(auth.auth_mode, 'apikey');
  assert.equal(auth._claudex_managed, true);
  assert.equal(auth._claudex_provider, 'openrouter');
  assert.equal(auth._claudex_ts, FIXED_TS);
  assert.equal(auth._claudex_schema, 1);
});

test('backupChatGptTokensIfPresent: null when no chatgpt auth', async () => {
  const dir = await mktemp();
  const result = await backupChatGptTokensIfPresent(
    { OPENAI_API_KEY: 'sk' },
    { backupDir: dir }
  );
  assert.equal(result, null);
});

test('backupChatGptTokensIfPresent: writes backup when chatgpt tokens present', async () => {
  if (process.platform === 'win32') return;
  const dir = await mktemp();
  const tokens = {
    auth_mode: 'chatgpt',
    tokens: { id_token: 'jwt', access_token: 'a', refresh_token: 'r' },
    last_refresh: '2026-01-01'
  };
  const backupPath = await backupChatGptTokensIfPresent(tokens, { backupDir: dir });
  assert.ok(backupPath);
  assert.ok(backupPath.endsWith('chatgpt-tokens.json'));
  const back = JSON.parse(await fsp.readFile(backupPath, 'utf8'));
  assert.deepEqual(back, tokens);
  const stat = await fsp.stat(backupPath);
  assert.equal(stat.mode & 0o777, 0o600);
});
