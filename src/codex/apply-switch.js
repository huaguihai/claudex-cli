import fsp from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';

import {
  codexConfigTomlPath,
  codexAuthJsonPath,
  codexLockPath
} from './constants.js';
import { exists, ensureDir, writeAtomic, sha256 } from '../shared/fs-utils.js';
import {
  applyClaudexProvider,
  parseConfigToml,
  verifyNonClaudexUntouched
} from './config-toml.js';
import {
  readAuthJson,
  writeAuthJson,
  buildAuthForProvider,
  backupChatGptTokensIfPresent
} from './auth-json.js';
import { ensurePreClaudexSnapshot, takeBackup, pruneBackups } from './snapshot.js';
import { setCurrentProvider } from './providers.js';
import {
  appendAuditEvent,
  writeLastKnownHashes,
  readLastKnownHashes
} from './audit.js';

/**
 * Atomic provider switch — the heart of `codexx use <name>`.
 * See spec §5.2 for the algorithm. All sub-modules resolve paths from
 * constants.js (CODEX_HOME / CLAUDEX_CONFIG_DIR env overrides honored),
 * so tests isolate by setting those env vars to temp dirs.
 *
 * @param {object} provider — codexx provider metadata (validated by caller)
 * @param {object} [opts]
 *   - previousProvider: string | null
 *   - driftCheck: boolean (default true)
 *   - onDrift: (driftReport) => Promise<boolean> — return false to abort
 *   - lockRetries / lockStaleMs: passed to proper-lockfile
 *   - buildOpts: { ts? } passed to applyClaudexProvider / buildAuthForProvider
 *   - retention: { keepCount?, keepDays? } passed to pruneBackups
 */
export async function applyProviderSwitch(provider, opts = {}) {
  const configPath = codexConfigTomlPath();
  const authPath = codexAuthJsonPath();
  const lockPath = codexLockPath();

  // Lock target must exist
  await ensureDir(path.dirname(lockPath));
  if (!(await exists(lockPath))) await writeAtomic(lockPath, '');

  const release = await lockfile.lock(lockPath, {
    retries: opts.lockRetries ?? { retries: 4, factor: 2, minTimeout: 100, maxTimeout: 2000 },
    stale: opts.lockStaleMs ?? 30_000,
    realpath: false
  });

  try {
    // 1) Snapshot pre-claudex state (idempotent)
    await ensurePreClaudexSnapshot();

    // 2) Read before state
    const configBeforeText = (await exists(configPath))
      ? await fsp.readFile(configPath, 'utf8')
      : '';
    const authBefore = await readAuthJson();
    const configHashBefore = sha256(configBeforeText);
    const authHashBefore = authBefore ? sha256(JSON.stringify(authBefore)) : null;

    // 3) Drift detection
    let drift = null;
    if (opts.driftCheck !== false) {
      const lastKnown = await readLastKnownHashes();
      if (lastKnown) {
        const driftedFiles = [];
        if (lastKnown.config_toml_hash && lastKnown.config_toml_hash !== configHashBefore) {
          driftedFiles.push('config.toml');
        }
        if (lastKnown.auth_json_hash && lastKnown.auth_json_hash !== authHashBefore) {
          driftedFiles.push('auth.json');
        }
        if (driftedFiles.length > 0) {
          drift = { driftedFiles, lastKnown };
          if (opts.onDrift) {
            const proceed = await opts.onDrift(drift);
            if (proceed === false) {
              throw new Error(
                `drift detected in ${driftedFiles.join(', ')}; aborted by caller`
              );
            }
          }
        }
      }
    }

    // 4) Build target state
    const applyResult = applyClaudexProvider(configBeforeText, provider, opts.buildOpts);
    const configNextText = applyResult.next;
    const authNext = buildAuthForProvider(provider, opts.buildOpts);

    // 5) Pre-validate (already done inside applyClaudexProvider, double-check)
    parseConfigToml(configNextText);

    // 6) Backup before write
    const backupDir = await takeBackup(`switch to ${provider.name}`);

    // 7) ChatGPT tokens backup
    let chatgptBackupPath = null;
    if (authBefore) {
      chatgptBackupPath = await backupChatGptTokensIfPresent(authBefore, {
        backupDir,
        timestamp: path.basename(backupDir)
      });
    }

    // 8) Write auth.json first
    await writeAuthJson(authNext);

    // 9) Write config.toml; on failure roll back auth
    try {
      await writeAtomic(configPath, configNextText);
    } catch (err) {
      if (authBefore) {
        await writeAuthJson(authBefore);
      } else if (await exists(authPath)) {
        await fsp.unlink(authPath);
      }
      throw new Error(
        `config.toml write failed; rolled back auth.json: ${err.message}`
      );
    }

    // 10) Post-verify
    const configActual = await fsp.readFile(configPath, 'utf8');
    const verifyResult = verifyNonClaudexUntouched(configBeforeText, configActual);
    if (!verifyResult.ok) {
      throw new Error(
        `post-write verification failed: non-claudex sections changed [${verifyResult.changedKeys.join(', ')}]`
      );
    }

    const authActual = await readAuthJson();
    const configHashAfter = sha256(configActual);
    const authHashAfter = authActual ? sha256(JSON.stringify(authActual)) : null;

    // 11) Update state
    await setCurrentProvider(provider.name);
    await writeLastKnownHashes({
      config_toml_hash: configHashAfter,
      auth_json_hash: authHashAfter,
      recorded_at: new Date().toISOString()
    });

    // 12) Audit
    await appendAuditEvent({
      action: 'use',
      from: opts.previousProvider ?? null,
      to: provider.name,
      config_hash_before: configHashBefore,
      config_hash_after: configHashAfter,
      auth_hash_before: authHashBefore,
      auth_hash_after: authHashAfter,
      backup_dir: backupDir,
      chatgpt_backup: chatgptBackupPath,
      drift
    });

    // 13) Prune old backups (best-effort)
    try {
      await pruneBackups(opts.retention || {});
    } catch {
      // intentional ignore
    }

    return {
      action: applyResult.diff.action,
      providerName: provider.name,
      backupDir,
      chatgptBackupPath,
      drift,
      hashesBefore: { config_toml: configHashBefore, auth_json: authHashBefore },
      hashesAfter: { config_toml: configHashAfter, auth_json: authHashAfter }
    };
  } finally {
    await release();
  }
}
