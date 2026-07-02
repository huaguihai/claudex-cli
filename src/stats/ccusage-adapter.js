// Adapter over the installed ccusage CLI. ccusage@20.x ships only a bundled
// CLI (no library exports), so we spawn it and read --json. The CLI call sits
// behind an injectable `runner` so the parsing/normalizing logic stays pure
// and unit-testable without spawning anything.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Locate the installed ccusage CLI entry (bundled single file, no exports map). */
export function resolveCcusageBin() {
  const pkgPath = require.resolve('ccusage/package.json');
  return path.join(path.dirname(pkgPath), 'dist', 'cli.js');
}

/** Format epoch ms as ccusage's YYYYMMDD, shifted by tz offset. */
export function epochToCcusageDate(ms, tzOffsetMinutes = 0) {
  const d = new Date(ms + tzOffsetMinutes * 60000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Extract the JSON object from ccusage stdout, tolerating leading log noise. */
export function parseCcusageJson(stdout) {
  if (!stdout) return null;
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(stdout.slice(start, end + 1)); } catch { return null; }
}

/** Normalize ccusage `daily --json` output into our internal usage shape. */
export function normalizeDaily(json) {
  const daily = Array.isArray(json?.daily) ? json.daily : [];
  const totals = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 };
  const modelUsage = new Map(); // 统计每个模型的总消耗
  let costUSD = 0;
  const days = daily.map((row) => {
    const input = row.inputTokens ?? 0;
    const output = row.outputTokens ?? 0;
    const cacheCreation = row.cacheCreationTokens ?? 0;
    const cacheRead = row.cacheReadTokens ?? 0;
    const total = row.totalTokens ?? (input + output + cacheCreation + cacheRead);
    totals.input += input;
    totals.output += output;
    totals.cacheCreation += cacheCreation;
    totals.cacheRead += cacheRead;
    totals.total += total;
    costUSD += row.totalCost ?? 0;

    // 统计每个模型的 token 消耗
    for (const breakdown of row.modelBreakdowns ?? []) {
      const modelName = breakdown.modelName;
      const modelTokens = (breakdown.inputTokens ?? 0) +
                         (breakdown.outputTokens ?? 0) +
                         (breakdown.cacheCreationTokens ?? 0) +
                         (breakdown.cacheReadTokens ?? 0);
      modelUsage.set(modelName, (modelUsage.get(modelName) ?? 0) + modelTokens);
    }

    return { date: row.period || row.date, input, output, cacheCreation, cacheRead, total };
  });

  // 按使用量降序排序模型，返回 { name, tokens } 对象数组
  const models = [...modelUsage.entries()]
    .sort((a, b) => b[1] - a[1])  // 按 token 数降序
    .map(([name, tokens]) => ({ name, tokens }));

  // Third-party providers usually aren't in ccusage's price table -> cost 0.
  return { days, totals, models, costUSD, costReliable: costUSD > 0 };
}

function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolveCcusageBin(), ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ccusage exited with ${code}: ${stderr.slice(0, 200)}`));
    });
  });
}

/**
 * Fetch normalized daily usage from ccusage.
 * @param {{ sinceMs?: number, untilMs?: number, tzOffsetMinutes?: number,
 *   runner?: (args: string[]) => Promise<string> }} [opts]
 *   runner is injectable for testing (defaults to spawning the ccusage CLI).
 */
export async function fetchDailyUsage(opts = {}) {
  const { sinceMs, untilMs, tzOffsetMinutes = 0, runner = defaultRunner } = opts;
  const args = ['daily', '--json'];
  if (sinceMs != null) args.push('--since', epochToCcusageDate(sinceMs, tzOffsetMinutes));
  if (untilMs != null) args.push('--until', epochToCcusageDate(untilMs, tzOffsetMinutes));
  const stdout = await runner(args);
  const json = parseCcusageJson(stdout);
  if (!json) throw new Error('ccusage returned no parseable JSON');
  return normalizeDaily(json);
}
