// Reads codex session "rollout" transcripts so codexx can list sessions across
// ALL providers — codex's own `resume` picker hides sessions whose recorded
// model_provider != the active one, which is why switching providers makes a
// provider's past sessions "disappear" from the list. The files are never lost;
// this module just enumerates them regardless of provider.
//
// Layout: ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<uuid>.jsonl
//   line 1: { type: "session_meta", payload: { id, cwd, model_provider, source, ... } }
//   later : { type: "event_msg", payload: { type: "user_message", message } }
//
// One session id maps to exactly one rollout file. Resume (even under a different
// active provider) appends to that same file — it does not fork a new rollout.
// List time uses last-event timestamp (recent activity), not session_meta create
// time. The provider label still comes from session_meta (creation-time provider).
//
// source is usually the string "cli" (main interactive) or "exec" (non-interactive).
// Multi-agent runs write object sources like:
//   { subagent: { thread_spawn: { agent_nickname, parent_thread_id, ... } } }
//   { subagent: { other: "guardian" } }
//   { subagent: "review" }
// Those flood the resume list if left unfiltered, so scanSessions hides them by
// default (includeSubagents: true to show).

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

import { codexSessionsDir, fromClaudexProviderId, toClaudexProviderId } from './constants.js';

// Stop scanning a rollout for the preview after this many lines — the first
// real user message is always near the top, right after the meta + injected
// environment/context messages.
const MAX_PREVIEW_SCAN_LINES = 200;

// How many trailing bytes to read when hunting for the last event timestamp.
// Real rollouts can be multi-MB; we only need the final JSONL lines.
const LAST_EVENT_TAIL_BYTES = 64 * 1024;

/**
 * Classify a session_meta.source value into a resume-list kind.
 * Pure. Returns { kind: 'cli'|'exec'|'subagent'|'other', label?: string|null }.
 */
export function classifySessionSource(source) {
  if (source === 'exec') return { kind: 'exec', label: null };
  if (source === 'cli' || source == null) return { kind: 'cli', label: null };
  if (typeof source === 'string') {
    return { kind: 'other', label: source };
  }
  if (source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, 'subagent')) {
    const sa = source.subagent;
    let label = null;
    if (typeof sa === 'string' && sa.trim()) {
      label = sa.trim();
    } else if (sa && typeof sa === 'object') {
      if (sa.thread_spawn && typeof sa.thread_spawn === 'object') {
        const nick = sa.thread_spawn.agent_nickname;
        if (typeof nick === 'string' && nick.trim()) label = nick.trim();
      }
      if (!label && sa.other != null) label = String(sa.other);
    }
    return { kind: 'subagent', label };
  }
  return { kind: 'other', label: null };
}

/**
 * Find the most recent event timestamp in a rollout file by reading a trailing
 * chunk (not the whole file). Falls back to mtime, then null.
 * Pure-ish I/O helper used so resume lists sort/display by last activity.
 */
export async function readLastActivity(file) {
  let size = 0;
  let mtimeMs = NaN;
  try {
    const st = await fsp.stat(file);
    size = st.size;
    mtimeMs = st.mtimeMs;
  } catch {
    return { timestamp: null, tsMs: NaN };
  }
  if (size <= 0) return { timestamp: null, tsMs: Number.isFinite(mtimeMs) ? mtimeMs : NaN };

  const readBytes = Math.min(size, LAST_EVENT_TAIL_BYTES);
  let text = '';
  try {
    const fh = await fsp.open(file, 'r');
    try {
      const buf = Buffer.alloc(readBytes);
      await fh.read(buf, 0, readBytes, size - readBytes);
      text = buf.toString('utf8');
    } finally {
      await fh.close();
    }
  } catch {
    return { timestamp: null, tsMs: Number.isFinite(mtimeMs) ? mtimeMs : NaN };
  }

  // If we started mid-line, drop the partial first line.
  const lines = text.split('\n');
  const start = size > readBytes ? 1 : 0;
  for (let i = lines.length - 1; i >= start; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = typeof obj.timestamp === 'string' ? obj.timestamp : null;
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (Number.isFinite(ms)) return { timestamp: ts, tsMs: ms };
  }

  return { timestamp: null, tsMs: Number.isFinite(mtimeMs) ? mtimeMs : NaN };
}

