import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShellBlock, upsertShellBlock } from '../../src/cli.js';

test('buildShellBlock: 含起止 marker 与两个 helper', () => {
  const block = buildShellBlock();
  assert.match(block, /# BEGIN CLAUDEX-SWITCHER/);
  assert.match(block, /# END CLAUDEX-SWITCHER/);
  assert.match(block, /cdxrun\(\)/);
  assert.match(block, /claude\(\)/);
});

test('buildShellBlock: claude 包装带三道护栏 + 当前 provider 注入', () => {
  const block = buildShellBlock();
  assert.match(block, /case "\$\*" in \*--settings\*/);            // 显式 --settings → 让路
  assert.match(block, /ANTHROPIC_API_KEY\$ANTHROPIC_AUTH_TOKEN/);  // 已有凭证 → 让路
  assert.match(block, /current-provider/);                         // 读取当前 provider
  assert.match(block, /--settings "\$__cdx_settings"/);            // 注入当前 provider 配置
  assert.match(block, /command claude "\$@"/);                     // 兜底裸跑
});

test('upsertShellBlock: 空内容 → created 且块以换行结尾', () => {
  const { next, action } = upsertShellBlock('', buildShellBlock());
  assert.equal(action, 'created');
  assert.match(next, /# BEGIN CLAUDEX-SWITCHER/);
  assert.ok(next.endsWith('\n'));
});

test('upsertShellBlock: 已有旧块 → updated，保留用户其它内容且只剩一份', () => {
  const legacy = '# BEGIN CLAUDEX-SWITCHER\ncdxrun() {\n  claudex run "$@"\n}\n# END CLAUDEX-SWITCHER';
  const rc = `# my rc\nexport FOO=1\n${legacy}\nalias ll='ls -l'\n`;
  const { next, action } = upsertShellBlock(rc, buildShellBlock());
  assert.equal(action, 'updated');
  assert.match(next, /export FOO=1/);
  assert.match(next, /alias ll='ls -l'/);
  assert.equal(next.match(/# BEGIN CLAUDEX-SWITCHER/g).length, 1);
  assert.match(next, /claude\(\)/); // 新的 claude 包装已注入到旧块位置
});

test('upsertShellBlock: 内容已是最新 → unchanged', () => {
  const created = upsertShellBlock('', buildShellBlock()).next;
  const { action } = upsertShellBlock(created, buildShellBlock());
  assert.equal(action, 'unchanged');
});

test('upsertShellBlock: 不与非换行结尾的内容粘连', () => {
  const { next } = upsertShellBlock('export A=1', buildShellBlock());
  assert.match(next, /export A=1\n# BEGIN CLAUDEX-SWITCHER/);
});
