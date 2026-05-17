import { writeAtomic, readJson, exists, ensureDir } from '../shared/fs-utils.js';
import path from 'node:path';
import fsp from 'node:fs/promises';
import {
  codexAuthJsonPath,
  codexBackupsDir,
  SCHEMA_VERSION
} from './constants.js';
import { isoStamp } from '../shared/fs-utils.js';

/**
 * Read ~/.codex/auth.json if present. Returns null if file does not exist.
 * Throws on JSON parse error (caller should decide whether to refuse to proceed).
 */
export async function readAuthJson(filePath) {
  const p = filePath || codexAuthJsonPath();
  if (!(await exists(p))) return null;
  return readJson(p);
}

/**
 * Atomic write of auth.json with mode 0600.
 */
export async function writeAuthJson(content, filePath) {
  const p = filePath || codexAuthJsonPath();
  await ensureDir(path.dirname(p));
  const txt = JSON.stringify(sortKeysShallow(content), null, 2) + '\n';
  await writeAtomic(p, txt, { mode: 0o600 });
}

/**
 * Detect ChatGPT-style auth (OAuth tokens present).
 */
export function detectChatGptAuth(content) {
  if (!content || typeof content !== 'object') return false;
  if (content.auth_mode === 'chatgpt' || content.auth_mode === 'chatgptAuthTokens') return true;
  if (content.tokens && typeof content.tokens === 'object') {
    if (content.tokens.id_token || content.tokens.access_token || content.tokens.refresh_token) {
      return true;
    }
  }
  return false;
}

/**
 * Summarise an auth.json content blob for diagnostics / drift detection.
 */
export function inspectAuthJson(content) {
  if (!content || typeof content !== 'object') {
    return {
      present: false,
      hasApiKey: false,
      hasChatGptTokens: false,
      authMode: null,
      claudexManaged: false,
      claudexProvider: null
    };
  }
  return {
    present: true,
    hasApiKey: typeof content.OPENAI_API_KEY === 'string' && content.OPENAI_API_KEY.length > 0,
    hasChatGptTokens: detectChatGptAuth(content),
    authMode: content.auth_mode || null,
    claudexManaged: content._claudex_managed === true,
    claudexProvider: content._claudex_provider || null
  };
}

/**
 * Build the auth.json payload for an active claudex provider.
 * Note: does NOT include ChatGPT tokens. The caller backs those up separately.
 */
export function buildAuthForProvider(provider, opts = {}) {
  const ts = typeof opts.ts === 'string' ? opts.ts : new Date().toISOString();
  return {
    OPENAI_API_KEY: provider.api_key,
    auth_mode: 'apikey',
    _claudex_managed: true,
    _claudex_provider: provider.name,
    _claudex_schema: SCHEMA_VERSION,
    _claudex_ts: ts
  };
}

/**
 * If auth.json currently holds ChatGPT OAuth tokens, write a backup
 * copy to ~/.config/claudex-cli/codex-backups/<ts>/chatgpt-tokens.json.
 * Returns the backup path or null if no backup was needed.
 */
export async function backupChatGptTokensIfPresent(content, opts = {}) {
  if (!detectChatGptAuth(content)) return null;
  const stamp = opts.timestamp || isoStamp();
  const dir = opts.backupDir || path.join(codexBackupsDir(), stamp);
  await ensureDir(dir);
  const backupPath = path.join(dir, 'chatgpt-tokens.json');
  const txt = JSON.stringify(content, null, 2) + '\n';
  await writeAtomic(backupPath, txt, { mode: 0o600 });
  return backupPath;
}

function sortKeysShallow(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const sorted = {};
  for (const k of Object.keys(obj).sort()) sorted[k] = obj[k];
  return sorted;
}
