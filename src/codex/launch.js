import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fsp from 'node:fs/promises';

import {
  codexConfigTomlPath,
  codexAuthJsonPath,
  codexHome
} from './constants.js';
import { exists } from '../shared/fs-utils.js';

/**
 * Strip Codex-related env vars from a process env, so that spawned codex
 * doesn't pick up stray shell-level credentials that bypass our managed
 * auth.json. Returns a new env object (does not mutate input).
 */
export function sanitizedCodexEnv(baseEnv = process.env) {
  const next = { ...baseEnv };
  delete next.OPENAI_API_KEY;
  delete next.OPENAI_BASE_URL;
  delete next.CODEX_API_KEY;
  return next;
}

/**
 * Detect codex install + version.
 * Returns { installed: boolean, version: string|null, path: string|null }.
 */
export function detectCodex() {
  try {
    const which = execFileSync('which', ['codex'], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
    if (!which) return { installed: false, version: null, path: null };
    const out = execFileSync('codex', ['--version'], {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString();
    const m = out.match(/(\d+\.\d+\.\d+)/);
    return { installed: true, version: m ? m[1] : null, path: which };
  } catch {
    return { installed: false, version: null, path: null };
  }
}

/**
 * Returns true if a Codex Desktop App process is running on this host.
 * Best-effort: macOS pgrep. Returns null on platforms we don't check.
 */
export function detectCodexAppRunning() {
  if (process.platform !== 'darwin') return null;
  try {
    const out = execFileSync('pgrep', ['-l', '-f', 'Codex.app/Contents/MacOS/'], {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    if (!out) return { running: false, pid: null };
    const first = out.split('\n')[0];
    const pidMatch = first.match(/^(\d+)/);
    return { running: true, pid: pidMatch ? Number(pidMatch[1]) : null };
  } catch {
    return { running: false, pid: null };
  }
}

/**
 * Spawn `codex` with the given args, inheriting stdio.
 * Returns a promise that resolves with the exit code.
 */
export function spawnCodex(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const env = opts.env || sanitizedCodexEnv();
    const child = spawn('codex', args, {
      stdio: 'inherit',
      env
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

/**
 * Compose a one-line launch banner for `codexx` default startup.
 */
export function buildLaunchBanner(provider) {
  if (!provider) return null;
  const endpoint = provider.base_url || '(no endpoint)';
  return `📌 Codex provider: ${provider.name} (${endpoint})`;
}

/**
 * Preflight check before spawning codex.
 * Returns { ok, warnings }.
 * - Checks that codex CLI is installed
 * - Verifies config.toml + auth.json exist and parse
 * - Warns if Codex App is running (caller may print restart hint)
 */
export async function preflight(opts = {}) {
  const warnings = [];
  const codex = detectCodex();
  if (!codex.installed) {
    return {
      ok: false,
      error: 'codex CLI not installed',
      warnings,
      codex
    };
  }
  const configPath = codexConfigTomlPath();
  if (!(await exists(configPath))) {
    return {
      ok: false,
      error: `~/.codex/config.toml not found`,
      warnings,
      codex
    };
  }
  const authPath = codexAuthJsonPath();
  if (!(await exists(authPath))) {
    warnings.push('~/.codex/auth.json missing — codex may prompt for login');
  }
  const app = detectCodexAppRunning();
  if (app && app.running) {
    warnings.push(`Codex Desktop App running (PID ${app.pid}); restart to apply config changes`);
  }
  return { ok: true, warnings, codex, app };
}
