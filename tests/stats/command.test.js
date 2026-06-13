import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWindow, parseIdleGap } from '../../src/stats/command.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 12, 0, 0, 0);

test('parseWindow defaults to last 7 days', () => {
  const w = parseWindow([], NOW);
  assert.equal(w.label, '过去 7 天');
  assert.equal(w.sinceMs, NOW - 7 * DAY);
});

test('parseWindow handles --month and --year', () => {
  assert.equal(parseWindow(['--month'], NOW).sinceMs, NOW - 30 * DAY);
  assert.equal(parseWindow(['--month'], NOW).label, '过去 30 天');
  assert.equal(parseWindow(['--year'], NOW).sinceMs, NOW - 365 * DAY);
  assert.equal(parseWindow(['--year'], NOW).label, '过去 365 天');
});

test('parseWindow handles --since YYYY-MM-DD', () => {
  const w = parseWindow(['--since', '2026-06-01'], NOW);
  assert.equal(w.sinceMs, Date.parse('2026-06-01'));
  assert.match(w.label, /自 2026-06-01/);
});

test('parseIdleGap parses minutes/hours and defaults to 5m', () => {
  assert.equal(parseIdleGap([]), 5 * 60_000);
  assert.equal(parseIdleGap(['--idle-gap', '10m']), 10 * 60_000);
  assert.equal(parseIdleGap(['--idle-gap', '2h']), 2 * 3_600_000);
  assert.equal(parseIdleGap(['--idle-gap', '7']), 7 * 60_000);
});
