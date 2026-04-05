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
const languageFile = path.join(appDir, 'language');
const legacyCurrentProviderFile = path.join(claudeDir, 'current-provider');

const TXT = {
  zh: {
    menuTitle: 'Claudex 主菜单',
    m1: '1. 开始配置claudex',
    m2: '2. 查看当前配置',
    m3: '3. 切换模型服务商',
    m4: '4. 管理模型服务商',
    m5: '5. 问题排查',
    m6: '6. 更多设置',
    m7: '7. 退出',
    choose17: '请选择 (1-7): ',
    invalid17: '输入无效，请输入 1-7。',
    bye: '已退出。',
    currentProvider: '当前服务商: {v}',
    currentSettings: '当前配置文件: {file} {state}',
    providers: '服务商列表: {v}',
    noProviders: '未找到任何服务商配置（~/.claude/settings.<name>.json）',
    noActiveProvider: '当前未设置服务商，请执行: claudex use <name>',
    providersAvailable: '可选服务商:',
    askProvider: '请输入服务商序号或名称: ',
    askSwitchTo: '请输入要切换到的服务商序号或名称: ',
    askEdit: '请输入要编辑的服务商序号或名称: ',
    askDelete: '请输入要删除的服务商序号或名称: ',
    notEnteredProvider: '未输入服务商名称',
    providerIndexOutOfRange: '序号超出范围，请输入有效序号。',
    providerNotFound: '未找到服务商: {v}',
    manageTitle: '管理模型服务商',
    mg1: '1. 新增服务商',
    mg2: '2. 编辑服务商（覆盖保存）',
    mg3: '3. 删除服务商',
    mg4: '4. 列出服务商',
    mg5: '5. 返回主菜单',
    choose15: '请选择 (1-5): ',
    invalid15: '输入无效，请输入 1-5。',
    moreTitle: '更多设置',
    more1: '1. 初始化/修复 shell 快捷函数',
    more2: '2. 显示命令帮助',
    more3: '3. 语言设置（中文 / English）',
    more4: '4. 返回主菜单',
    choose14: '请选择 (1-4): ',
    invalid14: '输入无效，请输入 1-4。',
    langTitle: '语言设置',
    lang1: '1. 中文',
    lang2: '2. English',
    lang3: '3. 返回',
    langChoose: '请选择 (1-3): ',
    langInvalid: '输入无效，请输入 1-3。',
    langSaved: '语言已切换为: {v}',
    opFailed: '操作失败: {v}',
    execFailed: '执行失败: {v}',
    saved: '已保存: {v}',
    updated: '已更新: {v}',
    deleted: '已删除: {v}',
    cancelled: '已取消',
    testOK: '测试通过: {name} ({status})',
    doctorTitle: '诊断检查:',
    envConflicts: '- 环境变量冲突:',
    envNone: '- 环境变量冲突: 无',
    fixHint: '  修复: unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL',
    doctorNoCurrent: '- 当前服务商: 无',
    providerTestOK: '- 服务商测试: 通过 ({name}, HTTP {status})',
    providerTestFail: '- 服务商测试: 失败 ({name})',
    providerNameQ: '服务商名称（例如 gpt）: ',
    baseUrlQ: '服务地址（例如 https://api.example.com）: ',
    apiKeyQ: 'API Key: ',
    haikuQ: 'Haiku 模型（例如 gpt-5.4-mini）: ',
    sonnetQ: 'Sonnet 模型（例如 gpt-5.4）: ',
    opusQ: 'Opus 模型（例如 gpt-5.4-xhigh）: ',
    requiredErr: 'name/base-url/api-key/haiku-model/sonnet-model/opus-model 为必填项',
    initialized: '初始化完成: {v}',
    shellFile: 'Shell 配置文件: {v}',
    helperAdded: '已写入快捷函数: cdxrun',
    helperRun: '请执行: source {v}',
    helperExists: '快捷函数已存在',
    wizardSaved: '已保存配置: {v}',
    testNowQ: '是否立即测试连接？(Y/n): ',
    testPass: '连接测试通过: {name} (HTTP {status})',
    useUsage: '用法: claudex provider use <name>',
    removeUsage: '用法: claudex provider remove <name> [--yes]',
    testUsage: '用法: claudex provider test <name>',
    providerUsage: '用法: claudex provider <add|list|use|remove|test>',
    removeConfirm: '删除 {v} ? (y/N): '
  },
  en: {
    menuTitle: 'Claudex Main Menu',
    m1: '1. Initial setup for Claudex',
    m2: '2. View current configuration',
    m3: '3. Switch model provider',
    m4: '4. Manage model providers',
    m5: '5. Troubleshooting',
    m6: '6. More settings',
    m7: '7. Exit',
    choose17: 'Choose (1-7): ',
    invalid17: 'Invalid input. Enter 1-7.',
    bye: 'Exited.',
    currentProvider: 'Current provider: {v}',
    currentSettings: 'Current settings: {file} {state}',
    providers: 'Providers: {v}',
    noProviders: 'No providers found in ~/.claude/settings.<name>.json',
    noActiveProvider: 'No active provider. Run: claudex use <name>',
    providersAvailable: 'Available providers:',
    askProvider: 'Enter provider index or name: ',
    askSwitchTo: 'Enter provider index or name to switch to: ',
    askEdit: 'Enter provider index or name to edit: ',
    askDelete: 'Enter provider index or name to delete: ',
    notEnteredProvider: 'No provider name entered',
    providerIndexOutOfRange: 'Index out of range. Enter a valid provider index.',
    providerNotFound: 'Provider not found: {v}',
    manageTitle: 'Manage Model Providers',
    mg1: '1. Add provider',
    mg2: '2. Edit provider (overwrite)',
    mg3: '3. Delete provider',
    mg4: '4. List providers',
    mg5: '5. Back to main menu',
    choose15: 'Choose (1-5): ',
    invalid15: 'Invalid input. Enter 1-5.',
    moreTitle: 'More Settings',
    more1: '1. Initialize/repair shell helper',
    more2: '2. Show command help',
    more3: '3. Language (中文 / English)',
    more4: '4. Back to main menu',
    choose14: 'Choose (1-4): ',
    invalid14: 'Invalid input. Enter 1-4.',
    langTitle: 'Language',
    lang1: '1. Chinese',
    lang2: '2. English',
    lang3: '3. Back',
    langChoose: 'Choose (1-3): ',
    langInvalid: 'Invalid input. Enter 1-3.',
    langSaved: 'Language set to: {v}',
    opFailed: 'Operation failed: {v}',
    execFailed: 'Execution failed: {v}',
    saved: 'Saved: {v}',
    updated: 'Updated: {v}',
    deleted: 'Deleted: {v}',
    cancelled: 'Cancelled',
    testOK: 'Test OK: {name} ({status})',
    doctorTitle: 'Doctor checks:',
    envConflicts: '- Env conflicts:',
    envNone: '- Env conflicts: none',
    fixHint: '  Fix: unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL',
    doctorNoCurrent: '- Current provider: none',
    providerTestOK: '- Provider test: OK ({name}, HTTP {status})',
    providerTestFail: '- Provider test: FAIL ({name})',
    providerNameQ: 'Provider name (e.g. gpt): ',
    baseUrlQ: 'Base URL (e.g. https://api.example.com): ',
    apiKeyQ: 'API Key: ',
    haikuQ: 'Haiku model (e.g. gpt-5.4-mini): ',
    sonnetQ: 'Sonnet model (e.g. gpt-5.4): ',
    opusQ: 'Opus model (e.g. gpt-5.4-xhigh): ',
    requiredErr: 'name/base-url/api-key/haiku-model/sonnet-model/opus-model are required.',
    initialized: 'Initialized: {v}',
    shellFile: 'Shell file: {v}',
    helperAdded: 'Injected shell helper: cdxrun',
    helperRun: 'Run: source {v}',
    helperExists: 'Shell helper already exists',
    wizardSaved: 'Saved config: {v}',
    testNowQ: 'Test connection now? (Y/n): ',
    testPass: 'Connection test passed: {name} (HTTP {status})',
    useUsage: 'usage: claudex provider use <name>',
    removeUsage: 'usage: claudex provider remove <name> [--yes]',
    testUsage: 'usage: claudex provider test <name>',
    providerUsage: 'usage: claudex provider <add|list|use|remove|test>',
    removeConfirm: 'Delete {v}? (y/N): '
  }
};

