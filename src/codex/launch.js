import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fsp from 'node:fs/promises';
import fs from 'node:fs';

import {
  codexConfigTomlPath,
  codexAuthJsonPath,
  codexHome
} from './constants.js';
import { exists } from '../shared/fs-utils.js';
import { getCurrentProvider, readProvider } from './providers.js';

/**
 * Strip Codex-related env vars that would otherwise let a stray shell value
 * shadow the active codexx provider. Returns a new env object.
 *
 * This is the LOW-level primitive — most callers want `buildCodexEnv` which
 * also injects the active provider's API key.
 */
export function sanitizedCodexEnv(baseEnv = process.env) {
  const next = { ...baseEnv };
  delete next.OPENAI_API_KEY;
  delete next.OPENAI_BASE_URL;
  delete next.CODEX_API_KEY;
  return next;
}

/**
 * Compose the environment we hand to a spawned `codex` process:
 *   1. Strip stray OPENAI_API_KEY / OPENAI_BASE_URL / CODEX_API_KEY from
 *      the parent env so shell-level state doesn't shadow codexx state.
 *   2. Inject the ACTIVE provider's api_key as OPENAI_API_KEY so codex's
 *      env_key resolution path finds it. Codex's auth flow does NOT fall
 *      back to auth.json's OPENAI_API_KEY field for custom providers with
 *      env_key set, so the env must carry the credential explicitly.
 *
 * If no codexx provider is active (e.g. user hasn't run `codexx use` yet)
 * we still strip the stray env vars but inject nothing — codex will then
 * surface its own "missing env var" / login prompt as normal.
 */
export async function buildCodexEnv(baseEnv = process.env) {
  const next = sanitizedCodexEnv(baseEnv);
  const active = await getCurrentProvider();
  if (active) {
    try {
      const p = await readProvider(active);
      if (p && typeof p.api_key === 'string' && p.api_key.length > 0) {
        next.OPENAI_API_KEY = p.api_key;
      }
    } catch {
      // Provider metadata missing — surface via codex's own error
    }
  }
  return next;
}

/**
 * Detect codex install + version.
 * Returns { installed: boolean, version: string|null, path: string|null }.
 */
export function detectCodex() {
  const candidates = ['codex'];
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) candidates.push(path.join(appdata, 'npm', 'codex.cmd'));
  }

  for (const candidate of candidates) {
    try {
      if (candidate !== 'codex' && !fs.existsSync(candidate)) continue;
      const which = candidate === 'codex'
        ? execFileSync(process.platform === 'win32' ? 'where' : 'which', ['codex'], {
            stdio: ['ignore', 'pipe', 'ignore']
          }).toString().split(/\r?\n/).find(Boolean)?.trim()
        : candidate;
      if (!which) continue;
      const out = execFileSync(candidate, ['--version'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: process.platform === 'win32'
      }).toString();
      const m = out.match(/(\d+\.\d+\.\d+)/);
      return { installed: true, version: m ? m[1] : null, path: which };
    } catch {
      // Try the next candidate.
    }
  }

  return { installed: false, version: null, path: null };
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

export function resolveCodexCommand() {
  if (process.platform === 'win32') {
    const appdata = process.env.APPDATA;
    if (appdata) {
      const cmd = path.join(appdata, 'npm', 'codex.cmd');
      if (fs.existsSync(cmd)) return cmd;
    }
  }
  return 'codex';
}

/**
 * Spawn `codex` with the given args, inheriting stdio.
 * Resolves with the exit code.
 */
export async function spawnCodex(args, opts = {}) {
  const env = opts.env || (await buildCodexEnv());
  const command = resolveCodexCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32'
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
