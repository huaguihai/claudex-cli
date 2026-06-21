// Reads Claude Code transcript JSONL and extracts the minimal events activity
// metrics need: { ts, sessionId }. Token usage comes from ccusage, so this
// pipeline deliberately ignores everything except timestamps + session id.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import os from 'node:os';

/**
 * Parse one transcript JSONL line into a minimal activity event.
 * @param {string} line
 * @returns {{ ts: number, sessionId: string|null }|null} null if not an event.
 */
export function parseEventLine(line) {
  if (!line || !line.trim()) return null;
  let obj;
  try { obj = JSON.parse(line); } catch { return null; }
  if (!obj || !obj.timestamp) return null;
  const ts = Date.parse(obj.timestamp);
  if (Number.isNaN(ts)) return null;
  return { ts, sessionId: obj.sessionId ?? null };
}

/** Default Claude Code transcript root: ~/.claude/projects */
export function defaultProjectsDir(home = os.homedir()) {
  return path.join(home, '.claude', 'projects');
}

async function readFileEvents(file, sinceMs, out) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      const ev = parseEventLine(line);
      if (ev && ev.ts >= sinceMs) out.push(ev);
    }
  } finally {
    rl.close();
  }
}

/**
 * Scan transcript JSONL files for activity events.
 * @param {{ projectsDir?: string, sinceMs?: number }} [opts]
 * @returns {Promise<Array<{ ts: number, sessionId: string|null }>>}
 */
export async function scanTranscriptEvents(opts = {}) {
  const projectsDir = opts.projectsDir ?? defaultProjectsDir();
  const sinceMs = opts.sinceMs ?? 0;
  const events = [];
  let projectDirs;
  try {
    projectDirs = await fsp.readdir(projectsDir, { withFileTypes: true });
  } catch {
    return events; // no transcripts yet — not an error
  }
  for (const d of projectDirs) {
    if (!d.isDirectory()) continue;
    const dir = path.join(projectsDir, d.name);
    let files;
    try { files = await fsp.readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const file = path.join(dir, f);
      try {
        // mtime prefilter: a file last written before the window can't hold
        // in-window events, so skip reading it entirely.
        const st = await fsp.stat(file);
        if (sinceMs && st.mtimeMs < sinceMs) continue;
      } catch { continue; }
      await readFileEvents(file, sinceMs, events);
    }
  }
  return events;
}
