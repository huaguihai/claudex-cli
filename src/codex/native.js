import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  codexAgentsMdPath,
  codexNativeStatePath,
  AGENTS_MD_MARKER_BEGIN,
  AGENTS_MD_MARKER_END,
  SCHEMA_VERSION
} from './constants.js';
import {
  exists,
  ensureDir,
  readJson,
  writeJson,
  writeAtomic,
  sha256
} from '../shared/fs-utils.js';
import { getCurrentProvider, readProvider } from './providers.js';
import { appendAuditEvent } from './audit.js';

export const NATIVE_PROFILES = ['native-first', 'balanced', 'cost-first'];

export function defaultNativeState() {
  return {
    schema_version: SCHEMA_VERSION,
    enabled: false,
    profile: 'balanced',
    last_injected_hash: null
  };
}

export async function readNativeState(opts = {}) {
  const file = opts.path || codexNativeStatePath();
  if (!(await exists(file))) return defaultNativeState();
  try {
    const v = await readJson(file);
    return { ...defaultNativeState(), ...v };
  } catch {
    return defaultNativeState();
  }
}

export async function writeNativeState(state, opts = {}) {
  const file = opts.path || codexNativeStatePath();
  await ensureDir(path.dirname(file));
  await writeJson(file, state, { mode: 0o600 });
}

/**
 * Build the native context block injected into AGENTS.md.
 * Pure function of provider + profile.
 */
export function buildNativeContent({ provider, profile }) {
  const lines = [];
  lines.push('## codexx Native Context');
  lines.push('');
  lines.push('This block is auto-managed. Run `codexx native off` to remove it.');
  lines.push('');
  if (provider) {
    lines.push(`Active provider: \`${provider.name}\``);
    lines.push(`Endpoint: \`${provider.base_url}\``);
    lines.push(`Model: \`${provider.model}\``);
    lines.push(`Wire API: \`${provider.wire_api || 'chat'}\``);
  }
  lines.push(`Profile: \`${profile}\``);
  lines.push('');
  lines.push(profileGuidance(profile));
  lines.push('');
  lines.push('User-authored guidance lives outside the BEGIN/END markers; codexx never touches it.');
  return lines.join('\n');
}

function profileGuidance(profile) {
  switch (profile) {
    case 'native-first':
      return [
        'Profile guidance — native-first:',
        '- Prefer native Codex workflows: codex resume, codex fork, codex apply.',
        '- Favour built-in tool calling and structured outputs over hand-rolled prompts.',
        '- Pre-flight subagent / task-quality gates before delegating.'
      ].join('\n');
    case 'cost-first':
      return [
        'Profile guidance — cost-first:',
        '- Minimise delegation and multi-turn loops when a single turn suffices.',
        '- Trim verbose context; lean on file references rather than full pastes.',
        '- Skip optional verification when the change is provably trivial.'
      ].join('\n');
    case 'balanced':
    default:
      return [
        'Profile guidance — balanced:',
        '- Default to provider-agnostic patterns; verify before declaring done.',
        '- Confirm before destructive or hard-to-reverse actions.',
        '- Use subagents when a task is genuinely independent or parallelisable.'
      ].join('\n');
  }
}

/**
 * Splice a delimited block into AGENTS.md.
 * Behaviour:
 *  - If markers not present: append the block to the end (with one leading blank line).
 *  - If markers present: replace the contents between them in place.
 * Returns { rawBefore, rawAfter }.
 */
export function spliceNativeBlock(raw, body) {
  const block = `${AGENTS_MD_MARKER_BEGIN}\n${body}\n${AGENTS_MD_MARKER_END}`;
  const beginIdx = raw.indexOf(AGENTS_MD_MARKER_BEGIN);
  if (beginIdx === -1) {
    const sep = raw.length === 0 || raw.endsWith('\n\n') ? '' : raw.endsWith('\n') ? '\n' : '\n\n';
    const next = `${raw}${sep}${block}\n`;
    return { rawBefore: raw, rawAfter: next };
  }
  const endIdx = raw.indexOf(AGENTS_MD_MARKER_END, beginIdx);
  if (endIdx === -1) {
    // dangling BEGIN — refuse rather than guess
    throw new Error('AGENTS.md has dangling BEGIN marker without END; refuse to inject');
  }
  const before = raw.slice(0, beginIdx);
  const after = raw.slice(endIdx + AGENTS_MD_MARKER_END.length);
  const next = `${before}${block}${after}`;
  return { rawBefore: raw, rawAfter: next };
}

