import fsp from 'node:fs/promises';
import path from 'node:path';

import { codexEnvFilePath } from './constants.js';
import { exists, writeAtomic } from '../shared/fs-utils.js';

export const ENV_MARKER_BEGIN = '# claudex-cli managed BEGIN — do not edit between markers';
export const ENV_MARKER_END = '# claudex-cli managed END';

/**
 * Read ~/.codex/.env raw text. Returns '' if file does not exist.
 */
export async function readEnvFile(filePath) {
  const p = filePath || codexEnvFilePath();
  if (!(await exists(p))) return '';
  return fsp.readFile(p, 'utf8');
}

/**
 * Splice (insert or replace) a marker-delimited block of KEY=VAL pairs.
 * Preserves all bytes outside the marker block.
 */
export function spliceClaudexEnv(raw, pairs) {
  const body = formatPairs(pairs);
  const block = `${ENV_MARKER_BEGIN}\n${body}${ENV_MARKER_END}`;

  const beginIdx = raw.indexOf(ENV_MARKER_BEGIN);
  if (beginIdx === -1) {
    if (raw.length === 0) return `${block}\n`;
    const sep = raw.endsWith('\n\n') ? '' : raw.endsWith('\n') ? '\n' : '\n\n';
    return `${raw}${sep}${block}\n`;
  }
  const endIdx = raw.indexOf(ENV_MARKER_END, beginIdx);
  if (endIdx === -1) {
    throw new Error('~/.codex/.env has dangling BEGIN marker without END');
  }
  const before = raw.slice(0, beginIdx);
  const after = raw.slice(endIdx + ENV_MARKER_END.length);
  return `${before}${block}${after}`;
}

/**
 * Remove the marker-delimited block (if present). Also collapses one
 * leading blank line so removal looks clean.
 */
export function removeClaudexEnv(raw) {
  const beginIdx = raw.indexOf(ENV_MARKER_BEGIN);
  if (beginIdx === -1) return { rawAfter: raw, removed: false };
  const endIdx = raw.indexOf(ENV_MARKER_END, beginIdx);
  if (endIdx === -1) {
    throw new Error('~/.codex/.env has dangling BEGIN marker without END');
  }
  let removeStart = beginIdx;
  if (removeStart >= 2 && raw.slice(removeStart - 2, removeStart) === '\n\n') {
    removeStart -= 1;
  }
  const removeEnd = endIdx + ENV_MARKER_END.length;
  let after = raw.slice(removeEnd);
  if (after.startsWith('\n')) after = after.slice(1);
  return { rawAfter: raw.slice(0, removeStart) + after, removed: true };
}

/**
 * Write content atomically with mode 0o600. If content is empty, delete the file.
 */
export async function writeEnvFile(content, filePath) {
  const p = filePath || codexEnvFilePath();
  if (content === '' || content === null || content === undefined) {
    if (await exists(p)) await fsp.unlink(p);
    return;
  }
  await writeAtomic(p, content, { mode: 0o600 });
}

/**
 * High-level: ensure ~/.codex/.env contains a claudex-managed block with
 * the given KEY=VAL pairs. Preserves user-authored content outside markers.
 */
export async function applyClaudexEnv(pairs, filePath) {
  const before = await readEnvFile(filePath);
  const after = spliceClaudexEnv(before, pairs);
  await writeEnvFile(after, filePath);
  return { before, after };
}

/**
 * High-level: remove the claudex-managed block from ~/.codex/.env. If the
 * file becomes empty after removal, delete it.
 */
export async function clearClaudexEnv(filePath) {
  const before = await readEnvFile(filePath);
  const { rawAfter, removed } = removeClaudexEnv(before);
  if (rawAfter.trim() === '') {
    await writeEnvFile('', filePath);
  } else {
    await writeEnvFile(rawAfter, filePath);
  }
  return { before, after: rawAfter, removed };
}

function formatPairs(pairs) {
  const lines = [];
  for (const [k, v] of Object.entries(pairs)) {
    if (v === undefined || v === null) continue;
    lines.push(`${k}=${escapeEnvValue(String(v))}`);
  }
  if (lines.length === 0) return '';
  return lines.join('\n') + '\n';
}

/**
 * dotenvy parses KEY=VALUE. Values with special chars should be quoted.
 * Conservative escaping: always wrap in single quotes if value contains
 * any whitespace, #, ', ", $, or backslash. Otherwise leave bare.
 */
function escapeEnvValue(value) {
  if (/^[A-Za-z0-9_./:@+-]*$/.test(value)) return value;
  // single-quoted: escape internal single quotes by closing, escaping, reopening
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}
