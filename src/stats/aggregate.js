// Merge ccusage usage + transcript activity into one StatsReport — the single
// contract the renderer consumes. Pure: no IO, no formatting.

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
  return {
    window,
    tokens: usage.totals,
    days: usage.days,
    models: usage.models,
    cost: { usd: usage.costUSD, reliable: usage.costReliable },
    activity: {
      activeMs: activity.activeMs,
      activeHours: activity.activeMs / 3_600_000,
      activeDays: activity.activeDays,
      sessionCount: activity.sessionCount,
      currentStreak: activity.currentStreak,
      longestStreak: activity.longestStreak,
      mostActiveHour: activity.mostActiveHour,
      byHour: activity.byHour
    }
  };
}