function t(lang, key, vars = {}) {
  const table = TXT[lang] || TXT.zh;
  const base = table[key] || TXT.zh[key] || key;
  return base.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function usage() {
  console.log(`claudex v0.1.0

Usage:
  claudex                     # 直接启动 Claude（使用当前配置）
  claudex --continue          # 继续最近一次会话
  claudex menu                # 进入交互菜单
  claudex init
  claudex add
  claudex list
  claudex use <name|index>
  claudex remove <name|index> [--yes]
  claudex test [name|index]
  claudex lang <zh|en|中文|英文>
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

async function getLanguage() {
  if (await exists(languageFile)) {
    const v = (await fsp.readFile(languageFile, 'utf8')).trim().toLowerCase();
    if (v === 'zh' || v === 'en') return v;
  }
  return 'zh';
}

function normalizeLanguage(inputLang) {
  const v = (inputLang || '').trim().toLowerCase();
  if (v === 'zh' || v === 'cn' || v === 'zh-cn' || v === 'chinese' || v === '中文') return 'zh';
  if (v === 'en' || v === 'en-us' || v === 'english' || v === '英文') return 'en';
  return '';
}

async function setLanguage(lang) {
  const v = normalizeLanguage(lang);
  if (!v) throw new Error('language must be zh/en or 中文/英文');
  await ensureDir(appDir);
  await fsp.writeFile(languageFile, `${v}\n`, 'utf8');
  return v;
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

async function promptProviderAdd(flags, lang) {
  const rl = readline.createInterface({ input, output });
  try {
    const name = (flags.name || (await rl.question(t(lang, 'providerNameQ')))).trim();
    const baseUrl = (flags['base-url'] || (await rl.question(t(lang, 'baseUrlQ')))).trim();
    const apiKey = (flags['api-key'] || (await rl.question(t(lang, 'apiKeyQ')))).trim();
    const haikuModel = (flags['haiku-model'] || (await rl.question(t(lang, 'haikuQ')))).trim();
    const sonnetModel = (flags['sonnet-model'] || (await rl.question(t(lang, 'sonnetQ')))).trim();
    const opusModel = (flags['opus-model'] || (await rl.question(t(lang, 'opusQ')))).trim();

    if (!name || !baseUrl || !apiKey || !haikuModel || !sonnetModel || !opusModel) {
      throw new Error(t(lang, 'requiredErr'));
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

async function cmdInit(lang) {
  await ensureDir(appDir);
  await ensureDir(backupsDir);
  const injected = await injectShellBlock();
  const current = await getCurrentProvider();
  if (!current) await setCurrentProvider('gemma');

  console.log(t(lang, 'initialized', { v: appDir }));
  console.log(t(lang, 'shellFile', { v: injected.rc }));
  if (injected.changed) {
    console.log(t(lang, 'helperAdded'));
    console.log(t(lang, 'helperRun', { v: injected.rc }));
  } else {
    console.log(t(lang, 'helperExists'));
  }
}

async function pickProvider(lang, promptText) {
  const providers = await listProviders();
  if (providers.length === 0) {
    throw new Error(t(lang, 'noProviders'));
  }

  const current = await getCurrentProvider();
  console.log(t(lang, 'providersAvailable'));
  for (let i = 0; i < providers.length; i += 1) {
    const p = providers[i];
    console.log(`${i + 1}. ${p === current ? '*' : ' '} ${p}`);
  }
  const chosenRaw = await ask(promptText || t(lang, 'askProvider'));
  const chosen = chosenRaw.trim();
  if (!chosen) throw new Error(t(lang, 'notEnteredProvider'));

  if (/^\d+$/.test(chosen)) {
    const idx = Number(chosen) - 1;
    if (idx < 0 || idx >= providers.length) throw new Error(t(lang, 'providerIndexOutOfRange'));
    return providers[idx];
  }

  if (!providers.includes(chosen)) throw new Error(t(lang, 'providerNotFound', { v: chosen }));
  return chosen;
}

async function resolveProviderArg(input, lang) {
  const chosen = (input || '').trim();
  if (!chosen) return '';
  if (!/^\d+$/.test(chosen)) return chosen;

  const providers = await listProviders();
  const idx = Number(chosen) - 1;
  if (idx < 0 || idx >= providers.length) throw new Error(t(lang, 'providerIndexOutOfRange'));
  return providers[idx];
}

async function cmdProvider(subArgs, lang) {
  const [action, ...rest] = subArgs;
  const { flags, rest: positional } = parseFlags(rest);

  if (action === 'add') {
    const info = await promptProviderAdd(flags, lang);
    const file = await writeProviderSettings(info);
    if (flags.current || flags['set-current']) await setCurrentProvider(info.name);
    console.log(t(lang, 'saved', { v: file }));
    console.log(`claudex provider test ${info.name}`);
    return;
  }

  if (action === 'list') {
    const providers = await listProviders();
    const current = await getCurrentProvider();
    if (providers.length === 0) {
      console.log(t(lang, 'noProviders'));
      return;
    }
    for (let i = 0; i < providers.length; i += 1) {
      const p = providers[i];
      console.log(`${i + 1}. ${p === current ? '*' : ' '} ${p}`);
    }
    if (!current) {
      console.log(`\n${t(lang, 'noActiveProvider')}`);
    }
    return;
  }

  if (action === 'use') {
    const name = await resolveProviderArg(positional[0], lang);
    if (!name) throw new Error(t(lang, 'useUsage'));
    const file = providerSettingsPath(name);
    if (!(await exists(file))) throw new Error(`provider settings not found: ${file}`);
    await setCurrentProvider(name);
    console.log(t(lang, 'currentProvider', { v: name }));
    return;
  }

  if (action === 'remove') {
    const name = await resolveProviderArg(positional[0], lang);
    if (!name) throw new Error(t(lang, 'removeUsage'));
    const file = providerSettingsPath(name);
    if (!(await exists(file))) throw new Error(`provider settings not found: ${file}`);

    if (!flags.yes) {
      const rl = readline.createInterface({ input, output });
      const ans = (await rl.question(t(lang, 'removeConfirm', { v: file }))).trim().toLowerCase();
      rl.close();
      if (ans !== 'y' && ans !== 'yes') {
        console.log(t(lang, 'cancelled'));
        return;
      }
    }

    await backupFile(file);
    await fsp.unlink(file);
    const current = await getCurrentProvider();
    if (current === name) await fsp.unlink(currentProviderFile).catch(() => {});
    console.log(t(lang, 'deleted', { v: file }));
    return;
  }

  if (action === 'test') {
    const name = await resolveProviderArg(positional[0], lang);
    if (!name) throw new Error(t(lang, 'testUsage'));
    const result = await testProvider(name);
    console.log(t(lang, 'testOK', { name, status: result.status }));
    return;
  }

  throw new Error(t(lang, 'providerUsage'));
}

async function cmdStatus(lang) {
  const current = await getCurrentProvider();
  const providers = await listProviders();
  console.log(t(lang, 'currentProvider', { v: current || '(none)' }));
  if (current) {
    const file = providerSettingsPath(current);
    console.log(t(lang, 'currentSettings', { file, state: await exists(file) ? '(exists)' : '(missing)' }));
  }
  console.log(t(lang, 'providers', { v: providers.length ? providers.join(', ') : '(none)' }));
}

async function cmdDoctor(flags, lang) {
  const target = flags.provider || (await getCurrentProvider());
  console.log(t(lang, 'doctorTitle'));

  const conflicts = [];
  if (process.env.ANTHROPIC_AUTH_TOKEN) conflicts.push('ANTHROPIC_AUTH_TOKEN is set in current shell');
  if (process.env.ANTHROPIC_API_KEY) conflicts.push('ANTHROPIC_API_KEY is set in current shell');
  if (process.env.ANTHROPIC_BASE_URL) conflicts.push('ANTHROPIC_BASE_URL is set in current shell');

  if (conflicts.length) {
    console.log(t(lang, 'envConflicts'));
    for (const c of conflicts) console.log(`  - ${c}`);
    console.log(t(lang, 'fixHint'));
  } else {
    console.log(t(lang, 'envNone'));
  }

  if (!target) {
    console.log(t(lang, 'doctorNoCurrent'));
    return;
  }

  try {
    const result = await testProvider(target);
    console.log(t(lang, 'providerTestOK', { name: target, status: result.status }));
  } catch (err) {
    console.log(t(lang, 'providerTestFail', { name: target }));
    console.log(`  ${String(err.message || err)}`);
  }
}

async function configureWizard(lang) {
  await cmdInit(lang);
  const info = await promptProviderAdd({}, lang);
  const file = await writeProviderSettings(info);
  await setCurrentProvider(info.name);
  console.log(t(lang, 'wizardSaved', { v: file }));

  const ans = (await ask(t(lang, 'testNowQ'))).toLowerCase();
  if (ans === '' || ans === 'y' || ans === 'yes') {
    const result = await testProvider(info.name);
    console.log(t(lang, 'testPass', { name: info.name, status: result.status }));
  }
}

async function manageProvidersMenu(lang) {
  while (true) {
    console.log(`\n${t(lang, 'manageTitle')}`);
    console.log(t(lang, 'mg1'));
    console.log(t(lang, 'mg2'));
    console.log(t(lang, 'mg3'));
    console.log(t(lang, 'mg4'));
    console.log(t(lang, 'mg5'));
    const choice = await ask(t(lang, 'choose15'));

    try {
      if (choice === '1') {
        const info = await promptProviderAdd({}, lang);
        const file = await writeProviderSettings(info);
        console.log(t(lang, 'saved', { v: file }));
        continue;
      }
      if (choice === '2') {
        const name = await pickProvider(lang, t(lang, 'askEdit'));
        const info = await promptProviderAdd({ name }, lang);
        const file = await writeProviderSettings(info);
        console.log(t(lang, 'updated', { v: file }));
        continue;
      }
      if (choice === '3') {
        const name = await pickProvider(lang, t(lang, 'askDelete'));
        await cmdProvider(['remove', name, '--yes'], lang);
        continue;
      }
      if (choice === '4') {
        await cmdProvider(['list'], lang);
        continue;
      }
      if (choice === '5') return;
      console.log(t(lang, 'invalid15'));
    } catch (err) {
      console.log(t(lang, 'opFailed', { v: String(err.message || err) }));
    }
  }
}

async function moreSettingsMenu(lang) {
  while (true) {
    console.log(`\n${t(lang, 'moreTitle')}`);
    console.log(t(lang, 'more1'));
    console.log(t(lang, 'more2'));
    console.log(t(lang, 'more3'));
    console.log(t(lang, 'more4'));
    const choice = await ask(t(lang, 'choose14'));

    if (choice === '1') {
      await cmdInit(lang);
      continue;
    }
    if (choice === '2') {
      usage();
      continue;
    }
    if (choice === '3') {
      console.log(`\n${t(lang, 'langTitle')}`);
      console.log(t(lang, 'lang1'));
      console.log(t(lang, 'lang2'));
      console.log(t(lang, 'lang3'));
      while (true) {
        const langChoice = await ask(t(lang, 'langChoose'));
        if (langChoice === '1') {
          const saved = await setLanguage('zh');
          lang = saved;
          console.log(t(lang, 'langSaved', { v: saved }));
          break;
        }
        if (langChoice === '2') {
          const saved = await setLanguage('en');
          lang = saved;
          console.log(t(lang, 'langSaved', { v: saved }));
          break;
        }
        if (langChoice === '3') {
          break;
        }
        console.log(t(lang, 'langInvalid'));
      }
      continue;
    }
    if (choice === '4') return;
    console.log(t(lang, 'invalid14'));
  }
}

async function mainMenu(lang) {
  while (true) {
    console.log('\n==============================');
    console.log(t(lang, 'menuTitle'));
    console.log(t(lang, 'm1'));
    console.log(t(lang, 'm2'));
    console.log(t(lang, 'm3'));
    console.log(t(lang, 'm4'));
    console.log(t(lang, 'm5'));
    console.log(t(lang, 'm6'));
    console.log(t(lang, 'm7'));
    console.log('==============================');
    const choice = await ask(t(lang, 'choose17'));

    try {
      if (choice === '1') {
        await configureWizard(lang);
        continue;
      }
      if (choice === '2') {
        await cmdStatus(lang);
        continue;
      }
      if (choice === '3') {
        const name = await pickProvider(lang, t(lang, 'askSwitchTo'));
        await cmdProvider(['use', name], lang);
        continue;
      }
      if (choice === '4') {
        await manageProvidersMenu(lang);
        continue;
      }
      if (choice === '5') {
        await cmdDoctor({}, lang);
        continue;
      }
      if (choice === '6') {
        await moreSettingsMenu(lang);
        lang = await getLanguage();
        continue;
      }
      if (choice === '7' || choice.toLowerCase() === 'q') {
        console.log(t(lang, 'bye'));
        return;
      }
      console.log(t(lang, 'invalid17'));
    } catch (err) {
      console.log(t(lang, 'execFailed', { v: String(err.message || err) }));
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const lang = await getLanguage();
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
    await mainMenu(lang);
    return;
  }

  if (cmd.startsWith('-')) {
    await runClaude(argv);
    return;
  }

  if (cmd === 'add') {
    await cmdProvider(['add', ...rest], lang);
    return;
  }

  if (cmd === 'list') {
    await cmdProvider(['list', ...rest], lang);
    return;
  }

  if (cmd === 'use') {
    await cmdProvider(['use', ...rest], lang);
    return;
  }

  if (cmd === 'remove') {
    await cmdProvider(['remove', ...rest], lang);
    return;
  }

  if (cmd === 'test') {
    const [name] = rest;
    const provider = (await resolveProviderArg(name || '', lang)) || (await getCurrentProvider());
    if (!provider) throw new Error('usage: claudex test [name]');
    const result = await testProvider(provider);
    console.log(t(lang, 'testOK', { name: provider, status: result.status }));
    return;
  }

  if (cmd === 'init') {
    await cmdInit(lang);
    return;
  }

  if (cmd === 'provider') {
    await cmdProvider(rest, lang);
    return;
  }

  if (cmd === 'status') {
    await cmdStatus(lang);
    return;
  }

  if (cmd === 'lang') {
    const next = normalizeLanguage(rest[0] || '');
    if (!next) throw new Error('usage: claudex lang <zh|en|中文|英文>');
    const saved = await setLanguage(next);
    console.log(t(saved, 'langSaved', { v: saved }));
    return;
  }

  if (cmd === 'update') {
    await cmdUpdate(rest);
    return;
  }

  if (cmd === 'doctor') {
    const { flags } = parseFlags(rest);
    await cmdDoctor(flags, lang);
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
