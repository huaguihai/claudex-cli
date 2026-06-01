import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {
  buildNativeContent,
  spliceNativeBlock,
  removeNativeBlock,
  injectNativeContext,
  removeNativeContext,
  nativeStatus,
  setNativeProfile,
  readNativeState,
  NATIVE_PROFILES
} from '../../src/codex/native.js';
import {
  AGENTS_MD_MARKER_BEGIN,
  AGENTS_MD_MARKER_END
} from '../../src/codex/constants.js';
import { writeProvider, setCurrentProvider } from '../../src/codex/providers.js';

async function mktemp(prefix = 'codexx-native-test-') {
  const dir = path.join(os.tmpdir(), prefix + crypto.randomBytes(8).toString('hex'));
  await fsp.mkdir(dir, { recursive: true });
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

// ===== pure helpers =====

test('buildNativeContent: includes provider details when given', () => {
  const out = buildNativeContent({ provider: PROVIDER, profile: 'balanced' });
  assert.match(out, /Active provider: `openrouter`/);
  assert.match(out, /Endpoint: `https:\/\/openrouter.ai\/api\/v1`/);
  assert.match(out, /Profile: `balanced`/);
});

test('buildNativeContent: handles no provider gracefully', () => {
  const out = buildNativeContent({ provider: null, profile: 'native-first' });
  assert.ok(!out.includes('Active provider'));
  assert.match(out, /Profile: `native-first`/);
  assert.match(out, /Profile guidance — native-first/);
});

test('buildNativeContent: profile guidance varies per profile', () => {
  const nf = buildNativeContent({ provider: null, profile: 'native-first' });
  const bal = buildNativeContent({ provider: null, profile: 'balanced' });
  const cf = buildNativeContent({ provider: null, profile: 'cost-first' });
  assert.notEqual(nf, bal);
  assert.notEqual(bal, cf);
  assert.match(nf, /native Codex workflows/);
  assert.match(bal, /provider-agnostic/);
  assert.match(cf, /Minimise delegation/);
});

test('spliceNativeBlock: inserts into empty file with markers', () => {
  const { rawAfter } = spliceNativeBlock('', 'BODY');
  assert.ok(rawAfter.includes(AGENTS_MD_MARKER_BEGIN));
  assert.ok(rawAfter.includes(AGENTS_MD_MARKER_END));
  assert.ok(rawAfter.includes('BODY'));
});

test('spliceNativeBlock: appends to existing file (preserves user content)', () => {
  const existing = '# user agents\n\nMy notes here.\n';
  const { rawAfter } = spliceNativeBlock(existing, 'BODY');
  assert.ok(rawAfter.startsWith('# user agents'));
  assert.ok(rawAfter.includes('My notes here.'));
  assert.ok(rawAfter.includes('BODY'));
});

test('spliceNativeBlock: replaces existing block in place', () => {
  const initial = spliceNativeBlock('# user\n\nNotes.\n', 'OLD BODY').rawAfter;
  const updated = spliceNativeBlock(initial, 'NEW BODY').rawAfter;
  assert.ok(updated.includes('NEW BODY'));
  assert.ok(!updated.includes('OLD BODY'));
  // user content still present
  assert.ok(updated.includes('Notes.'));
  // exactly one BEGIN
  const begins = updated.split(AGENTS_MD_MARKER_BEGIN).length - 1;
  assert.equal(begins, 1);
});

test('spliceNativeBlock: refuses dangling BEGIN without END', () => {
  const broken = `# user\n${AGENTS_MD_MARKER_BEGIN}\nbody\n(no end)\n`;
  assert.throws(() => spliceNativeBlock(broken, 'NEW'), /dangling BEGIN/);
});

test('removeNativeBlock: removes block + leading blank line', () => {
  const initial = spliceNativeBlock('# user\n\nNotes.\n', 'BODY').rawAfter;
  const { rawAfter, removed } = removeNativeBlock(initial);
  assert.equal(removed, true);
  assert.ok(!rawAfter.includes(AGENTS_MD_MARKER_BEGIN));
  assert.ok(!rawAfter.includes(AGENTS_MD_MARKER_END));
  assert.ok(!rawAfter.includes('BODY'));
  assert.ok(rawAfter.includes('Notes.'));
});

test('removeNativeBlock: no-op when block absent', () => {
  const { rawAfter, removed } = removeNativeBlock('# user\n\nNotes.\n');
  assert.equal(removed, false);
  assert.equal(rawAfter, '# user\n\nNotes.\n');
});

// ===== state management =====

test('injectNativeContext: writes markers + state on first run', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), '# user notes\n');
    await writeProvider(PROVIDER);
    await setCurrentProvider('openrouter');
    const r = await injectNativeContext();
    assert.equal(r.providerName, 'openrouter');
    const content = await fsp.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    assert.ok(content.includes('# user notes'));
    assert.ok(content.includes(AGENTS_MD_MARKER_BEGIN));
    assert.ok(content.includes('openrouter'));
    const state = await readNativeState();
    assert.equal(state.enabled, true);
    assert.ok(state.last_injected_hash);
  });
});

test('injectNativeContext: idempotent (multiple runs leave single block)', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), '# user\n');
    await writeProvider(PROVIDER);
    await setCurrentProvider('openrouter');
    await injectNativeContext();
    await injectNativeContext();
    await injectNativeContext();
    const content = await fsp.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    const begins = content.split(AGENTS_MD_MARKER_BEGIN).length - 1;
    assert.equal(begins, 1);
  });
});

test('removeNativeContext: clean uninstall + state off', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    const original = '# user\n\nNotes here.\n';
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), original);
    await writeProvider(PROVIDER);
    await setCurrentProvider('openrouter');
    await injectNativeContext();
    const r = await removeNativeContext();
    assert.equal(r.removed, true);
    const after = await fsp.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    assert.equal(after, original);
    const state = await readNativeState();
    assert.equal(state.enabled, false);
    assert.equal(state.last_injected_hash, null);
  });
});

test('nativeStatus: flags inconsistency when state says on but markers missing', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), '# user\n');
    await writeProvider(PROVIDER);
    await setCurrentProvider('openrouter');
    await injectNativeContext();
    // User deletes the markers manually (simulating tamper)
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), '# user\n');
    const s = await nativeStatus();
    assert.equal(s.enabled, true);
    assert.equal(s.injectedInFile, false);
  });
});

test('setNativeProfile: rejects invalid name', async () => {
  await withIsolatedHome(async () => {
    await assert.rejects(() => setNativeProfile('extreme'), /invalid profile/);
  });
});

test('setNativeProfile: re-injects when native is enabled', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), '# user\n');
    await writeProvider(PROVIDER);
    await setCurrentProvider('openrouter');
    await injectNativeContext();
    await setNativeProfile('cost-first');
    const content = await fsp.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    assert.match(content, /Profile: `cost-first`/);
  });
});

test('setNativeProfile: leaves AGENTS.md untouched when native is off', async () => {
  await withIsolatedHome(async ({ codexHome }) => {
    const userContent = '# user only\n';
    await fsp.writeFile(path.join(codexHome, 'AGENTS.md'), userContent);
    await setNativeProfile('native-first');
    const after = await fsp.readFile(path.join(codexHome, 'AGENTS.md'), 'utf8');
    assert.equal(after, userContent);
    const state = await readNativeState();
    assert.equal(state.profile, 'native-first');
    assert.equal(state.enabled, false);
  });
});

test('NATIVE_PROFILES contains the canonical three', () => {
  assert.deepEqual(NATIVE_PROFILES.sort(), ['balanced', 'cost-first', 'native-first']);
});
