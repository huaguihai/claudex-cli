import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShellBlock, upsertShellBlock, buildPowerShellBlock, powerShellProfilePath } from '../../src/cli.js';

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

test('buildPowerShellBlock: 含起止 marker 与两个 PowerShell 函数', () => {
  const block = buildPowerShellBlock();
  assert.match(block, /# BEGIN CLAUDEX-SWITCHER/);
  assert.match(block, /# END CLAUDEX-SWITCHER/);
  assert.match(block, /function cdxrun/);
  assert.match(block, /function claude/);
});

test('buildPowerShellBlock: 三道护栏 + 调真身不递归', () => {
  const block = buildPowerShellBlock();
  assert.match(block, /-CommandType Application/);                              // 取真正的 claude，避免递归
  assert.match(block, /"\$args" -like '\*--settings\*'/);                       // 显式 --settings → 让路
  assert.match(block, /\$env:ANTHROPIC_API_KEY -or \$env:ANTHROPIC_AUTH_TOKEN/); // 已有凭证 → 让路
  assert.match(block, /current-provider/);                                      // 读取当前 provider
  assert.match(block, /& \$real --settings \$settings @args/);                  // 注入当前 provider 配置
  assert.match(block, /& \$real @args/);                                        // 兜底裸跑
});

test('upsertShellBlock: PowerShell 块复用同一套 marker，可写入且幂等', () => {
  const created = upsertShellBlock('', buildPowerShellBlock());
  assert.equal(created.action, 'created');
  const again = upsertShellBlock(created.next, buildPowerShellBlock());
  assert.equal(again.action, 'unchanged');
});

test('powerShellProfilePath: 采用 pwsh 查询结果并去除空白', () => {
  const p = powerShellProfilePath({
    queryProfile: () => '  C:\\Users\\X\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1\r\n'
  });
  assert.equal(p, 'C:\\Users\\X\\Documents\\PowerShell\\Microsoft.PowerShell_profile.ps1');
});

test('powerShellProfilePath: pwsh 不可用 → 退回 fallback', () => {
  const p = powerShellProfilePath({
    queryProfile: () => { throw new Error('spawn pwsh ENOENT'); },
    fallback: 'C:\\fb\\profile.ps1'
  });
  assert.equal(p, 'C:\\fb\\profile.ps1');
});

test('powerShellProfilePath: 查询返回空 → 退回 fallback', () => {
  const p = powerShellProfilePath({ queryProfile: () => '   ', fallback: 'C:\\fb\\profile.ps1' });
  assert.equal(p, 'C:\\fb\\profile.ps1');
});
