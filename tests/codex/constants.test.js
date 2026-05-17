import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import {
  RESERVED_PROVIDER_IDS,
  CLAUDEX_PROVIDER_PREFIX,
  CONFIG_TOML_MARKER_BEGIN_PREFIX,
  CONFIG_TOML_MARKER_END,
  AGENTS_MD_MARKER_BEGIN,
  AGENTS_MD_MARKER_END,
  SCHEMA_VERSION,
  codexHome,
  codexConfigTomlPath,
  codexAuthJsonPath,
  codexAgentsMdPath,
  claudexAppDir,
  codexProvidersDir,
  codexCurrentProviderFile,
  codexBackupsDir,
  codexSnapshotDir,
  codexAuditLogPath,
  codexLastKnownHashesPath,
  codexNativeStatePath,
  codexLockPath,
  isReservedProviderId,
  isValidProviderName,
  toClaudexProviderId,
  fromClaudexProviderId
} from '../../src/codex/constants.js';

test('RESERVED_PROVIDER_IDS includes all known reserved ids', () => {
  for (const id of ['openai', 'oss', 'ollama', 'ollama-chat', 'lmstudio', 'amazon-bedrock']) {
    assert.equal(RESERVED_PROVIDER_IDS.has(id), true, `missing reserved id: ${id}`);
  }
});

test('isReservedProviderId: true for reserved, false otherwise', () => {
  assert.equal(isReservedProviderId('openai'), true);
  assert.equal(isReservedProviderId('ollama'), true);
  assert.equal(isReservedProviderId('mycustom'), false);
  assert.equal(isReservedProviderId('claudex-foo'), false);
});

test('isValidProviderName: lowercase alphanumeric with hyphens', () => {
  assert.equal(isValidProviderName('openrouter'), true);
  assert.equal(isValidProviderName('foo-bar'), true);
  assert.equal(isValidProviderName('a1'), true);
  assert.equal(isValidProviderName('a'), true);
});

test('isValidProviderName: rejects invalid characters', () => {
  assert.equal(isValidProviderName(''), false);
  assert.equal(isValidProviderName('Foo'), false);
  assert.equal(isValidProviderName('foo_bar'), false);
  assert.equal(isValidProviderName('foo.bar'), false);
  assert.equal(isValidProviderName('-foo'), false);
  assert.equal(isValidProviderName('foo bar'), false);
  assert.equal(isValidProviderName(null), false);
  assert.equal(isValidProviderName(undefined), false);
  assert.equal(isValidProviderName(123), false);
});

test('isValidProviderName: rejects reserved ids', () => {
  assert.equal(isValidProviderName('openai'), false);
  assert.equal(isValidProviderName('ollama'), false);
});

test('isValidProviderName: rejects claudex- prefix', () => {
  assert.equal(isValidProviderName('claudex-foo'), false);
  assert.equal(isValidProviderName('claudex-'), false);
});

test('isValidProviderName: rejects > 64 char names', () => {
  assert.equal(isValidProviderName('a'.repeat(64)), true);
  assert.equal(isValidProviderName('a'.repeat(65)), false);
});

test('toClaudexProviderId: prefixes with claudex-', () => {
  assert.equal(toClaudexProviderId('openrouter'), 'claudex-openrouter');
});

test('fromClaudexProviderId: round-trips toClaudexProviderId', () => {
  assert.equal(fromClaudexProviderId('claudex-openrouter'), 'openrouter');
  assert.equal(fromClaudexProviderId('claudex-foo-bar'), 'foo-bar');
});

test('fromClaudexProviderId: returns null for non-claudex ids', () => {
  assert.equal(fromClaudexProviderId('openai'), null);
  assert.equal(fromClaudexProviderId(''), null);
  assert.equal(fromClaudexProviderId(null), null);
  assert.equal(fromClaudexProviderId('foo'), null);
});

test('codexHome: respects CODEX_HOME env var', () => {
  const prev = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = '/tmp/codex-home-test';
    assert.equal(codexHome(), '/tmp/codex-home-test');
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
  }
});

test('codexHome: defaults to ~/.codex when env unset', () => {
  const prev = process.env.CODEX_HOME;
  try {
    delete process.env.CODEX_HOME;
    assert.equal(codexHome(), path.join(os.homedir(), '.codex'));
  } finally {
    if (prev !== undefined) process.env.CODEX_HOME = prev;
  }
});

test('config-derived paths anchor to codexHome()', () => {
  const prev = process.env.CODEX_HOME;
  try {
    process.env.CODEX_HOME = '/tmp/codex-home-test';
    assert.equal(codexConfigTomlPath(), '/tmp/codex-home-test/config.toml');
    assert.equal(codexAuthJsonPath(), '/tmp/codex-home-test/auth.json');
    assert.equal(codexAgentsMdPath(), '/tmp/codex-home-test/AGENTS.md');
    assert.equal(codexLockPath(), '/tmp/codex-home-test/.codexx-lock');
  } finally {
    if (prev === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prev;
  }
});

test('claudex-app paths anchor under ~/.config/claudex-cli', () => {
  const home = os.homedir();
  const app = path.join(home, '.config', 'claudex-cli');
  assert.equal(claudexAppDir(), app);
  assert.equal(codexProvidersDir(), path.join(app, 'codex-providers'));
  assert.equal(codexCurrentProviderFile(), path.join(app, 'codex-current-provider'));
  assert.equal(codexBackupsDir(), path.join(app, 'codex-backups'));
  assert.equal(codexSnapshotDir(), path.join(app, 'codex-snapshot', 'pre-claudex'));
  assert.equal(codexAuditLogPath(), path.join(app, 'codex-audit.log'));
  assert.equal(codexLastKnownHashesPath(), path.join(app, 'codex-last-known-hashes.json'));
  assert.equal(codexNativeStatePath(), path.join(app, 'codex-native.json'));
});

test('SCHEMA_VERSION matches spec', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

test('markers are stable strings', () => {
  assert.equal(typeof CONFIG_TOML_MARKER_BEGIN_PREFIX, 'string');
  assert.equal(typeof CONFIG_TOML_MARKER_END, 'string');
  assert.equal(typeof AGENTS_MD_MARKER_BEGIN, 'string');
  assert.equal(typeof AGENTS_MD_MARKER_END, 'string');
  assert.equal(CLAUDEX_PROVIDER_PREFIX, 'claudex-');
});
