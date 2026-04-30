#!/usr/bin/env node
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  buildNativeContext,
  buildNativeDoctorLines,
  buildNativeRuntimePrompt,
  buildTaskSignalSummary,
  defaultNativeConfig,
  nativeStateLabel,
  validateNativeProfile
} from './native-context.js';
import {
  buildProviderBehaviorProfile,
  preferredProtocolOrder
} from './provider-profile.js';
import { buildAlignmentPolicy } from './alignment-policy.js';
import { buildProviderTuning } from './provider-tuning.js';
import { classifyPromptSignals } from './prompt-signals.js';
import { buildDynamicRouteGuidance, buildRouteDecision } from './route-guidance.js';
import {
  appendSessionStep,
  buildSessionContext,
  inferStepKind,
  readSessionState,
  writeSessionState
} from './session-guidance.js';
import {
  buildSubagentQualityGate,
  buildSubagentQualityGuidance
} from './subagent-quality.js';
import {
  buildTaskQualityGate,
  buildTaskQualityGuidance
} from './task-quality.js';


const home = os.homedir();
const claudeDir = path.join(home, '.claude');
const globalClaudeSettingsFile = path.join(claudeDir, 'settings.json');
const appDir = path.join(home, '.config', 'claudex-cli');
const backupsDir = path.join(appDir, 'backups');
const currentProviderFile = path.join(appDir, 'current-provider');
const languageFile = path.join(appDir, 'language');
const nativeConfigFile = path.join(appDir, 'native.json');
const sessionStateFile = path.join(appDir, 'native-session.json');
const legacyCurrentProviderFile = path.join(claudeDir, 'current-provider');

const defaultGlobalClaudeSettings = {
  env: {
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    ENABLE_TOOL_SEARCH: 'false'
  }
};
class BackSignal extends Error {
  constructor() {
    super('BACK_SIGNAL');
    this.name = 'BackSignal';
  }
}

const BANNER_ART = [
  '  ____ _        _   _   _ ____  _______  __',
  ' / ___| |      / \\ | | | |  _ \\| ____\\ \\/ /',
  '| |   | |     / _ \\| | | | | | |  _|  \\  / ',
  '| |___| |___ / ___ \\ |_| | |_| | |___ /  \\ ',
  ' \\____|_____/_/   \\_\\___/|____/|_____/_/\\_\\'
];

