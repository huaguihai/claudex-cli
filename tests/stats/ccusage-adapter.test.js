import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  epochToCcusageDate,
  parseCcusageJson,
  normalizeDaily,
  fetchDailyUsage
} from '../../src/stats/ccusage-adapter.js';

test('epochToCcusageDate formats YYYYMMDD and respects tz offset', () => {
  assert.equal(epochToCcusageDate(Date.UTC(2026, 5, 7, 12), 0), '20260607');
  assert.equal(epochToCcusageDate(Date.UTC(2026, 5, 7, 23, 30), 60), '20260608');
});

test('parseCcusageJson extracts object, tolerating leading log noise', () => {
  assert.deepEqual(parseCcusageJson('{"daily":[]}'), { daily: [] });
  assert.deepEqual(parseCcusageJson('some log line\n{"daily":[]}\n'), { daily: [] });
  assert.equal(parseCcusageJson('no json here'), null);
  assert.equal(parseCcusageJson(''), null);
});

test('normalizeDaily sums totals, dedupes models, flags cost reliability', () => {
  const json = {
    daily: [
      { date: '2026-06-10', inputTokens: 100, outputTokens: 200, cacheCreationTokens: 300, cacheReadTokens: 400, totalTokens: 1000, modelsUsed: ['opus'], totalCost: 0 },
      { date: '2026-06-11', inputTokens: 10, outputTokens: 20, cacheCreationTokens: 30, cacheReadTokens: 40, totalTokens: 100, modelsUsed: ['opus', 'sonnet'], totalCost: 1.5 }
    ]
  };
  const r = normalizeDaily(json);
  assert.equal(r.days.length, 2);
  assert.deepEqual(r.totals, { input: 110, output: 220, cacheCreation: 330, cacheRead: 440, total: 1100 });
  assert.deepEqual(r.models, ['opus', 'sonnet']);
  assert.equal(r.costUSD, 1.5);
  assert.equal(r.costReliable, true);
});

test('normalizeDaily handles empty / cost-less data', () => {
  const r = normalizeDaily({ daily: [] });
  assert.equal(r.days.length, 0);
  assert.equal(r.totals.total, 0);
  assert.equal(r.costReliable, false);
});

test('fetchDailyUsage builds args and normalizes via injected runner (no real spawn)', async () => {
  let captured;
  const runner = async (args) => {
    captured = args;
    return '{"daily":[{"date":"2026-06-10","inputTokens":5,"outputTokens":5,"cacheCreationTokens":0,"cacheReadTokens":0,"totalTokens":10,"modelsUsed":["opus"],"totalCost":0}]}';
  };
  const r = await fetchDailyUsage({
    sinceMs: Date.UTC(2026, 5, 1),
    untilMs: Date.UTC(2026, 5, 30),
    tzOffsetMinutes: 0,
    runner
  });
  assert.deepEqual(captured, ['daily', '--json', '--since', '20260601', '--until', '20260630']);
  assert.equal(r.totals.total, 10);
  assert.deepEqual(r.models, ['opus']);
});

test('fetchDailyUsage throws on unparseable output', async () => {
  await assert.rejects(
    fetchDailyUsage({ runner: async () => 'not json' }),
    /no parseable JSON/
  );
});
