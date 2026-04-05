#!/usr/bin/env node
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const home = os.homedir();
const claudeDir = path.join(home, '.claude');
const appDir = path.join(home, '.config', 'claudex-cli');
const backupsDir = path.join(appDir, 'backups');
const currentProviderFile = path.join(appDir, 'current-provider');
const legacyCurrentProviderFile = path.join(claudeDir, 'current-provider');

function usage() {
  console.log(`claudex v0.1.0

Usage:
  claudex                     # 直接启动 Claude（使用当前配置）
  claudex --continue          # 继续最近一次会话
  claudex menu                # 进入交互菜单
  claudex init
  claudex add
  claudex list
  claudex use <name>
  claudex remove <name> [--yes]
  claudex test [name]
  claudex status
  claudex update [--from-local <path>]
  claudex run [claude args...]
  claudex provider add [--name N --base-url URL --api-key KEY --haiku-model H --sonnet-model S --opus-model O]
  claudex provider list
  claudex provider use <name>
  claudex provider remove <name> [--yes]
  claudex provider test <name>
  claudex doctor [--provider <name>]

Examples:
  claudex
  claudex --continue
  claudex menu
  claudex use gpt
  claudex test
  claudex update
  claudex run --continue
`);
}

function providerSettingsPath(name) {
  return path.join(claudeDir, `settings.${name}.json`);
}