const TXT = {
  zh: {
    menuTitle: 'Claudex 主菜单',
    bannerSub: 'Provider Switching Console',
    bannerBy: 'Powered by github.com/huaguihai',
    m1: '1. 开始配置claudex',
    m2: '2. 查看当前配置',
    m3: '3. 切换模型服务商',
    m4: '4. 管理模型服务商',
    m5: '5. Native 模式',
    m6: '6. 问题排查',
    m7: '7. 更多设置',
    m8: '8. 退出',
    choose18: '请选择 (1-8): ',
    invalid18: '输入无效，请输入 1-8。',
    bye: '👋 已退出。',
    currentProvider: '📌 当前服务商: {v}',
    currentSettings: '当前配置文件: {file} {state}',
    providers: '服务商列表: {v}',
    noProviders: '未找到任何服务商配置（~/.claude/settings.<name>.json）',
    noActiveProvider: '⚠️ 当前未设置服务商，请执行: claudex use <name>',
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
    opFailed: '❌ 操作失败: {v}',
    execFailed: '❌ 执行失败: {v}',
    saved: '💾 已保存: {v}',
    updated: '✏️ 已更新: {v}',
    deleted: '🗑️ 已删除: {v}',
    cancelled: '已取消',
    testOK: '✅ 测试通过: {name} ({status}) via {protocol}',
    doctorTitle: '🩺 诊断检查:',
    envConflicts: '- 环境变量冲突:',
    envNone: '- 环境变量冲突: 无',
    fixHint: '  修复: unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL',
    doctorNoCurrent: '- 当前服务商: 无',
    providerTestOK: '- 服务商测试: 通过 ({name}, HTTP {status}, {protocol})',
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
    globalSettingsCreated: '🧩 已创建全局 Claude 配置: {v}',
    globalSettingsExists: 'ℹ️ 已保留现有全局 Claude 配置: {v}',
    wizardSaved: '已保存配置: {v}',
    testNowQ: '是否立即测试连接？(Y/n): ',
    testPass: '连接测试通过: {name} (HTTP {status}, {protocol})',
    claudeNotFound: '⚠️ 未检测到 Claude Code CLI（claude 命令不可用）',
    claudeRequired: 'Claudex 需要 Claude Code 才能正常工作。',
    claudeInstallQ: '是否现在查看官方推荐安装命令？(Y/n): ',
    claudeInstallSkip: '已跳过。请先按官方方式安装 Claude Code，然后重试。',
    claudeInstallManual: '请先执行以下官方推荐安装命令:',
    claudeInstallFallback: '如需备选方式，可使用: {v}',
    claudeInstalled: '- Claude Code: 已安装 ({v})',
    claudeNotInstalled: '- Claude Code: 未安装',
    providerSetupRequired: '⚠️ 还没有可用的服务商配置，先进入引导菜单完成配置。',
    providerSetupMenu: '正在打开 claudex menu ...',
    providerSetupOptional: '如需手动配置，也可以运行: claudex add',
    nativeTitle: 'Native 模式',
    native1: '1. 开启 Native 模式',
    native2: '2. 关闭 Native 模式',
    native3: '3. 查看 Native 状态',
    native4: '4. 选择 Native 配置档',
    native5: '5. Native 检查',
    native6: '6. 返回主菜单',
    nativeChoose: '请选择 (1-6): ',
    nativeInvalid: '输入无效，请输入 1-6。',
    nativeEnabled: '✅ Native 模式已开启',
    nativeDisabled: '⏸️ Native 模式已关闭',
    nativeStatus: 'Native 模式: {state}',
    nativeProfile: 'Native 配置档: {profile}',
    nativeStateOn: '已开启',
    nativeStateOff: '已关闭',
    nativeInherited: 'Native 模式: 已继承 ({profile})',
    nativeProfilePrompt: '请选择配置档 (1-3): ',
    nativeProfileInvalid: '输入无效，请输入 1-3。',
    nativeProfileSet: '✅ Native 配置档已设置为: {profile}',
    nativeProfileHelp: '可选配置档: stable / native / aggressive',
    nativeProfileTitle: '选择 Native 配置档',
    nativeProfile1: '1. stable       （更稳，更保守）',
    nativeProfile2: '2. native       （默认，贴近原生 Claude Code）',
    nativeProfile3: '3. aggressive   （更激进，更偏高峰值原生体验与 workflow reuse）',
    nativeProfile4: '4. 返回',
    nativeDoctorTitle: 'Native 检查:',
    nativeDoctorSummary: '- Native 状态: {state} ({profile})',
    nativeDoctorInject: '- 注入方式: 启动 Claude 时追加结构化 runtime context',
    nativeDoctorPriority: '- 优先级: 若显式传入 --system-prompt/--append-system-prompt，则以显式输入为准',
    nativeUsage: '用法: claudex native <on|off|status|profile|doctor>',
  },
  en: {
    menuTitle: 'Claudex Main Menu',
    bannerSub: 'Provider Switching Console',
    bannerBy: 'Powered by github.com/huaguihai',
    m1: '1. Initial setup for Claudex',
    m2: '2. View current configuration',
    m3: '3. Switch model provider',
    m4: '4. Manage model providers',
    m5: '5. Native Mode',
    m6: '6. Troubleshooting',
    m7: '7. More settings',
    m8: '8. Exit',
    choose18: 'Choose (1-8): ',
    invalid18: 'Invalid input. Enter 1-8.',
    bye: '👋 Exited.',
    currentProvider: '📌 Current provider: {v}',
    currentSettings: 'Current settings: {file} {state}',
    providers: 'Providers: {v}',
    noProviders: 'No providers found in ~/.claude/settings.<name>.json',
    noActiveProvider: '⚠️ No active provider. Run: claudex use <name>',
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
    opFailed: '❌ Operation failed: {v}',
    execFailed: '❌ Execution failed: {v}',
    saved: '💾 Saved: {v}',
    updated: '✏️ Updated: {v}',
    deleted: '🗑️ Deleted: {v}',
    cancelled: 'Cancelled',
    testOK: '✅ Test OK: {name} ({status}) via {protocol}',
    doctorTitle: '🩺 Doctor checks:',
    envConflicts: '- Env conflicts:',
    envNone: '- Env conflicts: none',
    fixHint: '  Fix: unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL',
    doctorNoCurrent: '- Current provider: none',
    providerTestOK: '- Provider test: OK ({name}, HTTP {status}, {protocol})',
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
    globalSettingsCreated: '🧩 Created global Claude settings: {v}',
    globalSettingsExists: 'ℹ️ Kept existing global Claude settings: {v}',
    wizardSaved: 'Saved config: {v}',
    testNowQ: 'Test connection now? (Y/n): ',
    testPass: 'Connection test passed: {name} (HTTP {status}, {protocol})',
    claudeNotFound: '⚠️ Claude Code CLI not found (claude command unavailable)',
    claudeRequired: 'Claudex requires Claude Code to work properly.',
    claudeInstallQ: 'Show the official recommended Claude Code install command now? (Y/n): ',
    claudeInstallSkip: 'Skipped. Install Claude Code with an official method, then retry.',
    claudeInstallManual: 'Run this official recommended install command first:',
    claudeInstallFallback: 'Optional fallback: {v}',
    claudeInstalled: '- Claude Code: installed ({v})',
    claudeNotInstalled: '- Claude Code: not installed',
    providerSetupRequired: '⚠️ No provider configuration is available yet. Opening guided setup first.',
    providerSetupMenu: 'Opening claudex menu ...',
    providerSetupOptional: 'If you prefer manual setup, you can also run: claudex add',
    nativeTitle: 'Native Mode',
    native1: '1. Turn Native mode on',
    native2: '2. Turn Native mode off',
    native3: '3. View Native status',
    native4: '4. Choose Native profile',
    native5: '5. Run Native checks',
    native6: '6. Back to main menu',
    nativeChoose: 'Choose (1-6): ',
    nativeInvalid: 'Invalid input. Enter 1-6.',
    nativeEnabled: '✅ Native mode enabled',
    nativeDisabled: '⏸️ Native mode disabled',
    nativeStatus: 'Native mode: {state}',
    nativeProfile: 'Native profile: {profile}',
    nativeStateOn: 'on',
    nativeStateOff: 'off',
    nativeInherited: 'Native mode: inherited ({profile})',
    nativeProfilePrompt: 'Choose profile (1-3): ',
    nativeProfileInvalid: 'Invalid input. Enter 1-3.',
    nativeProfileSet: '✅ Native profile set to: {profile}',
    nativeProfileHelp: 'Available profiles: stable / native / aggressive',
    nativeProfileTitle: 'Choose Native profile',
    nativeProfile1: '1. stable       (prioritize reliability and guardrails)',
    nativeProfile2: '2. native       (default; prioritize native Claude Code feel)',
    nativeProfile3: '3. aggressive   (prioritize peak native-like experience)',
    nativeDoctorTitle: 'Native checks:',
    nativeDoctorSummary: '- Native status: {state} ({profile})',
    nativeDoctorInject: '- Injection: append structured runtime context when launching Claude',
    nativeDoctorPriority: '- Priority: explicit --system-prompt/--append-system-prompt always wins',
    nativeUsage: 'usage: claudex native <on|off|status|profile|doctor>',
  }
};

