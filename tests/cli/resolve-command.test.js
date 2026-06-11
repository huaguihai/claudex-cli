import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveCommand } from '../../src/cli.js';

// Node + npm live together; the global claudex shim lives in npm's bin dir.
const NODE_DIR = 'D:\\Program\\nodejs';
const NODE = path.join(NODE_DIR, 'node.exe');
const NPM_BIN = 'C:\\Users\\Digital\\AppData\\Roaming\\npm';

const npmCmd = path.join(NODE_DIR, 'npm.cmd');
const npmCli = path.join(NODE_DIR, 'node_modules', 'npm', 'bin', 'npm-cli.js');
const claudexCmd = path.join(NPM_BIN, 'claudex.cmd');
const claudexCli = path.join(NPM_BIN, 'node_modules', 'claudex-cli', 'bin', 'claudex.js');

function win32(name, present, { pathEnv, pathExt = '.COM;.EXE;.BAT;.CMD' }) {
  const set = new Set(present);
  return resolveCommand(name, {
    platform: 'win32',
    pathEnv,
    pathExt,
    execPath: NODE,
    fileExists: (p) => set.has(p)
  });
}

test('非 win32：npm/claudex 直接用裸命令，行为不变', () => {
  assert.deepEqual(resolveCommand('npm', { platform: 'linux' }), { file: 'npm', prefixArgs: [] });
  assert.deepEqual(resolveCommand('claudex', { platform: 'darwin' }), { file: 'claudex', prefixArgs: [] });
});

test('win32 回归：spawn npm 不再 ENOENT —— 解析到 npm-cli.js 用 node 跑', () => {
  const r = win32('npm', [npmCmd, npmCli], { pathEnv: NODE_DIR });
  assert.deepEqual(r, { file: NODE, prefixArgs: [npmCli] });
});

test('win32：claudex 自更新后重跑 init —— 解析到 claudex.js 用 node 跑', () => {
  const r = win32('claudex', [claudexCmd, claudexCli], { pathEnv: NPM_BIN });
  assert.deepEqual(r, { file: NODE, prefixArgs: [claudexCli] });
});

test('win32：找到 npm.cmd 但缺 npm-cli.js → shell 兜底跑该 shim', () => {
  const r = win32('npm', [npmCmd], { pathEnv: NODE_DIR });
  assert.deepEqual(r, { file: npmCmd, prefixArgs: [], shell: true });
});

test('win32：PATH 里没有 npm → 退回裸 npm（交给上层报错）', () => {
  const r = win32('npm', [], { pathEnv: NODE_DIR });
  assert.deepEqual(r, { file: 'npm', prefixArgs: [] });
});

test('未知命令：原样返回，不做任何解析', () => {
  const r = resolveCommand('git', { platform: 'win32', pathEnv: NODE_DIR, fileExists: () => false });
  assert.deepEqual(r, { file: 'git', prefixArgs: [] });
});
