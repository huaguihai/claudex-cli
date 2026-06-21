// Reads codex session "rollout" transcripts so codexx can list sessions across
// ALL providers — codex's own `resume` picker hides sessions whose recorded
// model_provider != the active one, which is why switching providers makes a
// provider's past sessions "disappear" from the list. The files are never lost;
// this module just enumerates them regardless of provider.
//
// Layout: ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl
//   line 1: { type: "session_meta", payload: { id, cwd, model_provider, ... } }
//   later : { type: "event_msg", payload: { type: "user_message", message } }

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import { codexSessionsDir, fromClaudexProviderId } from './constants.js';

// Stop scanning a rollout for the preview after this many lines — the first
// real user message is always near the top, right after the meta + injected
// environment/context messages.
const MAX_PREVIEW_SCAN_LINES = 200;

/**
 * Parse the session_meta head + first user_message preview from one rollout
 * file. Returns null if the file isn't a rollout with a valid session_meta.
 */
export async function readSessionHead(file) {
  let meta = null;
  let preview = '';
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let n = 0;
  try {
    for await (const line of rl) {
      if (n++ > MAX_PREVIEW_SCAN_LINES) break;
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (!meta && obj.type === 'session_meta' && obj.payload) {
        meta = obj.payload;
        continue;
      }
      // The first event_msg/user_message is the user's actual opening prompt;
      // response_item messages with role=user near the top are injected
      // environment/AGENTS context, so we deliberately key off user_message.
      if (!preview && obj.type === 'event_msg' && obj.payload && obj.payload.type === 'user_message') {
        const m = obj.payload.message;
        if (typeof m === 'string' && m.trim()) {
          preview = m.trim();
          break;
        }
      }
    }
  } finally {
    rl.close();
  }
  if (!meta || !meta.id) return null;
  const provider = meta.model_provider ?? null;
  const tsMs = meta.timestamp ? Date.parse(meta.timestamp) : NaN;
  return {
    id: meta.id,
    cwd: meta.cwd ?? null,
    provider,
    providerLabel: provider ? fromClaudexProviderId(provider) || provider : null,
    source: meta.source ?? null,
    timestamp: meta.timestamp ?? null,
    tsMs,
    preview,
    file
  };
}

async function collectRolloutFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectRolloutFiles(full)));
    } else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan the codex sessions tree and return session heads, newest first.
 * @param {{ sessionsDir?: string, cwd?: string, includeNonInteractive?: boolean }} [opts]
 *   - sessionsDir: override the default ~/.codex/sessions root (tests).
 *   - cwd: if set, keep only sessions whose recorded cwd matches (matches
 *     codex's default cwd filtering, but WITHOUT the provider filtering).
 *   - includeNonInteractive: include `codex exec` / review sessions. Default
 *     false, matching codex's resume picker (which hides them).
 */
export async function scanSessions(opts = {}) {
  const dir = opts.sessionsDir || codexSessionsDir();
  const includeNonInteractive = opts.includeNonInteractive ?? false;
  const files = await collectRolloutFiles(dir);
  const heads = [];
  for (const f of files) {
    const head = await readSessionHead(f);
    if (!head) continue;
    if (opts.cwd && head.cwd !== opts.cwd) continue;
    if (!includeNonInteractive && head.source === 'exec') continue;
    heads.push(head);
  }
  heads.sort((a, b) => {
    const at = Number.isFinite(a.tsMs) ? a.tsMs : 0;
    const bt = Number.isFinite(b.tsMs) ? b.tsMs : 0;
    return bt - at;
  });
  return heads;
}

/** Pure: compact relative-time label. */
export function relativeTime(tsMs, nowMs) {
  if (!Number.isFinite(tsMs)) return '?';
  const diff = Math.max(0, nowMs - tsMs);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Pure: format one session as a numbered list row (1-based index). */
export function formatSessionLine(s, index, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const previewMax = opts.previewMax ?? 60;
  const when = relativeTime(s.tsMs, nowMs);
  const prov = s.providerLabel || 'unknown';
  let preview = (s.preview || '').replace(/\s+/g, ' ').trim();
  if (preview.length > previewMax) preview = preview.slice(0, previewMax - 1) + '…';
  return `  ${String(index).padStart(2)}. [${when}] (${prov}) ${preview}`;
}

/** Pure: parse a 1-based selection string → 0-based index, or null if invalid. */
export function parseSelection(input, count) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = parseInt(trimmed, 10);
  if (n < 1 || n > count) return null;
  return n - 1;
}
