import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveClaudeCommand } from '../../src/cli.js';

// Real-world layout from the Windows bug report: npm global shims sit *before*
// the WinGet install in PATH (that's why interactive `claude` hits the npm one).
const NPM = 'C:\\Users\\Digital\\AppData\\Roaming\\npm';
const WINGET = 'C:\\Users\\Digital\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Anthropic.ClaudeCode';
const NODE = 'C:\\Program Files\\nodejs\\node.exe';

const npmCmd = path.join(NPM, 'claude.cmd');
const npmPs1 = path.join(NPM, 'claude.ps1');
const npmCli = path.join(NPM, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
const wingetExe = path.join(WINGET, 'claude.exe');

// Build a win32 resolver call backed by a fake filesystem (a Set of paths).
function win32(present, { pathEnv = `${NPM};${WINGET}`, pathExt = '.COM;.EXE;.BAT;.CMD' } = {}) {
  const set = new Set(present);
  return resolveClaudeCommand({
    platform: 'win32',
    pathEnv,
    pathExt,
    execPath: NODE,
    fileExists: (p) => set.has(p)
  });
}

test('非 win32：直接用裸 claude，行为不变', () => {
  assert.deepEqual(resolveClaudeCommand({ platform: 'linux' }), { file: 'claude', prefixArgs: [] });
  assert.deepEqual(resolveClaudeCommand({ platform: 'darwin' }), { file: 'claude', prefixArgs: [] });
});

test('win32 回归：npm 的 .cmd 在 PATH 更前 → 跑 npm 的 cli.js，而非 WinGet 旧 exe', () => {
  const r = win32([npmCmd, npmCli, wingetExe]);
  assert.deepEqual(r, { file: NODE, prefixArgs: [npmCli] });
});

test('win32：只有 WinGet 的 claude.exe → 直接 spawn 该 exe（无 prefix）', () => {
  const r = win32([wingetExe], { pathEnv: WINGET });
  assert.deepEqual(r, { file: wingetExe, prefixArgs: [] });
});

test('win32：找到 .cmd 但缺 cli.js → shell 兜底跑该 shim', () => {
  const r = win32([npmCmd], { pathEnv: NPM });
  assert.deepEqual(r, { file: npmCmd, prefixArgs: [], shell: true });
});

test('win32：PATH 里没有任何 claude → 退回裸 claude', () => {
  const r = win32([], { pathEnv: WINGET });
  assert.deepEqual(r, { file: 'claude', prefixArgs: [] });
});

test('win32：PATHEXT 缺 .CMD/.PS1 也能找到 npm shim（兜底补齐扩展名）', () => {
  const r = win32([npmPs1, npmCli], { pathEnv: NPM, pathExt: '.COM;.EXE' });
  assert.deepEqual(r, { file: NODE, prefixArgs: [npmCli] });
});

test('win32：PATH 条目带引号也能正确切分', () => {
  const r = win32([wingetExe], { pathEnv: `"${WINGET}"` });
  assert.deepEqual(r, { file: wingetExe, prefixArgs: [] });
});
