import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// The /stats slash command body. The `!` prefix runs the deterministic CLI and
// feeds its output to the model, which then shows it to the user. (Typing
// `!claudex stats` directly in Claude Code is the zero-model-cost alternative.)
export const STATS_COMMAND_BODY = `---
allowed-tools: Bash(claudex stats:*)
description: 显示 claudex 用量与活跃度统计（token / 活跃时长 / 每日趋势）
argument-hint: [--week | --month | --year | --json]
---
运行 claudex 统计，并把下面的输出原样展示给用户（不要改写或重算数字）：

!\`claudex stats $ARGUMENTS\`
`;

/**
 * Install the /stats slash command into <home>/.claude/commands/stats.md.
 * @param {{ home?: string }} [opts]
 * @returns {Promise<string>} the written file path
 */
export async function installStatsCommand(opts = {}) {
  const home = opts.home ?? os.homedir();
  const dir = path.join(home, '.claude', 'commands');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'stats.md');
  await fsp.writeFile(file, STATS_COMMAND_BODY, 'utf8');
  return file;
}
