import os from 'node:os';
import path from 'node:path';

export const RESERVED_PROVIDER_IDS = new Set([
  'openai',
  'oss',
  'ollama',
  'ollama-chat',
  'lmstudio',
  'amazon-bedrock'
]);

export const CLAUDEX_PROVIDER_PREFIX = 'claudex-';

export const CONFIG_TOML_MARKER_BEGIN_PREFIX = '# claudex-cli managed BEGIN';
export const CONFIG_TOML_MARKER_END = '# claudex-cli managed END';

// Legacy markers from the removed codexx Native feature. Kept only so init can
// scrub leftover blocks from ~/.codex/AGENTS.md written by older versions.
export const LEGACY_AGENTS_MD_MARKER_BEGIN =
  '<!-- claudex-cli native context BEGIN — managed automatically, do not edit -->';
export const LEGACY_AGENTS_MD_MARKER_END = '<!-- claudex-cli native context END -->';

export const SCHEMA_VERSION = 1;

export function codexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function codexConfigTomlPath() {
  return path.join(codexHome(), 'config.toml');
}

export function codexAuthJsonPath() {
  return path.join(codexHome(), 'auth.json');
}

export function codexSessionsDir() {
  // Codex stores interactive session transcripts ("rollouts") under
  // ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl. The first line of
  // each file is a session_meta record holding id / cwd / model_provider.
  return path.join(codexHome(), 'sessions');
}

export function codexEnvFilePath() {
  // Loaded by codex's arg0 dispatcher before Tokio starts: every KEY=VAL
  // becomes a process env var (except CODEX_-prefixed which are filtered).
  // This is the only env source the Desktop App / IDE extension can rely on,
  // since GUI launches don't inherit shell env.
  return path.join(codexHome(), '.env');
}

export function claudexAppDir() {
  return process.env.CLAUDEX_CONFIG_DIR || path.join(os.homedir(), '.config', 'claudex-cli');
}

export function codexProvidersDir() {
  return path.join(claudexAppDir(), 'codex-providers');
}

export function codexCurrentProviderFile() {
  return path.join(claudexAppDir(), 'codex-current-provider');
}

export function codexBackupsDir() {
  return path.join(claudexAppDir(), 'codex-backups');
}

export function codexSnapshotDir() {
  return path.join(claudexAppDir(), 'codex-snapshot', 'pre-claudex');
}

export function codexAuditLogPath() {
  return path.join(claudexAppDir(), 'codex-audit.log');
}

export function codexLastKnownHashesPath() {
  return path.join(claudexAppDir(), 'codex-last-known-hashes.json');
}

export function codexLockPath() {
  return path.join(claudexAppDir(), 'codex.lock');
}

/** Legacy path kept so init can delete leftover state from older installs. */
export function legacyCodexNativeStatePath() {
  return path.join(claudexAppDir(), 'codex-native.json');
}

/** Legacy path kept so init can scrub leftover AGENTS.md blocks. */
export function codexAgentsMdPath() {
  return path.join(codexHome(), 'AGENTS.md');
}

export function isReservedProviderId(name) {
  return RESERVED_PROVIDER_IDS.has(name);
}

export function isValidProviderName(name) {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 64) return false;
  // Allow lowercase alphanumeric, underscores, and hyphens. First char must
  // be alphanumeric (no leading separator). Matches claudex's existing
  // convention of names like `claude_any_baiwan`.
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) return false;
  if (name.startsWith(CLAUDEX_PROVIDER_PREFIX)) return false;
  if (isReservedProviderId(name)) return false;
  return true;
}

export function toClaudexProviderId(name) {
  return `${CLAUDEX_PROVIDER_PREFIX}${name}`;
}

export function fromClaudexProviderId(id) {
  if (typeof id !== 'string' || !id.startsWith(CLAUDEX_PROVIDER_PREFIX)) return null;
  return id.slice(CLAUDEX_PROVIDER_PREFIX.length);
}
