import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../../src/stats/aggregate.js';
import { humanizeTokens, humanizeDuration, renderText, renderJson } from '../../src/stats/render.js';

const USAGE = {
  totals: { input: 81517, output: 26052, cacheCreation: 356286, cacheRead: 1124610, total: 1588465 },
  days: [
    { date: '2026-06-01', input: 81517, output: 26052, cacheCreation: 356286, cacheRead: 1124610, total: 1588465 },
    { date: '2026-06-02', input: 100, output: 200, cacheCreation: 0, cacheRead: 0, total: 300 }
  ],
  models: ['claude-opus-4-8', 'gpt-5.5'],
  costUSD: 3.57,
  costReliable: true
};
const ACTIVITY = {
  activeMs: 9000000, activeDays: 2, sessionCount: 3,
  currentStreak: 5, longestStreak: 7, mostActiveHour: 14,
  byHour: new Array(24).fill(0)
};
const WINDOW = { label: '过去 30 天', sinceMs: 0, untilMs: null };

test('buildReport assembles the StatsReport contract', () => {
  const r = buildReport({ usage: USAGE, activity: ACTIVITY, window: WINDOW });
  assert.equal(r.window.label, '过去 30 天');
  assert.deepEqual(r.tokens, USAGE.totals);
  assert.equal(r.models.length, 2);
  assert.equal(r.cost.usd, 3.57);
  assert.equal(r.cost.reliable, true);
  assert.equal(r.activity.activeDays, 2);
  assert.equal(r.activity.activeHours, 2.5); // 9000000ms = 2.5h
  assert.equal(r.activity.currentStreak, 5);
});

test('humanizeTokens scales to K / M', () => {
  assert.equal(humanizeTokens(1234567), '1.2M');
  assert.equal(humanizeTokens(45678), '45.7K');
  assert.equal(humanizeTokens(500), '500');
});

test('humanizeDuration formats hours / minutes', () => {
  assert.equal(humanizeDuration(9000000), '2.5h');
  assert.equal(humanizeDuration(120000), '2m');
});

test('renderText includes key figures and trend', () => {
  const r = buildReport({ usage: USAGE, activity: ACTIVITY, window: WINDOW });
  const out = renderText(r);
  assert.match(out, /用量统计/);
  assert.match(out, /过去 30 天/);
  assert.match(out, /合计 1\.6M/);
  assert.match(out, /连续 5 天/);
  assert.match(out, /高峰 14:00/);
  assert.match(out, /每日 token/);
  assert.match(out, /06-01/);
});

test('renderJson round-trips the report', () => {
  const r = buildReport({ usage: USAGE, activity: ACTIVITY, window: WINDOW });
  assert.deepEqual(JSON.parse(renderJson(r)), r);
});