/**
 * Parse the session_meta head + first user_message preview from one rollout
 * file, and attach last-activity time for resume listing.
 * Returns null if the file isn't a rollout with a valid session_meta.
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
  const startedAt = meta.timestamp ?? null;
  const startedTsMs = startedAt ? Date.parse(startedAt) : NaN;
  const activity = await readLastActivity(file);
  // Prefer last event; if missing, fall back to create time (then mtime already
  // folded into activity.tsMs by readLastActivity).
  const tsMs = Number.isFinite(activity.tsMs)
    ? activity.tsMs
    : (Number.isFinite(startedTsMs) ? startedTsMs : NaN);
  const timestamp = activity.timestamp || startedAt;
  const classified = classifySessionSource(meta.source ?? null);
  const parentThreadId =
    typeof meta.parent_thread_id === 'string' && meta.parent_thread_id
      ? meta.parent_thread_id
      : (meta.source &&
          typeof meta.source === 'object' &&
          meta.source.subagent &&
          typeof meta.source.subagent === 'object' &&
          meta.source.subagent.thread_spawn &&
          typeof meta.source.subagent.thread_spawn.parent_thread_id === 'string'
          ? meta.source.subagent.thread_spawn.parent_thread_id
          : null);
  return {
    id: meta.id,
    cwd: meta.cwd ?? null,
    provider,
    providerLabel: provider ? fromClaudexProviderId(provider) || provider : null,
    source: meta.source ?? null,
    kind: classified.kind,
    subagentLabel: classified.label,
    parentThreadId,
    // List/sort time = last activity on this session thread (any provider that
    // appended turns). Creation-time provider label is unchanged.
    timestamp,
    tsMs,
    startedAt,
    startedTsMs,
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
 * @param {{
 *   sessionsDir?: string,
 *   cwd?: string,
 *   includeNonInteractive?: boolean,
 *   includeSubagents?: boolean
 * }} [opts]
 *   - sessionsDir: override the default ~/.codex/sessions root (tests).
 *   - cwd: if set, keep only sessions whose recorded cwd matches (matches
 *     codex's default cwd filtering, but WITHOUT the provider filtering).
 *   - includeNonInteractive: include `codex exec` sessions. Default false.
 *   - includeSubagents: include multi-agent / subagent rollouts. Default false
 *     — they dominate real session trees and hide main interactive threads.
 */
export async function scanSessions(opts = {}) {
  const dir = opts.sessionsDir || codexSessionsDir();
  const includeNonInteractive = opts.includeNonInteractive ?? false;
  const includeSubagents = opts.includeSubagents ?? false;
  const files = await collectRolloutFiles(dir);
  const heads = [];
  for (const f of files) {
    const head = await readSessionHead(f);
    if (!head) continue;
    if (opts.cwd && head.cwd !== opts.cwd) continue;
    if (!includeNonInteractive && head.kind === 'exec') continue;
    if (!includeSubagents && head.kind === 'subagent') continue;
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

/** Pure: short type tag for non-main sessions (empty for cli). */
export function sessionKindTag(s) {
  if (!s || s.kind === 'cli' || !s.kind) return '';
  if (s.kind === 'subagent') {
    return s.subagentLabel ? `[subagent:${s.subagentLabel}]` : '[subagent]';
  }
  if (s.kind === 'exec') return '[exec]';
  return s.kind ? `[${s.kind}]` : '';
}

/** Pure: format one session as a numbered list row (1-based index). */
export function formatSessionLine(s, index, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const previewMax = opts.previewMax ?? 60;
  const when = relativeTime(s.tsMs, nowMs);
  const prov = s.providerLabel || 'unknown';
  const tag = sessionKindTag(s);
  let preview = (s.preview || '').replace(/\s+/g, ' ').trim();
  if (preview.length > previewMax) preview = preview.slice(0, previewMax - 1) + '…';
  const body = tag ? `${tag} ${preview}`.trim() : preview;
  return `  ${String(index).padStart(2)}. [${when}] (${prov}) ${body}`;
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

/**
 * Pure: build the `codex` argv that resumes a session under the ACTIVE
 * provider. codex ≥0.144 restores the session's original model_provider from
 * the rollout's thread settings, so resuming a session born under provider A
 * while B is active silently targets A's base_url with B's injected key —
 * guaranteed 401. An explicit `-c model_provider=<id>` override beats the
 * restored thread settings (verified against 0.144.5), keeping sessions
 * portable across provider switches — the whole point of codexx.
 * With no active codexx provider, no override is added.
 */
export function buildResumeArgs(sessionId, activeProviderName) {
  const args = ['resume', sessionId];
  if (activeProviderName) {
    args.push('-c', `model_provider=${toClaudexProviderId(activeProviderName)}`);
  }
  return args;
}
