// Merge ccusage usage + transcript activity into one StatsReport — the single
// contract the renderer consumes. Pure: no IO, no formatting.

/**
 * 计算连续天数（基于 token 消耗数据）
 * @param {object[]} days - 每日数据，必须已按日期排序
 * @returns {{ currentStreak: number, longestStreak: number }}
 */
function computeStreaksFromDays(days) {
  if (!days || days.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // 按日期排序并提取日期
  const dates = days
    .filter(d => d.date)
    .map(d => d.date)
    .sort();

  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // 转换为天数索引（YYYYMMDD -> 天数）
  const dayIndices = dates.map(d => {
    const year = parseInt(d.slice(0, 4));
    const month = parseInt(d.slice(5, 7)) - 1;
    const day = parseInt(d.slice(8, 10));
    return Math.floor(new Date(year, month, day).getTime() / 86400000);
  });

  // 计算最长连续
  let longestStreak = 1;
  let currentRun = 1;
  for (let i = 1; i < dayIndices.length; i++) {
    if (dayIndices[i] === dayIndices[i - 1] + 1) {
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      currentRun = 1;
    }
  }

  // 计算当前连续（从最后一天往前）
  let currentStreak = 1;
  for (let i = dayIndices.length - 2; i >= 0; i--) {
    if (dayIndices[i] === dayIndices[i + 1] - 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

/**
 * Build the StatsReport from its parts.
 * @param {{
 *   usage: { totals: object, days: object[], models: string[], costUSD: number, costReliable: boolean },
 *   activity: { activeMs: number, activeDays: number, sessionCount: number,
 *     currentStreak: number, longestStreak: number, mostActiveHour: number|null, byHour: number[] },
 *   window: { label: string, sinceMs: number, untilMs: number|null }
 * }} parts
 * @returns {object} StatsReport
 */
export function buildReport({ usage, activity, window }) {
  // 从 token 消耗数据计算活跃天数和连续天数
  const activeDaysFromUsage = usage.days.filter(d => d.total > 0).length;
  const { currentStreak, longestStreak } = computeStreaksFromDays(usage.days);

  return {
    window,
    tokens: usage.totals,
    days: usage.days,
    models: usage.models,  // 现在是 [{ name, tokens }, ...] 数组
    cost: { usd: usage.costUSD, reliable: usage.costReliable },
    activity: {
      activeMs: activity.activeMs,
      activeHours: activity.activeMs / 3_600_000,
      activeDays: activeDaysFromUsage,  // 使用 token 数据计算的活跃天数
      sessionCount: activity.sessionCount,
      currentStreak,  // 使用 token 数据计算的连续天数
      longestStreak,  // 使用 token 数据计算的最长连续
      mostActiveHour: activity.mostActiveHour,
      byHour: activity.byHour
    }
  };
}
