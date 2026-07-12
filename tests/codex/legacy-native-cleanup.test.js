import test from 'node:test';
import assert from 'node:assert/strict';

import { removeLegacyAgentsBlock } from '../../src/codex/cli.js';
import {
  LEGACY_AGENTS_MD_MARKER_BEGIN,
  LEGACY_AGENTS_MD_MARKER_END
} from '../../src/codex/constants.js';

test('removeLegacyAgentsBlock: leaves clean file untouched', () => {
  const raw = '# My AGENTS.md\n\nUser guidance stays.\n';
  assert.equal(removeLegacyAgentsBlock(raw), raw);
});

test('removeLegacyAgentsBlock: strips intact BEGIN/END block and surrounding blank line', () => {
  const raw = [
    '# User section',
    '',
    LEGACY_AGENTS_MD_MARKER_BEGIN,
    '## codexx Native Context',
    'Profile: balanced',
    LEGACY_AGENTS_MD_MARKER_END,
    '',
    '## More user notes',
    ''
  ].join('\n');
  const out = removeLegacyAgentsBlock(raw);
  assert.equal(out.includes(LEGACY_AGENTS_MD_MARKER_BEGIN), false);
  assert.equal(out.includes(LEGACY_AGENTS_MD_MARKER_END), false);
  assert.equal(out.includes('codexx Native Context'), false);
  assert.match(out, /# User section/);
  assert.match(out, /## More user notes/);
});

test('removeLegacyAgentsBlock: dangling BEGIN drops from marker to EOF', () => {
  const raw = `# head\n\n${LEGACY_AGENTS_MD_MARKER_BEGIN}\norphaned body\n`;
  const out = removeLegacyAgentsBlock(raw);
  assert.equal(out.includes(LEGACY_AGENTS_MD_MARKER_BEGIN), false);
  assert.equal(out.includes('orphaned body'), false);
  assert.match(out, /# head/);
});
