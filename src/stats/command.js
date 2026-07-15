// `claudex stats` command: glue that wires adapter + transcript-reader +
// activity + aggregate + render. Pure arg parsing (parseWindow/parseIdleGap)
// is separated out for testing; runStats does the IO orchestration.

import { fetchDailyUsage } from './ccusage-adapter.js';
import { scanTranscriptEvents } from './transcript-reader.js';
import { computeActivity } from './activity.js';
import { buildReport } from './aggregate.js';
import { renderText, renderJson } from './render.js';

const DAY_MS = 86_400_000;

/** Parse the time-window flags into { sinceMs, label }. Pure. */
export function parseWindow(args, nowMs) {
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx !== -1) {
    const raw = args[sinceIdx + 1];
    const ms = /^\d{4}-\d{2}-\d{2}$/.test(raw || '') ? Date.parse(`${raw}T00:00:00Z`) : NaN;
    if (!Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === raw) {
      return { sinceMs: ms, label: `自 ${raw}` };
    }
    throw new Error(`invalid --since date: ${raw || '(missing)'}`);
  }
  if (args.includes('--year')) return { sinceMs: nowMs - 365 * DAY_MS, label: '最近 365 天' };
  if (args.includes('--month')) return { sinceMs: nowMs - 30 * DAY_MS, label: '最近 30 天' };
  // 严格的 7 天：今天往前数 6 天 = 7 个自然日
  return { sinceMs: nowMs - 6 * DAY_MS, label: '最近 7 天' };
}

/** Parse --idle-gap <N>[m|h] into milliseconds (default 5m). Pure. */
export function parseIdleGap(args) {
  const i = args.indexOf('--idle-gap');
  if (i !== -1 && args[i + 1]) {
    const m = /^(\d+)(m|h)?$/.exec(args[i + 1]);
    if (m) {
      const n = Number(m[1]);
      return m[2] === 'h' ? n * 3_600_000 : n * 60_000;
    }
  }
  return 5 * 60_000;
}

/**
 * Run the stats command. Returns the string to print.
 * @param {string[]} args argv after the `stats` subcommand
 * @param {{ nowMs?: number }} [opts]
 */
export async function runStats(args, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const { sinceMs, label } = parseWindow(args, nowMs);
  const idleGapMs = parseIdleGap(args);
  const tzOffsetMinutes = -new Date().getTimezoneOffset();

  const usage = await fetchDailyUsage({ sinceMs, tzOffsetMinutes });
  const events = await scanTranscriptEvents({ sinceMs });
  const activity = computeActivity(events, { idleGapMs, tzOffsetMinutes });
  const report = buildReport({ usage, activity, window: { label, sinceMs, untilMs: null } });

  return args.includes('--json') ? renderJson(report) : renderText(report);
}