async function exists(file) {
  try {
    await fsp.access(file);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function backupFile(file) {
  if (!(await exists(file))) return null;
  await ensureDir(backupsDir);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const dst = path.join(backupsDir, `${path.basename(file)}.${stamp}.bak`);
  await fsp.copyFile(file, dst);
  return dst;
}

async function readJson(file) {
  const raw = await fsp.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(file, obj) {
  const txt = JSON.stringify(obj, null, 2) + '\n';
  await fsp.writeFile(file, txt, { mode: 0o600 });
}

async function listProviders() {
  if (!(await exists(claudeDir))) return [];
  const entries = await fsp.readdir(claudeDir);
  const out = [];
  for (const item of entries) {
    const m = item.match(/^settings\.([a-zA-Z0-9_-]+)\.json$/);
    if (m) out.push(m[1]);
  }
  out.sort();
  return out;
}

async function getCurrentProvider() {
  if (await exists(currentProviderFile)) {
    const p = (await fsp.readFile(currentProviderFile, 'utf8')).trim();
    if (p) return p;
  }

  // Compatibility: migrate legacy state from ~/.claude/current-provider.
  if (await exists(legacyCurrentProviderFile)) {
    const legacy = (await fsp.readFile(legacyCurrentProviderFile, 'utf8')).trim();
    if (legacy && (await exists(providerSettingsPath(legacy)))) {
      await setCurrentProvider(legacy);
      return legacy;
    }
  }

  // Compatibility: infer from CLAUDE_SETTINGS_FILE if present.
  const settingsFile = process.env.CLAUDE_SETTINGS_FILE || '';
  const m = settingsFile.match(/settings\.([a-zA-Z0-9_-]+)\.json$/);
  if (m && m[1] && (await exists(providerSettingsPath(m[1])))) {
    await setCurrentProvider(m[1]);
    return m[1];
  }

  return null;
}

async function setCurrentProvider(name) {
  await ensureDir(appDir);
  await fsp.writeFile(currentProviderFile, `${name}\n`, 'utf8');
}

function shellRcFile() {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return path.join(home, '.zshrc');
  if (shell.includes('bash')) return path.join(home, '.bashrc');
  return path.join(home, '.zshrc');
}

async function injectShellBlock() {
  const rc = shellRcFile();
  const begin = '# BEGIN CLAUDEX-SWITCHER';
  const end = '# END CLAUDEX-SWITCHER';
  const block = `${begin}\n# helper to run Claude with current provider\ncdxrun() {\n  claudex run "$@"\n}\n${end}\n`;

  let content = '';
  if (await exists(rc)) content = await fsp.readFile(rc, 'utf8');
  if (content.includes(begin) && content.includes(end)) return { rc, changed: false };

  await backupFile(rc);
  const next = content.endsWith('\n') || content.length === 0 ? `${content}${block}` : `${content}\n${block}`;
  await fsp.writeFile(rc, next, 'utf8');
  return { rc, changed: true };
}

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const nxt = argv[i + 1];
      if (nxt && !nxt.startsWith('-')) {
        flags[key] = nxt;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function promptProviderAdd(flags) {
  const rl = readline.createInterface({ input, output });
  try {
    const name = (flags.name || (await rl.question('服务商名称（例如 gpt）: '))).trim();
    const baseUrl = (flags['base-url'] || (await rl.question('服务地址（例如 https://api.example.com）: '))).trim();
    const apiKey = (flags['api-key'] || (await rl.question('API Key: '))).trim();
    const haikuModel = (flags['haiku-model'] || (await rl.question('Haiku 模型（例如 gpt-5.4-mini）: '))).trim();
    const sonnetModel = (flags['sonnet-model'] || (await rl.question('Sonnet 模型（例如 gpt-5.4）: '))).trim();
    const opusModel = (flags['opus-model'] || (await rl.question('Opus 模型（例如 gpt-5.4-xhigh）: '))).trim();

    if (!name || !baseUrl || !apiKey || !haikuModel || !sonnetModel || !opusModel) {
      throw new Error('name/base-url/api-key/haiku-model/sonnet-model/opus-model are required.');
    }

    return { name, baseUrl, apiKey, haikuModel, sonnetModel, opusModel };
  } finally {
    rl.close();
  }
}

async function writeProviderSettings({ name, baseUrl, apiKey, haikuModel, sonnetModel, opusModel }) {
  await ensureDir(claudeDir);
  const file = providerSettingsPath(name);
  await backupFile(file);
  const data = {
    env: {
      ANTHROPIC_BASE_URL: baseUrl,
      ANTHROPIC_API_KEY: apiKey,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: haikuModel,
      ANTHROPIC_DEFAULT_SONNET_MODEL: sonnetModel,
      ANTHROPIC_DEFAULT_OPUS_MODEL: opusModel
    }
  };
  await writeJson(file, data);
  return file;
}

function readProviderAuth(settings) {
  const env = settings?.env || {};
  return {
    baseUrl: env.ANTHROPIC_BASE_URL,
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  };
}

async function testProvider(name) {
  const file = providerSettingsPath(name);
  if (!(await exists(file))) throw new Error(`provider not found: ${name}`);

  const settings = await readJson(file);
  const { baseUrl, apiKey, model } = readProviderAuth(settings);
  if (!baseUrl || !apiKey || !model) {
    throw new Error(`invalid settings in ${file}`);
  }

  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ping' }]
    })
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return { ok: true, status: res.status, id: data.id || null };
  }

  const text = (await res.text()).slice(0, 500);
  return { ok: true, status: res.status, preview: text };
}

function sanitizedEnv() {
  const next = { ...process.env };
  delete next.ANTHROPIC_AUTH_TOKEN;
  delete next.ANTHROPIC_API_KEY;
  delete next.ANTHROPIC_BASE_URL;
  return next;
}

async function runProcess(command, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function runClaude(extraArgs) {
  const current = await getCurrentProvider();
  if (!current) {
    throw new Error('no current provider. run: claudex provider use <name>');
  }

  const settings = providerSettingsPath(current);
  if (!(await exists(settings))) {
    throw new Error(`current provider settings missing: ${settings}`);
  }

  await new Promise((resolve, reject) => {
    const child = spawn('claude', ['--settings', settings, ...extraArgs], {
      stdio: 'inherit',
      env: sanitizedEnv()
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`claude exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function cmdUpdate(rest) {
  const { flags } = parseFlags(rest);
  const fromLocal = typeof flags['from-local'] === 'string' ? flags['from-local'] : '';
  if (fromLocal) {
    console.log(`Updating from local path: ${fromLocal}`);
    await runProcess('npm', ['i', '-g', fromLocal], process.env);
    console.log('Update complete.');
    return;
  }

  console.log('Updating from npm registry: claudex-cli@latest');
  await runProcess('npm', ['i', '-g', 'claudex-cli@latest'], process.env);
  console.log('Update complete.');
}

async function cmdInit() {
  await ensureDir(appDir);
  await ensureDir(backupsDir);
  const injected = await injectShellBlock();
  const current = await getCurrentProvider();
  if (!current) await setCurrentProvider('gemma');

  console.log(`Initialized: ${appDir}`);
  console.log(`Shell file: ${injected.rc}`);
  if (injected.changed) {
    console.log('Injected shell helper: cdxrun');
    console.log(`Run: source ${injected.rc}`);
  } else {
    console.log('Shell helper already exists');
  }
}

async function pickProvider(promptText = '请输入服务商名称: ') {
  const providers = await listProviders();
  if (providers.length === 0) {
    throw new Error('还没有任何服务商，请先选择“开始配置claudex”或“管理模型服务商 -> 新增”。');
  }

  const current = await getCurrentProvider();
  console.log('可选服务商:');
  for (const p of providers) {
    console.log(`${p === current ? '*' : ' '} ${p}`);
  }
  const chosen = await ask(promptText);
  if (!chosen) throw new Error('未输入服务商名称');
  return chosen;
}

async function cmdProvider(subArgs) {
  const [action, ...rest] = subArgs;
  const { flags, rest: positional } = parseFlags(rest);

  if (action === 'add') {
    const info = await promptProviderAdd(flags);
    const file = await writeProviderSettings(info);
    if (flags.current || flags['set-current']) await setCurrentProvider(info.name);
    console.log(`Saved: ${file}`);
    console.log(`Test with: claudex provider test ${info.name}`);
    return;
  }

  if (action === 'list') {
    const providers = await listProviders();
    const current = await getCurrentProvider();
    if (providers.length === 0) {
      console.log('No providers found in ~/.claude/settings.<name>.json');
      return;
    }
    for (const p of providers) {
      console.log(`${p === current ? '*' : ' '} ${p}`);
    }
    if (!current) {
      console.log('\nNo active provider. Run: claudex use <name>');
    }
    return;
  }

  if (action === 'use') {
    const name = positional[0];
    if (!name) throw new Error('usage: claudex provider use <name>');
    const file = providerSettingsPath(name);
    if (!(await exists(file))) throw new Error(`provider settings not found: ${file}`);
    await setCurrentProvider(name);
    console.log(`Current provider: ${name}`);
    return;
  }

  if (action === 'remove') {
    const name = positional[0];
    if (!name) throw new Error('usage: claudex provider remove <name> [--yes]');
    const file = providerSettingsPath(name);
    if (!(await exists(file))) throw new Error(`provider settings not found: ${file}`);

    if (!flags.yes) {
      const rl = readline.createInterface({ input, output });
      const ans = (await rl.question(`Delete ${file}? (y/N): `)).trim().toLowerCase();
      rl.close();
      if (ans !== 'y' && ans !== 'yes') {
        console.log('Cancelled');
        return;
      }
    }

    await backupFile(file);
    await fsp.unlink(file);
    const current = await getCurrentProvider();
    if (current === name) await fsp.unlink(currentProviderFile).catch(() => {});
    console.log(`Deleted: ${file}`);
    return;
  }

  if (action === 'test') {
    const name = positional[0];
    if (!name) throw new Error('usage: claudex provider test <name>');
    const result = await testProvider(name);
    console.log(`Test OK: ${name} (${result.status})`);
    return;
  }

  throw new Error('usage: claudex provider <add|list|use|remove|test>');
}

async function cmdStatus() {
  const current = await getCurrentProvider();
  const providers = await listProviders();
  console.log(`Current provider: ${current || '(none)'}`);
  if (current) {
    const file = providerSettingsPath(current);
    console.log(`Current settings: ${file} ${await exists(file) ? '(exists)' : '(missing)'}`);
  }
  console.log(`Providers: ${providers.length ? providers.join(', ') : '(none)'}`);
}

async function cmdDoctor(flags) {
  const target = flags.provider || (await getCurrentProvider());
  console.log('Doctor checks:');

  const conflicts = [];
  if (process.env.ANTHROPIC_AUTH_TOKEN) conflicts.push('ANTHROPIC_AUTH_TOKEN is set in current shell');
  if (process.env.ANTHROPIC_API_KEY) conflicts.push('ANTHROPIC_API_KEY is set in current shell');
  if (process.env.ANTHROPIC_BASE_URL) conflicts.push('ANTHROPIC_BASE_URL is set in current shell');

  if (conflicts.length) {
    console.log('- Env conflicts:');
    for (const c of conflicts) console.log(`  - ${c}`);
    console.log('  Fix: unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL');
  } else {
    console.log('- Env conflicts: none');
  }

  if (!target) {
    console.log('- Current provider: none');
    return;
  }

  try {
    const result = await testProvider(target);
    console.log(`- Provider test: OK (${target}, HTTP ${result.status})`);
  } catch (err) {
    console.log(`- Provider test: FAIL (${target})`);
    console.log(`  ${String(err.message || err)}`);
  }
}

async function configureWizard() {
  await cmdInit();
  const info = await promptProviderAdd({});
  const file = await writeProviderSettings(info);
  await setCurrentProvider(info.name);
  console.log(`已保存配置: ${file}`);

  const ans = (await ask('是否立即测试连接？(Y/n): ')).toLowerCase();
  if (ans === '' || ans === 'y' || ans === 'yes') {
    const result = await testProvider(info.name);
    console.log(`连接测试通过: ${info.name} (HTTP ${result.status})`);
  }
}

async function manageProvidersMenu() {
  while (true) {
    console.log('\n管理模型服务商');
    console.log('1. 新增服务商');
    console.log('2. 编辑服务商（覆盖保存）');
    console.log('3. 删除服务商');
    console.log('4. 列出服务商');
    console.log('5. 返回主菜单');
    const choice = await ask('请选择 (1-5): ');

    try {
      if (choice === '1') {
        const info = await promptProviderAdd({});
        const file = await writeProviderSettings(info);
        console.log(`已保存: ${file}`);
        continue;
      }
      if (choice === '2') {
        const name = await pickProvider('请输入要编辑的服务商名称: ');
        const info = await promptProviderAdd({ name });
        const file = await writeProviderSettings(info);
        console.log(`已更新: ${file}`);
        continue;
      }
      if (choice === '3') {
        const name = await pickProvider('请输入要删除的服务商名称: ');
        await cmdProvider(['remove', name, '--yes']);
        continue;
      }
      if (choice === '4') {
        await cmdProvider(['list']);
        continue;
      }
      if (choice === '5') return;
      console.log('输入无效，请输入 1-5。');
    } catch (err) {
      console.log(`操作失败: ${String(err.message || err)}`);
    }
  }
}

async function moreSettingsMenu() {
  while (true) {
    console.log('\n更多设置');
    console.log('1. 初始化/修复 shell 快捷函数');
    console.log('2. 显示命令帮助');
    console.log('3. 返回主菜单');
    const choice = await ask('请选择 (1-3): ');

    if (choice === '1') {
      await cmdInit();
      continue;
    }
    if (choice === '2') {
      usage();
      continue;
    }
    if (choice === '3') return;
    console.log('输入无效，请输入 1-3。');
  }
}

async function mainMenu() {
  while (true) {
    console.log('\n==============================');
    console.log('Claudex 主菜单');
    console.log('1. 开始配置claudex（首次使用）');
    console.log('2. 查看当前配置');
    console.log('3. 切换模型服务商');
    console.log('4. 管理模型服务商');
    console.log('5. 问题排查');
    console.log('6. 更多设置');
    console.log('7. 退出');
    console.log('==============================');
    const choice = await ask('请选择 (1-7): ');

    try {
      if (choice === '1') {
        await configureWizard();
        continue;
      }
      if (choice === '2') {
        await cmdStatus();
        continue;
      }
      if (choice === '3') {
        const name = await pickProvider('请输入要切换到的服务商名称: ');
        await cmdProvider(['use', name]);
        continue;
      }
      if (choice === '4') {
        await manageProvidersMenu();
        continue;
      }
      if (choice === '5') {
        await cmdDoctor({});
        continue;
      }
      if (choice === '6') {
        await moreSettingsMenu();
        continue;
      }
      if (choice === '7' || choice.toLowerCase() === 'q') {
        console.log('已退出。');
        return;
      }
      console.log('输入无效，请输入 1-7。');
    } catch (err) {
      console.log(`执行失败: ${String(err.message || err)}`);
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    await runClaude([]);
    return;
  }

  if (cmd === '--help' || cmd === '-h') {
    usage();
    return;
  }

  if (cmd === 'menu') {
    await mainMenu();
    return;
  }

  if (cmd.startsWith('-')) {
    await runClaude(argv);
    return;
  }

  if (cmd === 'add') {
    await cmdProvider(['add', ...rest]);
    return;
  }

  if (cmd === 'list') {
    await cmdProvider(['list', ...rest]);
    return;
  }

  if (cmd === 'use') {
    await cmdProvider(['use', ...rest]);
    return;
  }

  if (cmd === 'remove') {
    await cmdProvider(['remove', ...rest]);
    return;
  }

  if (cmd === 'test') {
    const [name] = rest;
    const provider = name || (await getCurrentProvider());
    if (!provider) throw new Error('usage: claudex test [name]');
    const result = await testProvider(provider);
    console.log(`Test OK: ${provider} (${result.status})`);
    return;
  }

  if (cmd === 'init') {
    await cmdInit();
    return;
  }

  if (cmd === 'provider') {
    await cmdProvider(rest);
    return;
  }

  if (cmd === 'status') {
    await cmdStatus();
    return;
  }

  if (cmd === 'update') {
    await cmdUpdate(rest);
    return;
  }

  if (cmd === 'doctor') {
    const { flags } = parseFlags(rest);
    await cmdDoctor(flags);
    return;
  }

  if (cmd === 'run') {
    await runClaude(rest);
    return;
  }

  throw new Error(`unknown command: ${cmd}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`Error: ${err.message || err}`);
    process.exit(1);
  });
}
