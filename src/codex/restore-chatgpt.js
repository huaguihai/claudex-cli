import fsp from 'node:fs/promises';
import path from 'node:path';

import { codexAuthJsonPath } from './constants.js';
import { exists, writeAtomic } from '../shared/fs-utils.js';
import { listBackups } from './snapshot.js';
import { detectChatGptAuth } from './auth-json.js';
import { appendAuditEvent } from './audit.js';

/**
 * Find the most recent ChatGPT tokens backup written by codexx.
 * Returns { path, tokens } or null.
 */
export async function findLatestChatGptBackup(opts = {}) {
  const backups = await listBackups(opts);
  for (const b of backups) {
    const candidate = path.join(b.dir, 'chatgpt-tokens.json');
    if (await exists(candidate)) {
      try {
        const txt = await fsp.readFile(candidate, 'utf8');
        const parsed = JSON.parse(txt);
        if (detectChatGptAuth(parsed)) {
          return { path: candidate, backupId: b.id, tokens: parsed };
        }
      } catch {
        // skip malformed
      }
    }
  }
  return null;
}

/**
 * Restore ChatGPT OAuth tokens from the most recent backup into auth.json.
 * Overwrites whatever is currently in auth.json.
 */
export async function restoreChatGptTokens(opts = {}) {
  const found = await findLatestChatGptBackup(opts);
  if (!found) {
    throw new Error('No ChatGPT tokens backup found in codex-backups/');
  }
  const authPath = opts.authJsonPath || codexAuthJsonPath();
  const txt = JSON.stringify(found.tokens, null, 2) + '\n';
  await writeAtomic(authPath, txt, { mode: 0o600 });
  await appendAuditEvent({
    action: 'restore_chatgpt',
    backup_id: found.backupId,
    source: found.path
  });
  return { backupId: found.backupId, source: found.path };
}
