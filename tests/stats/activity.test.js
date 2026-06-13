import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeActivity } from '../../src/stats/activity.js';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const BASE = Date.UTC(2026, 5, 7, 0, 0, 0, 0); // 2026-06-07T00:00:00Z (midnight UTC)

test('empty events → all metrics zero/empty', () => {
  const r = computeActivity([]);
  assert.equal(r.activeMs, 0);
  assert.equal(r.activeDays, 0);
  assert.equal(r.sessionCount, 0);
  assert.equal(r.currentStreak, 0);
  assert.equal(r.longestStreak, 0);
  assert.equal(r.mostActiveHour, null);
  assert.deepEqual(r.byHour, new Array(24).fill(0));
});

test('active duration sums consecutive deltas within idle gap', () => {
  const r = computeActivity([
    { ts: BASE, sessionId: 'a' },
    { ts: BASE + 1 * MIN, sessionId: 'a' },
    { ts: BASE + 3 * MIN, sessionId: 'a' },
    { ts: BASE + 10 * MIN, sessionId: 'a' }
  ]);
  assert.equal(r.activeMs, 3 * MIN); // 1min + 2min; 7min gap excluded
  assert.equal(r.sessionCount, 1);
});

test('idle gap boundary is inclusive at the threshold', () => {
  assert.equal(computeActivity([
    { ts: BASE, sessionId: 'a' },
    { ts: BASE + 5 * MIN, sessionId: 'a' }
  ]).activeMs, 5 * MIN);
  assert.equal(computeActivity([
    { ts: BASE, sessionId: 'a' },
    { ts: BASE + 5 * MIN + 1, sessionId: 'a' }
  ]).activeMs, 0);
});

test('active duration is per-session, not across interleaved sessions', () => {
  const r = computeActivity([
    { ts: BASE + 0, sessionId: 'a' },
    { ts: BASE + 1 * MIN, sessionId: 'b' },
    { ts: BASE + 2 * MIN, sessionId: 'a' },
    { ts: BASE + 3 * MIN, sessionId: 'b' }
  ]);
  // per-session: a=[0,2min]=2min, b=[1min,3min]=2min → 4min total
  // (a naive global sort would wrongly yield 3min)
  assert.equal(r.activeMs, 4 * MIN);
  assert.equal(r.sessionCount, 2);
});

test('active days and streaks over calendar days', () => {
  const day = (d, h = 12) => ({ ts: BASE + d * DAY + h * HOUR, sessionId: 's' });
  const r = computeActivity([day(0), day(1), day(2), day(4)], { tzOffsetMinutes: 0 });
  assert.equal(r.activeDays, 4);
  assert.equal(r.longestStreak, 3); // days 0,1,2 consecutive
  assert.equal(r.currentStreak, 1); // day 4 alone (day 3 missing)
});

test('byHour buckets by local hour using tz offset', () => {
  const r0 = computeActivity([
    { ts: BASE + 9 * HOUR, sessionId: 's' },
    { ts: BASE + 14 * HOUR, sessionId: 's' },
    { ts: BASE + 14 * HOUR + 1 * MIN, sessionId: 's' }
  ], { tzOffsetMinutes: 0 });
  assert.equal(r0.byHour[9], 1);
  assert.equal(r0.byHour[14], 2);
  assert.equal(r0.mostActiveHour, 14);

  const r1 = computeActivity(
    [{ ts: BASE + 23 * HOUR + 30 * MIN, sessionId: 's' }],
    { tzOffsetMinutes: 60 }
  );
  assert.equal(r1.byHour[0], 1); // 23:30 UTC + 1h → 00:30 local
});

test('respects custom idleGapMs', () => {
  const events = [
    { ts: BASE, sessionId: 'a' },
    { ts: BASE + 8 * MIN, sessionId: 'a' }
  ];
  assert.equal(computeActivity(events).activeMs, 0); // default 5min excludes 8min
  assert.equal(computeActivity(events, { idleGapMs: 10 * MIN }).activeMs, 8 * MIN);
});