/**
 * Remove the delimited block from AGENTS.md (if present).
 * Also collapses one leading blank line so removal looks clean.
 */
export function removeNativeBlock(raw) {
  const beginIdx = raw.indexOf(AGENTS_MD_MARKER_BEGIN);
  if (beginIdx === -1) return { rawAfter: raw, removed: false };
  const endIdx = raw.indexOf(AGENTS_MD_MARKER_END, beginIdx);
  if (endIdx === -1) {
    throw new Error('AGENTS.md has dangling BEGIN marker without END');
  }
  let removeStart = beginIdx;
  // Eat one leading blank line if present
  if (removeStart >= 2 && raw.slice(removeStart - 2, removeStart) === '\n\n') {
    removeStart -= 1;
  }
  const removeEnd = endIdx + AGENTS_MD_MARKER_END.length;
  // Also eat one trailing newline after marker if present
  let after = raw.slice(removeEnd);
  if (after.startsWith('\n')) after = after.slice(1);
  const next = raw.slice(0, removeStart) + after;
  return { rawAfter: next, removed: true };
}

/**
 * Inject (or refresh) the codexx native block into AGENTS.md.
 * Also updates native state (enabled = true, last_injected_hash).
 */
export async function injectNativeContext(opts = {}) {
  const agentsPath = opts.agentsPath || codexAgentsMdPath();
  const state = await readNativeState();
  const profile = opts.profile || state.profile || 'balanced';
  const activeName = await getCurrentProvider();
  let provider = null;
  if (activeName) {
    try {
      provider = await readProvider(activeName);
    } catch {
      // surface as null
    }
  }
  const body = buildNativeContent({ provider, profile });
  const existing = (await exists(agentsPath)) ? await fsp.readFile(agentsPath, 'utf8') : '';
  const { rawAfter } = spliceNativeBlock(existing, body);
  await writeAtomic(agentsPath, rawAfter);
  const hash = sha256(body);
  await writeNativeState({ ...state, enabled: true, profile, last_injected_hash: hash });
  await appendAuditEvent({ action: 'native_on', profile, provider: activeName });
  return { profile, providerName: activeName, hash };
}

/**
 * Remove the codexx native block from AGENTS.md.
 * Also flips state.enabled to false.
 */
export async function removeNativeContext(opts = {}) {
  const agentsPath = opts.agentsPath || codexAgentsMdPath();
  let removed = false;
  if (await exists(agentsPath)) {
    const raw = await fsp.readFile(agentsPath, 'utf8');
    const { rawAfter, removed: didRemove } = removeNativeBlock(raw);
    if (didRemove) {
      await writeAtomic(agentsPath, rawAfter);
      removed = true;
    }
  }
  const state = await readNativeState();
  await writeNativeState({ ...state, enabled: false, last_injected_hash: null });
  await appendAuditEvent({ action: 'native_off', removed });
  return { removed };
}

/**
 * Read current native state for status display.
 */
export async function nativeStatus() {
  const state = await readNativeState();
  const agentsPath = codexAgentsMdPath();
  let injectedInFile = false;
  if (await exists(agentsPath)) {
    const raw = await fsp.readFile(agentsPath, 'utf8');
    injectedInFile = raw.includes(AGENTS_MD_MARKER_BEGIN) && raw.includes(AGENTS_MD_MARKER_END);
  }
  return {
    enabled: state.enabled === true,
    profile: state.profile || 'balanced',
    injectedInFile,
    lastInjectedHash: state.last_injected_hash || null
  };
}

/**
 * Update the profile name in state. If native is currently on, re-inject
 * so the new profile takes effect immediately.
 */
export async function setNativeProfile(profile, opts = {}) {
  if (!NATIVE_PROFILES.includes(profile)) {
    throw new Error(`invalid profile: ${profile} (must be one of ${NATIVE_PROFILES.join(', ')})`);
  }
  const state = await readNativeState();
  await writeNativeState({ ...state, profile });
  if (state.enabled) {
    return await injectNativeContext({ ...opts, profile });
  }
  return { profile, providerName: null, hash: null };
}
