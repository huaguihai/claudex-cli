import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { inspectDrift, acceptExternalChanges } from '../../src/codex/reconcile.js';
import { restoreChatGptTokens, findLatestChatGptBackup } from '../../src/codex/restore-chatgpt.js';
import { applyProviderSwitch } from '../../src/codex/apply-switch.js';
import { readAuthJson, detectChatGptAuth } from '../../src/codex/auth-json.js';
import { writeProvider } from '../../src/codex/providers.js';
import { readLastKnownHashes } from '../../src/codex/audit.js';

const tmpDirs = [];
process.on('exit', () => {
  for (const dir of tmpDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

async function mktemp(prefix = 'codexx-recon-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

async function withIsolatedHome(fn) {
  const codexHome = await mktemp('codex-home-');
  const claudexDir = await mktemp('claudex-dir-');
  const saved = {
    CODEX_HOME: process.env.CODEX_HOME,
    CLAUDEX_CONFIG_DIR: process.env.CLAUDEX_CONFIG_DIR
  };
  process.env.CODEX_HOME = codexHome;
  process.env.CLAUDEX_CONFIG_DIR = claudexDir;
  try {
    return await fn({ codexHome, claudexDir });
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const PROVIDER = {
  name: 'openrouter',
  base_url: 'https://openrouter.ai/api/v1',
  api_key: 'sk-or-FAKE',
  model: 'anthropic/claude-sonnet-4.5',
  wire_api: 'chat'
};

const OAUTH_TOKENS = {
  auth_mode: 'chatgpt',
  tokens: {
    id_token: 'jwt-id-1',
    access_token: 'jwt-access-1',
    refresh_token: 'jwt-refresh-1'
  },
  last_refresh: '2026-05-17T00:00:00Z'
};

// ===== reconcile =====

test('inspectDrift: returns no baseline when never written', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), 'model = "x"\n');
    const r = await inspectDrift();
    assert.equal(r.baseline, null);
  });
});

test('inspectDrift: no drift after fresh applyProviderSwitch', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    const r = await inspectDrift();
    assert.equal(r.drift.config, null);
    assert.equal(r.drift.auth, null);
  });
});

test('inspectDrift: detects config drift after external edit', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    const cur = await fsp.readFile(path.join(codexHome, 'config.toml'), 'utf8');
    await fsp.writeFile(path.join(codexHome, 'config.toml'), cur + '\n# external\n');
    const r = await inspectDrift();
    assert.ok(r.drift.config);
    assert.equal(r.drift.auth, null);
  });
});

test('inspectDrift: detects auth drift after codex login overwrite', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    // Simulate codex login wiping auth.json content
    await fsp.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify(OAUTH_TOKENS));
    const r = await inspectDrift();
    assert.ok(r.drift.auth);
  });
});

test('acceptExternalChanges: updates baseline to current hash', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    // Mutate
    const cur = await fsp.readFile(path.join(codexHome, 'config.toml'), 'utf8');
    await fsp.writeFile(path.join(codexHome, 'config.toml'), cur + '\n# external\n');
    // Reconcile
    await acceptExternalChanges();
    const r = await inspectDrift();
    assert.equal(r.drift.config, null);
    assert.equal(r.drift.auth, null);
  });
});

// ===== restore-chatgpt =====

test('findLatestChatGptBackup: null when no backups', async () => {
  await withIsolatedHome(async () => {
    assert.equal(await findLatestChatGptBackup(), null);
  });
});

test('restoreChatGptTokens: restores tokens written by applyProviderSwitch backup', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    // Set up: user had ChatGPT OAuth, then codexx switched to API key provider.
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await fsp.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify(OAUTH_TOKENS));
    await writeProvider(PROVIDER);
    const result = await applyProviderSwitch(PROVIDER);
    assert.ok(result.chatgptBackupPath, 'expected chatgpt backup to be created');

    // Now claudex auth is in apikey mode
    const before = await readAuthJson();
    assert.equal(before.auth_mode, 'apikey');

    // Restore ChatGPT tokens
    const restore = await restoreChatGptTokens();
    assert.ok(restore.backupId);

    // auth.json should now be the OAuth shape again
    const after = await readAuthJson();
    assert.equal(detectChatGptAuth(after), true);
    assert.equal(after.tokens.id_token, OAUTH_TOKENS.tokens.id_token);
  });
});

test('restoreChatGptTokens: throws when no chatgpt backup exists', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    // Switch to API key provider WITHOUT any prior OAuth state → no chatgpt backup created
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    await assert.rejects(() => restoreChatGptTokens(), /No ChatGPT tokens backup/);
  });
});

test('findLatestChatGptBackup: picks the most recent backup', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'config.toml'), '');
    // Two OAuth states → two switches → two backups
    await fsp.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({
      ...OAUTH_TOKENS,
      tokens: { ...OAUTH_TOKENS.tokens, id_token: 'old-id' }
    }));
    await writeProvider(PROVIDER);
    await applyProviderSwitch(PROVIDER);
    // Manually replant OAuth-style auth.json (simulating: user re-logged-in)
    await fsp.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({
      ...OAUTH_TOKENS,
      tokens: { ...OAUTH_TOKENS.tokens, id_token: 'new-id' }
    }));
    // Wait a moment to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));
    await applyProviderSwitch(PROVIDER);
    const found = await findLatestChatGptBackup();
    assert.equal(found.tokens.tokens.id_token, 'new-id');
  });
});
