// Render a StatsReport to terminal ASCII or JSON. Pure string functions.

/** 计算字符串的实际显示宽度（考虑中文和 Emoji） */
function displayWidth(str) {
  let width = 0;
  for (const char of str) {
    const code = char.codePointAt(0);
    // Emoji 和中文字符占 2 个宽度
    if (code > 0x1F000 || (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3000 && code <= 0x303F)) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/** 按显示宽度填充字符串到指定宽度 */
function padToWidth(str, targetWidth) {
  const currentWidth = displayWidth(str);
  if (currentWidth >= targetWidth) return str;
  return str + ' '.repeat(targetWidth - currentWidth);
}

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

  // 标题
  lines.push('');
  lines.push('╭─────────────────────────────────────────────────────────────────────────╮');
  const title = `  📊  Token 消耗统计 · ${report.window.label}`;
  lines.push(`│${padToWidth(title, 73)}│`);
  lines.push('├─────────────────────────────────────────────────────────────────────────┤');

  // Token 统计区域
  lines.push('│                                                                         │');
  lines.push(`│${padToWidth('  累计消耗', 73)}│`);
  lines.push(`│${padToWidth(`    输入        ${humanizeTokens(t.input).padStart(8)}`, 73)}│`);
  lines.push(`│${padToWidth(`    输出        ${humanizeTokens(t.output).padStart(8)}`, 73)}│`);
  lines.push(`│${padToWidth(`    缓存读      ${humanizeTokens(t.cacheRead).padStart(8)}`, 73)}│`);
  lines.push(`│${padToWidth(`    缓存写      ${humanizeTokens(t.cacheCreation).padStart(8)}`, 73)}│`);
  lines.push('│    ─────────────────                                                    │');
  lines.push(`│${padToWidth(`    总计        ${humanizeTokens(t.total).padStart(8)}`, 73)}│`);
  lines.push('│                                                                         │');

  // 活跃度统计
  const hour = a.mostActiveHour == null ? '—' : String(a.mostActiveHour).padStart(2, '0') + ':00';
  lines.push('├─────────────────────────────────────────────────────────────────────────┤');
  lines.push(`│${padToWidth('  活跃度统计', 73)}│`);
  const activeLine = `    活跃时长    ${humanizeDuration(a.activeMs).padStart(6)}      活跃天数    ${String(a.activeDays).padStart(2)}      连续天数    ${String(a.currentStreak).padStart(2)}`;
  lines.push(`│${padToWidth(activeLine, 73)}│`);
  const sessionLine = `    会话数      ${String(a.sessionCount).padStart(6)}      高峰时段    ${hour}`;
  lines.push(`│${padToWidth(sessionLine, 73)}│`);
  lines.push('│                                                                         │');

  // 成本估算
  if (report.cost.reliable) {
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    const costLine = `  💰 成本估算:  $${report.cost.usd.toFixed(2)}`;
    lines.push(`│${padToWidth(costLine, 73)}│`);
    lines.push('│                                                                         │');
  }

  // 每日趋势图
  if (report.days.length) {
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    lines.push(`│${padToWidth('  📈 每日趋势', 73)}│`);
    lines.push('│                                                                         │');
    const max = Math.max(...report.days.map((d) => d.total));
    for (const d of report.days) {
      const dateLabel = d.date ? d.date.slice(5) : '未知日期';
      const barWidth = 40;
      const barLength = Math.round((d.total / max) * barWidth);
      const barStr = '█'.repeat(barLength);
      const tokenStr = humanizeTokens(d.total).padStart(8);
      const dayLine = `    ${dateLabel}  ${barStr.padEnd(barWidth)} ${tokenStr}`;
      lines.push(`│${padToWidth(dayLine, 73)}│`);
    }
    lines.push('│                                                                         │');
  }

  // 模型列表（如果太长则换行）
  if (report.models.length) {
    lines.push('├─────────────────────────────────────────────────────────────────────────┤');
    lines.push(`│${padToWidth('  🤖 使用的模型', 73)}│`);
    const modelText = report.models.join(', ');
    if (modelText.length <= 65) {
      const modelLine = `    ${modelText}`;
      lines.push(`│${padToWidth(modelLine, 73)}│`);
    } else {
      // 模型名太长，分行显示
      const chunks = [];
      let current = '';
      for (const model of report.models) {
        if ((current + model + ', ').length > 65) {
          if (current) chunks.push(current.slice(0, -2)); // 去掉最后的 ', '
          current = model + ', ';
        } else {
          current += model + ', ';
        }
      }
      if (current) chunks.push(current.slice(0, -2));
      for (const chunk of chunks) {
        const modelLine = `    ${chunk}`;
        lines.push(`│${padToWidth(modelLine, 73)}│`);
      }
    }
    lines.push('│                                                                         │');
  }

  lines.push('╰─────────────────────────────────────────────────────────────────────────╯');
  lines.push('');

  return lines.join('\n');
}

/** Render the report as pretty JSON. */
export function renderJson(report) {
  return JSON.stringify(report, null, 2);
}
