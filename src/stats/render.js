// Render a StatsReport to terminal ASCII or JSON. Pure string functions.

/** 1234567 -> "1.2M", 45678 -> "45.7K", 123 -> "123". */
export function humanizeTokens(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'G';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/** Milliseconds -> "37.5h" or "12m". */
export function humanizeDuration(ms) {
  const hours = ms / 3_600_000;
  if (hours >= 1) return hours.toFixed(1) + 'h';
  return Math.round(ms / 60_000) + 'm';
}

function bar(value, max, width) {
  if (max <= 0) return '';
  return '█'.repeat(Math.round((value / max) * width));
}

/** Render the report as a compact ASCII panel. */
export function renderText(report) {
  const t = report.tokens;
  const a = report.activity;
  const lines = [];
  lines.push(`\u{1F4CA} claudex 用量统计 · ${report.window.label}`);
  lines.push('');
  lines.push(` Token   输入 ${humanizeTokens(t.input)} · 输出 ${humanizeTokens(t.output)} · 缓存读 ${humanizeTokens(t.cacheRead)} · 缓存写 ${humanizeTokens(t.cacheCreation)} · 合计 ${humanizeTokens(t.total)}`);
  const hour = a.mostActiveHour == null ? '—' : String(a.mostActiveHour).padStart(2, '0') + ':00';
  lines.push(` 活跃    ${humanizeDuration(a.activeMs)} · ${a.activeDays} 天 · 连续 ${a.currentStreak} 天 · 会话 ${a.sessionCount} · 高峰 ${hour}`);
  if (report.models.length) lines.push(` 模型    ${report.models.join(', ')}`);
  if (report.cost.reliable) lines.push(` 成本    $${report.cost.usd.toFixed(2)} (估算)`);
  if (report.days.length) {
    lines.push('');
    lines.push(' 每日 token');
    const max = Math.max(...report.days.map((d) => d.total));
    for (const d of report.days) {
      lines.push(`  ${d.date.slice(5)} ${bar(d.total, max, 24)} ${humanizeTokens(d.total)}`);
    }
  }
  return lines.join('\n');
}

/** Render the report as pretty JSON. */
export function renderJson(report) {
  return JSON.stringify(report, null, 2);
}
