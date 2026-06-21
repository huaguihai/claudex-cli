import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installStatsCommand, STATS_COMMAND_BODY } from '../../src/stats/install-command.js';

test('STATS_COMMAND_BODY has required frontmatter and command', () => {
  assert.match(STATS_COMMAND_BODY, /allowed-tools: Bash\(claudex stats/);
  assert.match(STATS_COMMAND_BODY, /claudex stats \$ARGUMENTS/);
  assert.match(STATS_COMMAND_BODY, /description:/);
});

test('installStatsCommand writes stats.md into <home>/.claude/commands', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'claudex-home-'));
  try {
    const file = await installStatsCommand({ home });
    assert.equal(file, path.join(home, '.claude', 'commands', 'stats.md'));
    const content = fs.readFileSync(file, 'utf8');
    assert.match(content, /claudex stats \$ARGUMENTS/);
    assert.ok(content.startsWith('---'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
