// Activity metrics derived purely from transcript event timestamps.
// No filesystem access here — callers pass already-extracted events, keeping
// this a deterministic, unit-testable core. The file scanner lives separately.

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DEFAULT_IDLE_GAP_MS = 5 * 60 * 1000;

/**
 * @typedef {{ ts: number, sessionId?: string }} ActivityEvent
 * ts is epoch milliseconds; sessionId groups events for active-time gaps.
 */

function bucketEvents(events, tzOffsetMs) {
  const byHour = new Array(24).fill(0);
  const activeDays = new Set();
  const sessions = new Map();
  for (const ev of events) {
    if (!ev || typeof ev.ts !== 'number' || Number.isNaN(ev.ts)) continue;
    const local = ev.ts + tzOffsetMs;
    activeDays.add(Math.floor(local / DAY_MS));
    byHour[Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / HOUR_MS)] += 1;
    const sid = ev.sessionId ?? '__nosession__';
    let list = sessions.get(sid);
    if (!list) { list = []; sessions.set(sid, list); }
    list.push(ev.ts);
  }
  return { byHour, activeDays, sessions };
}

function sumActiveMs(sessions, idleGapMs) {
  let activeMs = 0;
  for (const tsList of sessions.values()) {
    tsList.sort((a, b) => a - b);
    for (let i = 1; i < tsList.length; i++) {
      const delta = tsList[i] - tsList[i - 1];
      if (delta > 0 && delta <= idleGapMs) activeMs += delta;
    }
  }
  return activeMs;
}

function computeStreaks(sortedDays) {
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    run = i > 0 && sortedDays[i] === sortedDays[i - 1] + 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }
  let currentStreak = 0;
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (i === sortedDays.length - 1) currentStreak = 1;
    else if (sortedDays[i] === sortedDays[i + 1] - 1) currentStreak += 1;
    else break;
  }
  return { currentStreak, longestStreak };
}

function argmaxHour(byHour) {
  let hour = null;
  let max = 0;
  for (let h = 0; h < 24; h++) {
    if (byHour[h] > max) { max = byHour[h]; hour = h; }
  }
  return hour;
}

/**
 * Compute activity metrics from timestamped events.
 * @param {ActivityEvent[]} events
 * @param {{ idleGapMs?: number, tzOffsetMinutes?: number }} [opts]
 * @returns {{ activeMs: number, activeDays: number, sessionCount: number,
 *   currentStreak: number, longestStreak: number, byHour: number[],
 *   mostActiveHour: number|null, firstDayIndex: number|null, lastDayIndex: number|null }}
 */
export function computeActivity(events, opts = {}) {
  const idleGapMs = opts.idleGapMs ?? DEFAULT_IDLE_GAP_MS;
  const tzOffsetMs = (opts.tzOffsetMinutes ?? 0) * 60 * 1000;
  const { byHour, activeDays, sessions } = bucketEvents(events ?? [], tzOffsetMs);
  const days = [...activeDays].sort((a, b) => a - b);
  const { currentStreak, longestStreak } = computeStreaks(days);
  return {
    activeMs: sumActiveMs(sessions, idleGapMs),
    activeDays: activeDays.size,
    sessionCount: sessions.size,
    currentStreak,
    longestStreak,
    byHour,
    mostActiveHour: argmaxHour(byHour),
    firstDayIndex: days.length ? days[0] : null,
    lastDayIndex: days.length ? days[days.length - 1] : null
  };
}
