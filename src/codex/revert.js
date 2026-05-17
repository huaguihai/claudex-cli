import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  codexConfigTomlPath,
  codexAuthJsonPath,
  codexAgentsMdPath,
  codexSnapshotDir,
  codexCurrentProviderFile,
  codexLastKnownHashesPath,
  codexBackupsDir
} from './constants.js';
import { exists, ensureDir, writeAtomic } from '../shared/fs-utils.js';
import { readSnapshotManifest, listBackups } from './snapshot.js';
import { appendAuditEvent } from './audit.js';

/**
 * Restore ~/.codex/ to the pre-claudex snapshot.
 * Refuses if no snapshot exists.
 *
 * Options:
 *   yes: skip confirmation (the caller does the UI)
 *   preserveBackups: if false, also delete codex-backups/ (default: preserve)
 *   keepAuditLog: if true, keep codex-audit.log (default: true)
 *   removeStateFiles: if true, delete codex-current-provider + codex-last-known-hashes.json (default: true)
 */
export async function revertToPreClaudex(opts = {}) {
  const snapshotDir = opts.snapshotDir || codexSnapshotDir();
  const configPath = opts.configTomlPath || codexConfigTomlPath();
  const authPath = opts.authJsonPath || codexAuthJsonPath();
  const agentsPath = opts.agentsMdPath || codexAgentsMdPath();

  const manifest = await readSnapshotManifest({ dir: snapshotDir });
  if (!manifest) {
    throw new Error('no pre-claudex snapshot found — cannot safely revert');
  }

  const result = {
    restored: { config_toml: false, auth_json: false, agents_md: false },
    deleted: { auth_json: false, agents_md: false, current_provider: false, last_known_hashes: false, backups: false }
  };

  // config.toml
  const snapConfig = path.join(snapshotDir, 'config.toml');
  if (await exists(snapConfig)) {
    const txt = await fsp.readFile(snapConfig, 'utf8');
    await writeAtomic(configPath, txt);
    result.restored.config_toml = true;
  }

  // auth.json — restore if snapshot had it; delete current if snapshot didn't
  const snapAuth = path.join(snapshotDir, 'auth.json');
  if (await exists(snapAuth)) {
    const txt = await fsp.readFile(snapAuth, 'utf8');
    await writeAtomic(authPath, txt, { mode: 0o600 });
    result.restored.auth_json = true;
  } else if (await exists(authPath)) {
    await fsp.unlink(authPath);
    result.deleted.auth_json = true;
  }

  // AGENTS.md
  const snapAgents = path.join(snapshotDir, 'AGENTS.md');
  if (await exists(snapAgents)) {
    const txt = await fsp.readFile(snapAgents, 'utf8');
    await writeAtomic(agentsPath, txt);
    result.restored.agents_md = true;
  } else if (await exists(agentsPath)) {
    // snapshot had no AGENTS.md, but current file exists — delete only if
    // it looks claudex-managed; otherwise leave alone (defensive)
    // For now we DO NOT auto-delete to avoid clobbering user's hand-written file.
    // The dedicated `native off` flow handles AGENTS.md cleanup separately.
  }

  // claudex state files
  if (opts.removeStateFiles !== false) {
    const currentFile = opts.currentProviderFile || codexCurrentProviderFile();
    if (await exists(currentFile)) {
      await fsp.unlink(currentFile);
      result.deleted.current_provider = true;
    }
    const hashesFile = opts.lastKnownHashesFile || codexLastKnownHashesPath();
    if (await exists(hashesFile)) {
      await fsp.unlink(hashesFile);
      result.deleted.last_known_hashes = true;
    }
  }

  // backups
  if (opts.preserveBackups === false) {
    const backupsRoot = opts.backupsDir || codexBackupsDir();
    if (await exists(backupsRoot)) {
      await fsp.rm(backupsRoot, { recursive: true, force: true });
      result.deleted.backups = true;
    }
  }

  // audit log entry (do this last so the act of reverting itself is recorded)
  if (opts.appendAudit !== false) {
    await appendAuditEvent(
      {
        action: 'revert',
        restored_from: 'pre-claudex',
        result
      },
      opts.auditOpts
    );
  }

  return result;
}

/**
 * Restore from a specific timestamped backup directory.
 * `id` can be 'latest' or a specific ISO-stamped backup name.
 */
export async function restoreBackup(id, opts = {}) {
  const backups = await listBackups(opts);
  if (backups.length === 0) {
    throw new Error('no backups available');
  }
  const target =
    id === 'latest' || !id ? backups[0] : backups.find((b) => b.id === id);
  if (!target) {
    throw new Error(`backup not found: ${id}`);
  }

  const configPath = opts.configTomlPath || codexConfigTomlPath();
  const authPath = opts.authJsonPath || codexAuthJsonPath();
  const restored = { config_toml: false, auth_json: false };

  const bkConfig = path.join(target.dir, 'config.toml');
  if (await exists(bkConfig)) {
    const txt = await fsp.readFile(bkConfig, 'utf8');
    await writeAtomic(configPath, txt);
    restored.config_toml = true;
  }
  const bkAuth = path.join(target.dir, 'auth.json');
  if (await exists(bkAuth)) {
    const txt = await fsp.readFile(bkAuth, 'utf8');
    await writeAtomic(authPath, txt, { mode: 0o600 });
    restored.auth_json = true;
  }

  if (opts.appendAudit !== false) {
    await appendAuditEvent(
      { action: 'restore', backup_id: target.id, restored },
      opts.auditOpts
    );
  }

  return { id: target.id, dir: target.dir, restored };
}