function t(lang, key, vars = {}) {
  const table = TXT[lang] || TXT.zh;
  const base = table[key] || TXT.zh[key] || key;
  return base.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function isBackInput(v) {
  const s = (v || '').trim().toLowerCase();
  return s === 'b' || s === 'back';
}

function renderBanner(lang) {
  const width = BANNER_ART.reduce((m, line) => Math.max(m, line.length), 0);
  const center = (text) => {
    const s = String(text ?? '');
    const left = Math.max(0, Math.floor((width - s.length) / 2));
    return `${' '.repeat(left)}${s}`;
  };

  console.log('');
  for (const line of BANNER_ART) {
    console.log(line);
  }
  console.log(center(t(lang, 'bannerSub')));
  console.log(center(t(lang, 'bannerBy')));
  console.log('');
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
  claudex native <on|off|status|profile|doctor>
  claudex update [--from-local <path>] [--from-npm]
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
  claudex native on
  claudex native profile native
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

async function ensureGlobalClaudeSettings(lang, { quiet = false } = {}) {
  await ensureDir(claudeDir);

  if (await exists(globalClaudeSettingsFile)) {
    if (!quiet) console.log(t(lang, 'globalSettingsExists', { v: globalClaudeSettingsFile }));
    return { created: false, file: globalClaudeSettingsFile };
  }

  await writeJson(globalClaudeSettingsFile, defaultGlobalClaudeSettings);
  if (!quiet) console.log(t(lang, 'globalSettingsCreated', { v: globalClaudeSettingsFile }));
  return { created: true, file: globalClaudeSettingsFile };
}

async function readSessionStateFile() {
  return readSessionState(sessionStateFile, async (file) => await fsp.readFile(file, 'utf8'));
}

async function writeSessionStateFile(state) {
  await writeSessionState(sessionStateFile, state, async (file, content) => {
    await ensureDir(path.dirname(file));
    await fsp.writeFile(file, content + '\n', { mode: 0o600 });
  });
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


async function getNativeConfig() {
  if (!(await exists(nativeConfigFile))) return defaultNativeConfig();
  try {
    const data = await readJson(nativeConfigFile);
    return {
      enabled: Boolean(data?.enabled),
      profile: validateNativeProfile(data?.profile) || 'native'
    };
  } catch {
    return defaultNativeConfig();
  }
}

async function writeNativeConfig(config) {
  await ensureDir(appDir);
  const next = {
    enabled: Boolean(config?.enabled),
    profile: validateNativeProfile(config?.profile) || 'native'
  };
  await writeJson(nativeConfigFile, next);
  return next;
}

async function setNativeConfig(patch) {
  const current = await getNativeConfig();
  return writeNativeConfig({ ...current, ...patch });
}

async function cmdNativeStatus(lang) {
  const config = await getNativeConfig();
  console.log(t(lang, 'nativeStatus', { state: nativeStateLabel(lang, config.enabled) }));
  console.log(t(lang, 'nativeProfile', { profile: config.profile }));
}

async function cmdNativeDoctor(lang) {
  const current = await getCurrentProvider();
  const config = await getNativeConfig();
  const settingsFile = current ? providerSettingsPath(current) : '';
  let context = buildNativeContext(config, {
    providerName: current || 'unknown',
    settingsFile: settingsFile || 'unknown',
    protocolMode: 'unknown',
    slotMapping: {},
    compatibilityHints: []
  });

  if (current && (await exists(settingsFile))) {
    const settings = await readJson(settingsFile);
    const auth = readProviderAuth(settings);
    context = await buildRuntimeNativeContext(current, settingsFile, config, auth, '');
  }

  for (const line of buildNativeDoctorLines(context, lang)) {
    console.log(line);
  }
  const profile = context.provider_profile;
  if (profile) {
    if (lang === 'zh') {
      console.log(`- Provider 画像: family=${profile.provider_family}, surface=${profile.api_surface}, native_reliability=${profile.native_reliability}, agent_routing=${profile.agent_routing_stability}, tool_use=${profile.tool_use_stability}`);
    } else {
      console.log(`- Provider profile: family=${profile.provider_family}, surface=${profile.api_surface}, native_reliability=${profile.native_reliability}, agent_routing=${profile.agent_routing_stability}, tool_use=${profile.tool_use_stability}`);
    }
  }
  const tuning = context.provider_tuning;
  if (tuning) {
    const currentProfile = context.native_profile || 'native';
    const matchesRecommendation = currentProfile === tuning.recommended_profile;
    if (lang === 'zh') {
      console.log(`- 推荐 profile: ${tuning.recommended_profile} (${tuning.tuned_policy_pack})`);
      console.log(`- 推荐来源: ${tuning.recommendation_source || 'unknown'} | 置信度: ${tuning.confidence || 'unknown'}`);
      console.log(`- 当前采用: ${currentProfile}${matchesRecommendation ? '（与推荐一致）' : '（与推荐不一致）'}`);
      console.log(`- 推荐理由: ${tuning.rationale.join('；')}`);
      const taskSignals = buildTaskSignalSummary(context.task_signals);
      if (taskSignals) {
        console.log(`- 动态任务信号: ${taskSignals}`);
      }
    } else {
      console.log(`- Recommended profile: ${tuning.recommended_profile} (${tuning.tuned_policy_pack})`);
      console.log(`- Recommendation source: ${tuning.recommendation_source || 'unknown'} | confidence: ${tuning.confidence || 'unknown'}`);
      console.log(`- Current profile: ${currentProfile}${matchesRecommendation ? ' (matches recommendation)' : ' (differs from recommendation)'}`);
      console.log(`- Rationale: ${tuning.rationale.join('; ')}`);
    }
  }
  const policy = context.alignment_policy;
  if (policy) {
    if (lang === 'zh') {
      console.log(`- 对齐策略: routing=${policy.routing_hints.join(', ') || 'none'} | response=${policy.response_style_hints.join(', ') || 'none'} | delegation=${policy.delegation_hints.join(', ') || 'none'}`);
    } else {
      console.log(`- Alignment policy: routing=${policy.routing_hints.join(', ') || 'none'} | response=${policy.response_style_hints.join(', ') || 'none'} | delegation=${policy.delegation_hints.join(', ') || 'none'}`);
    }
  }
}

async function pickNativeProfile(lang) {
  while (true) {
    console.log(`\n${t(lang, 'nativeProfileTitle')}`);
    console.log(t(lang, 'nativeProfile1'));
    console.log(t(lang, 'nativeProfile2'));
    console.log(t(lang, 'nativeProfile3'));
    console.log(t(lang, 'nativeProfile4'));
    const choice = await ask(t(lang, 'nativeProfilePrompt'));
    if (choice === '1') return 'stable';
    if (choice === '2') return 'native';
    if (choice === '3') return 'aggressive';
    if (choice === '4' || isBackInput(choice)) throw new BackSignal();
    console.log(t(lang, 'nativeProfileInvalid'));
  }
}


async function cmdNative(subArgs, lang) {
  const [action, ...rest] = subArgs;

  if (!action) {
    await cmdNativeStatus(lang);
    return;
  }

  if (action === 'on') {
    const config = await setNativeConfig({ enabled: true });
    console.log(t(lang, 'nativeEnabled'));
    console.log(t(lang, 'nativeProfile', { profile: config.profile }));
    return;
  }

  if (action === 'off') {
    const config = await setNativeConfig({ enabled: false });
    console.log(t(lang, 'nativeDisabled'));
    console.log(t(lang, 'nativeProfile', { profile: config.profile }));
    return;
  }

  if (action === 'status') {
    await cmdNativeStatus(lang);
    return;
  }

  if (action === 'doctor') {
    await cmdNativeDoctor(lang);
    return;
  }

  if (action === 'profile') {
    const candidate = validateNativeProfile(rest[0]);
    if (candidate) {
      await setNativeConfig({ profile: candidate });
      console.log(t(lang, 'nativeProfileSet', { profile: candidate }));
      return;
    }
    if (rest[0]) throw new Error(t(lang, 'nativeProfileHelp'));
    const profile = await pickNativeProfile(lang);
    await setNativeConfig({ profile });
    console.log(t(lang, 'nativeProfileSet', { profile }));
    return;
  }

  throw new Error(t(lang, 'nativeUsage'));
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

function detectClaudeCommand(options = {}) {
  const platform = options.platform || process.platform;
  const runner = options.runner || ((command, args, execOptions = {}) => execFileSync(command, args, execOptions));
  const candidates = platform === 'win32' ? ['claude', 'claude.cmd'] : ['claude'];

  for (const command of candidates) {
    try {
      const version = String(runner(command, ['--version'], { encoding: 'utf8' })).trim();
      return { command, version };
    } catch {
      continue;
    }
  }

  return null;
}

function isClaudeInstalled() {
  return detectClaudeCommand() !== null;
}

function getClaudeVersion() {
  const detected = detectClaudeCommand();
  return detected?.version || null;
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
    console.log(t(lang, 'backGuide'));
    const askOrFlag = async (flagValue, key) => {
      const v = (flagValue || (await rl.question(t(lang, key)))).trim();
      if (isBackInput(v)) throw new BackSignal();
      return v;
    };

    const name = await askOrFlag(flags.name, 'providerNameQ');
    const baseUrl = await askOrFlag(flags['base-url'], 'baseUrlQ');
    const apiKey = await askOrFlag(flags['api-key'], 'apiKeyQ');
    const haikuModel = await askOrFlag(flags['haiku-model'], 'haikuQ');
    const sonnetModel = await askOrFlag(flags['sonnet-model'], 'sonnetQ');
    const opusModel = await askOrFlag(flags['opus-model'], 'opusQ');

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
    model: env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL || env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
    slotMapping: {
      haiku: env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
      sonnet: env.ANTHROPIC_DEFAULT_SONNET_MODEL || '',
      opus: env.ANTHROPIC_DEFAULT_OPUS_MODEL || ''
    }
  };
}

async function buildRuntimeNativeContext(providerName, settingsFile, config, auth, promptText = '') {
  const protocolMode = preferredProtocolOrder(auth.baseUrl || '')[0] || 'unknown';
  const profile = buildProviderBehaviorProfile({
    providerName,
    baseUrl: auth.baseUrl || '',
    slotMapping: auth.slotMapping || {},
    protocolMode
  });
  const providerTuning = buildProviderTuning({ providerProfile: profile });
  const taskSignals = classifyPromptSignals(promptText);
  const previousSessionState = await readSessionStateFile();
  const resolvedProfile = config?.profile || providerTuning.recommended_profile || 'native';
  const preliminaryRouteDecision = buildRouteDecision({
    taskSignals,
    providerProfile: profile,
    nativeProfile: resolvedProfile
  });
  const sessionContext = buildSessionContext({
    taskSignals,
    routeDecision: preliminaryRouteDecision,
    previousState: previousSessionState
  });
  const routeDecision = buildRouteDecision({
    taskSignals,
    providerProfile: profile,
    nativeProfile: resolvedProfile,
    sessionContext
  });
  const routeGuidance = buildDynamicRouteGuidance({
    taskSignals,
    providerProfile: profile,
    nativeProfile: resolvedProfile,
    sessionContext
  });
  const subagentQualityGate = buildSubagentQualityGate({
    taskSignals,
    routeDecision,
    nativeProfile: resolvedProfile
  });
  const subagentQualityGuidance = buildSubagentQualityGuidance(subagentQualityGate);
  const taskQualityGate = buildTaskQualityGate({
    taskSignals,
    routeDecision,
    nativeProfile: resolvedProfile
  });
  const taskQualityGuidance = buildTaskQualityGuidance(taskQualityGate);
  const alignmentPolicy = buildAlignmentPolicy({
    nativeProfile: resolvedProfile,
    providerProfile: profile,
    policyPack: providerTuning.policy_pack || null,
    taskSignals,
    sessionContext,
    subagentQualityGate,
    taskQualityGate,
    routeDecision
  });

  return buildNativeContext(config, {
    providerName: providerName || 'unknown',
    settingsFile: settingsFile || 'unknown',
    protocolMode,
    slotMapping: auth.slotMapping || {},
    compatibilityHints: profile.compatibility_hints || [],
    taskSignals,
    routeDecision,
    routeGuidance,
    recentStepKind: sessionContext.recentStepKind,
    sessionState: previousSessionState,
    sessionGuidance: sessionContext.sessionGuidance,
    sessionTrajectory: sessionContext.sessionTrajectory,
    longHorizonSession: sessionContext.longHorizonSession,
    longHorizonGuidance: sessionContext.longHorizonGuidance,
    subagentQualityGate,
    subagentQualityGuidance,
    taskQualityGate,
    taskQualityGuidance,
    providerProfile: profile,
    alignmentPolicy,
    providerTuning
  });
}

async function testAnthropicMessages(baseUrl, apiKey, model) {
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
    return { ok: true, status: res.status, id: data.id || null, protocol: 'anthropic-messages' };
  }

  const text = (await res.text()).slice(0, 500);
  return { ok: true, status: res.status, preview: text, protocol: 'anthropic-messages' };
}

async function testOpenAiCompletions(baseUrl, apiKey, model) {
  const root = baseUrl.replace(/\/$/, '');
  const url = root.endsWith('/chat/completions') ? root : `${root}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
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
    return { ok: true, status: res.status, id: data.id || null, protocol: 'openai-chat-completions' };
  }

  const text = (await res.text()).slice(0, 500);
  return { ok: true, status: res.status, preview: text, protocol: 'openai-chat-completions' };
}

async function testProviderViaClaude(settingsFile) {
  return await new Promise((resolve, reject) => {
    const child = spawn('claude', [
      '--settings', settingsFile,
      '-p', 'Reply with OK only.',
      '--output-format', 'text'
    ], {
      env: sanitizedEnv(defaultNativeConfig())
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 30000);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, status: 'OK', preview: stdout.trim().slice(0, 120), protocol: 'claude-cli-smoke' });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `claude exited with code ${code}`));
    });
  });
}

function preferredTestProtocols(baseUrl) {
  const root = String(baseUrl || '').trim().toLowerCase();
  if (!root) return ['anthropic', 'openai'];

  const openAiHints = [
    '/v1/chat/completions',
    '/chat/completions',
    'openai',
    'compatible',
    'dashscope',
    'localhost:3003',
    'ice.v.ua'
  ];

  if (openAiHints.some((hint) => root.includes(hint))) {
    return ['openai', 'anthropic'];
  }

  return ['anthropic', 'openai'];
}

async function testProvider(name) {
  const file = providerSettingsPath(name);
  if (!(await exists(file))) throw new Error(`provider not found: ${name}`);

  const settings = await readJson(file);
  const { baseUrl, apiKey, model } = readProviderAuth(settings);
  if (!baseUrl || !apiKey || !model) {
    throw new Error(`invalid settings in ${file}`);
  }

  const protocols = preferredTestProtocols(baseUrl);
  const errors = [];

  for (const protocol of protocols) {
    try {
      if (protocol === 'openai') {
        return await testOpenAiCompletions(baseUrl, apiKey, model);
      }
      return await testAnthropicMessages(baseUrl, apiKey, model);
    } catch (error) {
      errors.push(`${protocol} failed: ${String(error.message || error)}`);
    }
  }

  try {
    return await testProviderViaClaude(file);
  } catch (error) {
    errors.push(`claude-cli-smoke failed: ${String(error.message || error)}`);
  }

  throw new Error(errors.join(' | '));
}

function shouldInjectNativePrompt(extraArgs = []) {
  const args = Array.isArray(extraArgs) ? extraArgs : [];
  return !args.includes('--system-prompt') && !args.includes('--append-system-prompt');
}

function sanitizedEnv(nativeConfig = defaultNativeConfig()) {
  const next = { ...process.env };
  delete next.ANTHROPIC_AUTH_TOKEN;
  delete next.ANTHROPIC_API_KEY;
  delete next.ANTHROPIC_BASE_URL;
  next.CLAUDEX_NATIVE_ENABLED = nativeConfig.enabled ? '1' : '0';
  next.CLAUDEX_NATIVE_PROFILE = nativeConfig.profile || 'native';
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

function isClaudeInstalled() {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function recommendedClaudeInstallCommand() {
  if (process.platform === 'darwin') {
    return {
      command: 'curl -fsSL https://claude.ai/install.sh | bash',
      fallback: 'brew install --cask claude-code'
    };
  }

  if (process.platform === 'win32') {
    return {
      command: 'irm https://claude.ai/install.ps1 | iex',
      fallback: 'winget install Anthropic.ClaudeCode'
    };
  }

  return {
    command: 'curl -fsSL https://claude.ai/install.sh | bash',
    fallback: ''
  };
}

async function ensureClaudeInstalled(lang) {
  if (isClaudeInstalled()) return true;

  console.log(`\n${t(lang, 'claudeNotFound')}`);
  console.log(t(lang, 'claudeRequired'));
  console.log('');

  const ans = await ask(t(lang, 'claudeInstallQ'));
  if (!shouldRunTestInput(ans)) {
    console.log(t(lang, 'claudeInstallSkip'));
    return false;
  }

  const install = recommendedClaudeInstallCommand();
  console.log(t(lang, 'claudeInstallManual'));
  console.log(`> ${install.command}`);
  if (install.fallback) {
    console.log(t(lang, 'claudeInstallFallback', { v: install.fallback }));
  }
  return false;
}

async function ensureLaunchPrerequisites(lang) {
  if (!(await ensureClaudeInstalled(lang))) return false;

  await ensureDir(appDir);
  await ensureDir(backupsDir);
  await ensureGlobalClaudeSettings(lang, { quiet: true });

  if ((await listProviders()).length === 0) {
    console.log(t(lang, 'providerSetupRequired'));
    console.log(t(lang, 'providerSetupMenu'));
    console.log(t(lang, 'providerSetupOptional'));
    await mainMenu(lang);
    return false;
  }

  return true;
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

  const native = await getNativeConfig();
  const settingsJson = await readJson(settings);
  const auth = readProviderAuth(settingsJson);
  const promptText = extraArgs.filter((value) => typeof value === 'string' && !value.startsWith('-')).join(' ');
  const context = await buildRuntimeNativeContext(current, settings, native, auth, promptText);

  const launchArgs = ['--settings', settings];
  if (native.enabled && shouldInjectNativePrompt(extraArgs)) {
    launchArgs.push('--append-system-prompt', buildNativeRuntimePrompt(context));
  }
  launchArgs.push(...extraArgs);

  await new Promise((resolve, reject) => {
    const child = spawn('claude', launchArgs, {
      stdio: 'inherit',
      env: sanitizedEnv(native)
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`claude exited with code ${code}`));
    });
    child.on('error', reject);
  });

  const nextStepKind = inferStepKind({ taskSignals: context.task_signals, routeDecision: context.route_decision });
  const nextSessionState = {
    last_step_kind: nextStepKind,
    last_task_signals: Array.isArray(context.task_signals?.signalList) ? context.task_signals.signalList : [],
    last_route_decision: context.route_decision || null,
    source_prompt_excerpt: promptText,
    recent_steps: appendSessionStep(context.session_state, {
      step_kind: nextStepKind,
      task_signals: Array.isArray(context.task_signals?.signalList) ? context.task_signals.signalList : [],
      route_decision: context.route_decision || null,
      prompt_excerpt: promptText,
      updated_at: new Date().toISOString()
    })
  };
  await writeSessionStateFile(nextSessionState);
}

async function cmdUpdate(rest) {
  const { flags } = parseFlags(rest);
  const repoUrl = 'git+https://github.com/huaguihai/claudex-cli.git#main';
  const fromLocal = typeof flags['from-local'] === 'string' ? flags['from-local'] : '';
  const fromNpm = Boolean(flags['from-npm']);
  if (fromLocal) {
    console.log(`Updating from local path: ${fromLocal}`);
    await runProcess('npm', ['i', '-g', fromLocal], process.env);
    console.log('Update complete.');
    return;
  }

  if (fromNpm) {
    console.log('Updating from npm registry: claudex-cli@latest');
    await runProcess('npm', ['i', '-g', 'claudex-cli@latest'], process.env);
    console.log('Update complete.');
    return;
  }

  console.log(`Updating from GitHub: ${repoUrl}`);
  await runProcess('npm', ['i', '-g', repoUrl], process.env);
  console.log('Update complete.');
}

async function cmdInit(lang) {
  await ensureDir(appDir);
  await ensureDir(backupsDir);
  await ensureGlobalClaudeSettings(lang);
  const injected = await injectShellBlock();

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
  console.log(t(lang, 'backGuide'));
  const chosenRaw = await ask((promptText || t(lang, 'askProvider')));
  const chosen = chosenRaw.trim();
  if (!chosen) throw new Error(t(lang, 'notEnteredProvider'));
  if (isBackInput(chosen)) throw new BackSignal();

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
    let info;
    try {
      info = await promptProviderAdd(flags, lang);
    } catch (err) {
      if (err instanceof BackSignal) {
        console.log(t(lang, 'backDone'));
        return;
      }
      throw err;
    }
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
    const native = await getNativeConfig();
    if (native.enabled) {
      console.log(t(lang, 'nativeInherited', { profile: native.profile }));
    }
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
    console.log(t(lang, 'testOK', { name, status: result.status, protocol: result.protocol || 'unknown' }));
    return;
  }

  throw new Error(t(lang, 'providerUsage'));
}

async function cmdStatus(lang) {
  const current = await getCurrentProvider();
  const providers = await listProviders();
  const native = await getNativeConfig();
  console.log(t(lang, 'currentProvider', { v: current || '(none)' }));
  if (current) {
    const file = providerSettingsPath(current);
    console.log(t(lang, 'currentSettings', { file, state: await exists(file) ? '(exists)' : '(missing)' }));
  }
  console.log(t(lang, 'providers', { v: providers.length ? providers.join(', ') : '(none)' }));
  console.log(t(lang, 'nativeStatus', { state: nativeStateLabel(lang, native.enabled) }));
  console.log(t(lang, 'nativeProfile', { profile: native.profile }));
}

async function cmdDoctor(flags, lang) {
  const target = flags.provider || (await getCurrentProvider());
  const native = await getNativeConfig();
  console.log(t(lang, 'doctorTitle'));

  const ver = getClaudeVersion();
  if (ver) {
    console.log(t(lang, 'claudeInstalled', { v: ver }));
  } else {
    console.log(t(lang, 'claudeNotInstalled'));
  }

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

  console.log(t(lang, 'nativeDoctorSummary', {
    state: nativeStateLabel(lang, native.enabled),
    profile: native.profile
  }));

  if (!target) {
    console.log(t(lang, 'doctorNoCurrent'));
    return;
  }

  try {
    const result = await testProvider(target);
    console.log(t(lang, 'providerTestOK', { name: target, status: result.status, protocol: result.protocol || 'unknown' }));
  } catch (err) {
    console.log(t(lang, 'providerTestFail', { name: target }));
    console.log(`  ${String(err.message || err)}`);
  }
}

async function configureWizard(lang) {
  await cmdInit(lang);
  let info;
  try {
    info = await promptProviderAdd({}, lang);
  } catch (err) {
    if (err instanceof BackSignal) {
      console.log(t(lang, 'backDone'));
      return;
    }
    throw err;
  }
  const file = await writeProviderSettings(info);
  await setCurrentProvider(info.name);
  console.log(t(lang, 'wizardSaved', { v: file }));
  await askAndRunProviderTest(info.name, lang);
}

function shouldRunTestInput(ansRaw) {
  const ans = (ansRaw || '').trim().toLowerCase();
  return ans === '' || ans === 'y' || ans === 'yes' || ans === '是' || ans === 'ok';
}

async function askAndRunProviderTest(providerName, lang) {
  const ans = await ask(t(lang, 'testNowQ'));
  if (!shouldRunTestInput(ans)) return;
  console.log(t(lang, 'testingNow', { name: providerName }));
  const result = await testProvider(providerName);
  console.log(t(lang, 'testPass', { name: providerName, status: result.status, protocol: result.protocol || 'unknown' }));
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
        await askAndRunProviderTest(info.name, lang);
        continue;
      }
      if (choice === '2') {
        const name = await pickProvider(lang, t(lang, 'askEdit'));
        const info = await promptProviderAdd({ name }, lang);
        const file = await writeProviderSettings(info);
        console.log(t(lang, 'updated', { v: file }));
        await askAndRunProviderTest(info.name, lang);
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
      if (err instanceof BackSignal) {
        console.log(t(lang, 'backDone'));
        continue;
      }
      console.log(t(lang, 'opFailed', { v: String(err.message || err) }));
    }
  }
}


async function nativeMenu(lang) {
  while (true) {
    console.log(`\n${t(lang, 'nativeTitle')}`);
    console.log(t(lang, 'native1'));
    console.log(t(lang, 'native2'));
    console.log(t(lang, 'native3'));
    console.log(t(lang, 'native4'));
    console.log(t(lang, 'native5'));
    console.log(t(lang, 'native6'));
    const choice = await ask(t(lang, 'nativeChoose'));

    try {
      if (choice === '1') {
        await cmdNative(['on'], lang);
        continue;
      }
      if (choice === '2') {
        await cmdNative(['off'], lang);
        continue;
      }
      if (choice === '3') {
        await cmdNative(['status'], lang);
        continue;
      }
      if (choice === '4') {
        await cmdNative(['profile'], lang);
        continue;
      }
      if (choice === '5') {
        await cmdNative(['doctor'], lang);
        continue;
      }
      if (choice === '6') return;
      console.log(t(lang, 'nativeInvalid'));
    } catch (err) {
      if (err instanceof BackSignal) {
        console.log(t(lang, 'backDone'));
        continue;
      }
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
    renderBanner(lang);
    console.log('----------------------------------------');
    console.log(t(lang, 'menuTitle'));
    console.log(t(lang, 'm1'));
    console.log(t(lang, 'm2'));
    console.log(t(lang, 'm3'));
    console.log(t(lang, 'm4'));
    console.log(t(lang, 'm5'));
    console.log(t(lang, 'm6'));
    console.log(t(lang, 'm7'));
    console.log(t(lang, 'm8'));
    console.log('----------------------------------------');
    const choice = await ask(t(lang, 'choose18'));

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
        await nativeMenu(lang);
        continue;
      }
      if (choice === '6') {
        await cmdDoctor({}, lang);
        continue;
      }
      if (choice === '7') {
        await moreSettingsMenu(lang);
        lang = await getLanguage();
        continue;
      }
      if (choice === '8' || choice.toLowerCase() === 'q') {
        console.log(t(lang, 'bye'));
        return;
      }
      console.log(t(lang, 'invalid18'));
    } catch (err) {
      if (err instanceof BackSignal) {
        console.log(t(lang, 'backDone'));
        continue;
      }
      console.log(t(lang, 'execFailed', { v: String(err.message || err) }));
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const lang = await getLanguage();
  const [cmd, ...rest] = argv;
  if (!cmd) {
    if (!(await ensureLaunchPrerequisites(lang))) return;
    await runClaude([]);
    return;
  }

  if (cmd === '--help' || cmd === '-h') {
    usage();
    return;
  }

  if (cmd === 'menu') {
    if (!(await ensureClaudeInstalled(lang))) return;
    await mainMenu(lang);
    return;
  }

  if (cmd.startsWith('-')) {
    if (!(await ensureLaunchPrerequisites(lang))) return;
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
    console.log(t(lang, 'testOK', { name: provider, status: result.status, protocol: result.protocol || 'unknown' }));
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

  if (cmd === 'native') {
    await cmdNative(rest, lang);
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
    if (!(await ensureLaunchPrerequisites(lang))) return;
    await runClaude(rest);
    return;
  }

  throw new Error(`unknown command: ${cmd}`);
}

export { detectClaudeCommand };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`Error: ${err.message || err}`);
    process.exit(1);
  });
}
