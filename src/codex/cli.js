import path from 'node:path';
import fsp from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

import { t, knownLanguages } from './i18n.js';
import {
  codexHome,
  codexConfigTomlPath,
  codexAuthJsonPath,
  claudexAppDir,
  codexBackupsDir,
  codexSnapshotDir,
  codexCurrentProviderFile,
  codexAuditLogPath,
  codexLastKnownHashesPath,
  codexProvidersDir,
  isValidProviderName,
  isReservedProviderId,
  CLAUDEX_PROVIDER_PREFIX
} from './constants.js';
import {
  exists,
  ensureDir
} from '../shared/fs-utils.js';
import {
  listProviders,
  readProvider,
  writeProvider,
  removeProviderFile,
  getCurrentProvider,
  setCurrentProvider,
  resolveProviderArg,
  providerExists
} from './providers.js';
import { applyProviderSwitch } from './apply-switch.js';
import { revertToPreClaudex, restoreBackup } from './revert.js';
import {
  ensurePreClaudexSnapshot,
  listBackups,
  readSnapshotManifest
} from './snapshot.js';
import { tailAuditLog } from './audit.js';
import { readAuthJson, inspectAuthJson } from './auth-json.js';
import { runDoctor, formatDoctorReport, summariseStatus } from './doctor.js';
import { inspectDrift, acceptExternalChanges } from './reconcile.js';
import { restoreChatGptTokens, findLatestChatGptBackup } from './restore-chatgpt.js';
import {
  detectCodex,
  detectCodexAppRunning,
  spawnCodex,
  sanitizedCodexEnv,
  buildLaunchBanner,
  preflight
} from './launch.js';

const PKG_VERSION = '0.1.0';

const CLAUDEX_OWNED = new Set([
  'init',
  'menu',
  'add',
  'list',
  'use',
  'remove',
  'test',
  'status',
  'doctor',
  'native',
  'lang',
  'update',
  'snapshot',
  'restore',
  'revert',
  'audit',
  'reconcile',
  'restore-chatgpt'
]);

const HELP_FLAGS = new Set(['-h', '--help', 'help']);
const VERSION_FLAGS = new Set(['-v', '--version', 'version']);

// ----- entry -----

export async function main(argv = process.argv.slice(2)) {
  const lang = await getLanguageOrDefault();

  if (argv.length === 0) {
    // default codex launch
    return await runCodexDefault(lang);
  }

  const first = argv[0];

  if (first === '--') {
    return await passthroughCodex(argv.slice(1));
  }

  if (HELP_FLAGS.has(first)) {
    usage(lang);
    return 0;
  }
  if (VERSION_FLAGS.has(first)) {
    process.stdout.write(`codexx v${PKG_VERSION}\n`);
    return 0;
  }

  if (!CLAUDEX_OWNED.has(first)) {
    return await passthroughCodex(argv);
  }

  const sub = first;
  const rest = argv.slice(1);

  try {
    switch (sub) {
      case 'init':
        return await cmdInit(rest, lang);
      case 'menu':
        return await cmdMenu(rest, lang);
      case 'add':
        return await cmdAdd(rest, lang);
      case 'list':
        return await cmdList(rest, lang);
      case 'use':
        return await cmdUse(rest, lang);
      case 'remove':
        return await cmdRemove(rest, lang);
      case 'test':
        return await cmdTest(rest, lang);
      case 'status':
        return await cmdStatus(rest, lang);
      case 'doctor':
        return await cmdDoctor(rest, lang);
      case 'native':
        return await cmdNative(rest, lang);
      case 'lang':
        return await cmdLang(rest, lang);
      case 'update':
        return await cmdUpdate(rest, lang);
      case 'snapshot':
        return await cmdSnapshot(rest, lang);
      case 'restore':
        return await cmdRestore(rest, lang);
      case 'revert':
        return await cmdRevert(rest, lang);
      case 'audit':
        return await cmdAudit(rest, lang);
      case 'reconcile':
        return await cmdReconcile(rest, lang);
      case 'restore-chatgpt':
        return await cmdRestoreChatGpt(rest, lang);
      default:
        return await passthroughCodex(argv);
    }
  } catch (err) {
    process.stderr.write(`${t(lang, 'opFailed', { v: err.message || String(err) })}\n`);
    return 1;
  }
}

// ----- usage -----

function usage(lang) {
  const out = [];
  out.push(`codexx v${PKG_VERSION}`);
  out.push('');
  out.push(t(lang, 'usageHeader'));
  out.push('');
  out.push(t(lang, 'usageRun'));
  out.push('  codexx                          # spawn codex using the active provider');
  out.push('  codexx [<codex args>...]        # passthrough (e.g. codexx resume --last)');
  out.push('  codexx -- <args>                # force passthrough');
  out.push('');
  out.push(t(lang, 'usageMgmt'));
  out.push('  codexx init                     # initialise state dir + check codex install');
  out.push('  codexx menu                     # interactive menu (planned)');
  out.push('  codexx add                      # add provider via wizard');
  out.push('  codexx list                     # list providers');
  out.push('  codexx use <name|index>         # switch active provider');
  out.push('  codexx remove <name|index> [--yes]');
  out.push('  codexx test [name|index]        # provider connectivity test');
  out.push('  codexx status                   # show active provider summary');
  out.push('  codexx lang <zh|en>             # set CLI language');
  out.push('');
  out.push(t(lang, 'usageDiag'));
  out.push('  codexx doctor                   # diagnostics (planned)');
  out.push('  codexx snapshot                 # ensure pre-claudex snapshot');
  out.push('  codexx restore <id|latest>      # restore a previous backup');
  out.push('  codexx revert [--yes]           # restore pre-claudex state');
  out.push('  codexx audit [--tail N]         # view audit log');
  out.push('  codexx reconcile                # resolve config drift (planned)');
  out.push('  codexx restore-chatgpt          # restore ChatGPT OAuth tokens (planned)');
  out.push('  codexx native <on|off|status>   # native context (planned)');
  out.push('  codexx update                   # self-update');
  out.push('');
  out.push(t(lang, 'usageEsc'));
  out.push('  codexx resume / fork / exec / review / apply / mcp ...');
  process.stdout.write(out.join('\n') + '\n');
}

// ----- language -----

function languageFilePath() {
  return path.join(claudexAppDir(), 'language');
}

async function getLanguageOrDefault() {
  const file = languageFilePath();
  if (await exists(file)) {
    const v = (await fsp.readFile(file, 'utf8')).trim().toLowerCase();
    if (knownLanguages().includes(v)) return v;
  }
  return 'zh';
}

function normalizeLanguage(input) {
  const v = (input || '').trim().toLowerCase();
  if (v === 'zh' || v === 'cn' || v === 'zh-cn' || v === 'chinese' || v === '中文') return 'zh';
  if (v === 'en' || v === 'en-us' || v === 'english' || v === '英文') return 'en';
  return '';
}

async function cmdLang(args, lang) {
  if (args.length === 0) {
    process.stdout.write(`${await getLanguageOrDefault()}\n`);
    return 0;
  }
  const v = normalizeLanguage(args[0]);
  if (!v) {
    process.stderr.write(t(lang, 'invalidArg', { v: args[0] }) + '\n');
    return 2;
  }
  await ensureDir(claudexAppDir());
  await fsp.writeFile(languageFilePath(), v + '\n', 'utf8');
  process.stdout.write(`language: ${v}\n`);
  return 0;
}

// ----- init -----

async function cmdInit(args, lang) {
  await ensureDir(claudexAppDir());
  await ensureDir(codexProvidersDir());
  await ensureDir(codexBackupsDir());

  const codex = detectCodex();
  if (!codex.installed) {
    process.stderr.write(t(lang, 'codexNotInstalled') + '\n');
    return 1;
  }
  if (codex.version) {
    const major = parseInt(codex.version.split('.')[1] || '0', 10);
    if (major < 130) {
      process.stdout.write(t(lang, 'codexOldVersion', { v: codex.version }) + '\n');
    }
  }
  process.stdout.write(t(lang, 'initOk') + '\n');
  process.stdout.write(t(lang, 'codexCliVersion', { v: codex.version || 'unknown' }) + '\n');
  return 0;
}

// ----- list -----

async function cmdList(args, lang) {
  const names = await listProviders();
  if (names.length === 0) {
    process.stdout.write(t(lang, 'providersEmpty') + '\n');
    return 0;
  }
  const active = await getCurrentProvider();
  process.stdout.write(t(lang, 'providersHeader') + '\n');
  names.forEach((n, i) => {
    const mark = n === active ? t(lang, 'activeMark') : '';
    process.stdout.write(`  ${i + 1}. ${n}${mark}\n`);
  });
  return 0;
}

// ----- status -----

async function cmdStatus(args, lang) {
  const active = await getCurrentProvider();
  if (!active) {
    process.stdout.write(t(lang, 'noActiveProvider') + '\n');
  } else {
    process.stdout.write(t(lang, 'currentProvider', { v: active }) + '\n');
    try {
      const p = await readProvider(active);
      process.stdout.write(t(lang, 'currentEndpoint', { v: p.base_url }) + '\n');
      process.stdout.write(t(lang, 'currentModel', { v: p.model }) + '\n');
      process.stdout.write(t(lang, 'currentWireApi', { v: p.wire_api || 'chat' }) + '\n');
    } catch {
      // provider metadata missing but current pointer set — surface gracefully
    }
  }

  const auth = await readAuthJson();
  const inspect = inspectAuthJson(auth);
  if (inspect.present) {
    const mode = inspect.hasChatGptTokens
      ? `chatgpt (OAuth)`
      : (inspect.claudexManaged ? `${inspect.authMode || 'apikey'} (claudex managed)` : (inspect.authMode || 'unknown'));
    process.stdout.write(t(lang, 'currentAuthMode', { v: mode }) + '\n');
  }

  const codex = detectCodex();
  if (codex.installed) {
    process.stdout.write(t(lang, 'codexCliVersion', { v: codex.version || 'unknown' }) + '\n');
  } else {
    process.stdout.write(t(lang, 'codexCliMissing') + '\n');
  }
  const app = detectCodexAppRunning();
  if (app !== null) {
    if (app.running) {
      process.stdout.write(t(lang, 'codexAppRunning', { v: app.pid }) + '\n');
    } else {
      process.stdout.write(t(lang, 'codexAppNotRunning') + '\n');
    }
  }
  return 0;
}

// ----- add -----

async function cmdAdd(args, lang) {
  const flags = parseFlags(args);
  const provider = {
    name: flags.name,
    base_url: flags['base-url'] || flags.baseUrl,
    api_key: flags['api-key'] || flags.apiKey,
    model: flags.model,
    wire_api: flags['wire-api'] || flags.wireApi || 'chat',
    model_reasoning_effort: flags['reasoning-effort'] || flags.reasoningEffort
  };

  const allRequiredFromFlags = provider.name && provider.base_url && provider.api_key && provider.model;
  const interactive = process.stdin.isTTY === true;

  if (!allRequiredFromFlags) {
    if (!interactive) {
      const missing = ['name', 'base_url', 'api_key', 'model'].filter((k) => !provider[k.replace('_url', '-url').replace('_key', '-key')] && !provider[k.replace(/_/g, '')] && !provider[k]);
      // Compute missing required by direct key checks
      const realMissing = [];
      if (!provider.name) realMissing.push('--name');
      if (!provider.base_url) realMissing.push('--base-url');
      if (!provider.api_key) realMissing.push('--api-key');
      if (!provider.model) realMissing.push('--model');
      process.stderr.write(t(lang, 'missingArg', { v: realMissing.join(', ') }) + '\n');
      return 2;
    }
    const rl = readline.createInterface({ input, output });
    try {
      if (!provider.name) provider.name = (await rl.question(t(lang, 'askName'))).trim();
      if (!provider.base_url) provider.base_url = (await rl.question(t(lang, 'askBaseUrl'))).trim();
      if (!provider.api_key) provider.api_key = (await rl.question(t(lang, 'askApiKey'))).trim();
      if (!provider.model) provider.model = (await rl.question(t(lang, 'askModel'))).trim();
      if (!flags['wire-api'] && !flags.wireApi) {
        const w = (await rl.question(t(lang, 'askWireApi'))).trim();
        if (w) provider.wire_api = w;
      }
      if (!provider.model_reasoning_effort) {
        const r = (await rl.question(t(lang, 'askReasoning'))).trim();
        if (r) provider.model_reasoning_effort = r;
      }
    } finally {
      rl.close();
    }
  }

  // Drop empty optional fields
  if (!provider.model_reasoning_effort) delete provider.model_reasoning_effort;

  try {
    await writeProvider(provider);
  } catch (err) {
    process.stderr.write(t(lang, 'opFailed', { v: err.message }) + '\n');
    return 2;
  }
  process.stdout.write(t(lang, 'addedOk', { v: provider.name }) + '\n');
  return 0;
}

// ----- remove -----

async function cmdRemove(args, lang) {
  const flags = parseFlags(args);
  if (flags._.length === 0) {
    process.stderr.write(t(lang, 'missingArg', { v: 'name' }) + '\n');
    return 2;
  }
  const name = await resolveProviderArg(flags._[0]);
  const active = await getCurrentProvider();
  if (name === active) {
    process.stderr.write(t(lang, 'removeActive') + '\n');
    return 2;
  }
  if (!flags.yes) {
    const rl = readline.createInterface({ input, output });
    let ans;
    try {
      ans = (await rl.question(t(lang, 'removeConfirm', { v: name }))).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (ans !== 'y' && ans !== 'yes') {
      process.stdout.write(t(lang, 'canceled') + '\n');
      return 0;
    }
  }
  await removeProviderFile(name);
  process.stdout.write(t(lang, 'removedOk', { v: name }) + '\n');
  return 0;
}

// ----- use -----

async function cmdUse(args, lang) {
  const flags = parseFlags(args);
  if (flags._.length === 0) {
    process.stderr.write(t(lang, 'missingArg', { v: 'name' }) + '\n');
    return 2;
  }
  const name = await resolveProviderArg(flags._[0]);
  const provider = await readProvider(name);
  const previousProvider = await getCurrentProvider();

  const onDrift = async (drift) => {
    if (flags.force) return true;
    process.stdout.write(t(lang, 'driftDetected', { v: drift.driftedFiles.join(', ') }) + '\n');
    const rl = readline.createInterface({ input, output });
    let ans;
    try {
      ans = (await rl.question(t(lang, 'driftPrompt'))).trim().toLowerCase();
    } finally {
      rl.close();
    }
    return ans === 'y' || ans === 'yes';
  };

  const result = await applyProviderSwitch(provider, {
    previousProvider,
    onDrift
  });

  process.stdout.write(t(lang, 'switchedTo', { v: provider.name }) + '\n');
  process.stdout.write(t(lang, 'switchEndpoint', { v: provider.base_url }) + '\n');
  process.stdout.write(t(lang, 'switchModel', { v: provider.model }) + '\n');
  process.stdout.write(t(lang, 'backupAt', { v: result.backupDir }) + '\n');
  if (result.chatgptBackupPath) {
    process.stdout.write(t(lang, 'chatgptBackupAt', { v: result.chatgptBackupPath }) + '\n');
    process.stdout.write(t(lang, 'chatgptRestoreHint') + '\n');
  }
  const app = detectCodexAppRunning();
  if (app && app.running) {
    process.stdout.write(t(lang, 'restartCodexHint') + '\n');
  }
  return 0;
}

// ----- test -----

async function cmdTest(args, lang) {
  const flags = parseFlags(args);
  let name;
  if (flags._.length === 0) {
    name = await getCurrentProvider();
    if (!name) {
      process.stderr.write(t(lang, 'noActiveProvider') + '\n');
      return 2;
    }
  } else {
    name = await resolveProviderArg(flags._[0]);
  }
  const provider = await readProvider(name);
  process.stdout.write(t(lang, 'testRunning', { v: name }) + '\n');
  const result = await probeProvider(provider);
  if (result.ok) {
    process.stdout.write(
      t(lang, 'testOk', {
        v: name,
        status: result.status,
        protocol: result.protocol,
        ms: result.ms
      }) + '\n'
    );
    return 0;
  }
  process.stderr.write(t(lang, 'testFail', { v: name, reason: result.reason }) + '\n');
  return 1;
}

async function probeProvider(provider) {
  const wire = provider.wire_api || 'chat';
  const url = new URL(
    wire === 'responses' ? '/v1/responses' : '/v1/chat/completions',
    provider.base_url.endsWith('/') ? provider.base_url : provider.base_url + '/'
  );
  // Use a tiny body that should produce either a 200 or a 4xx telling us "auth ok but request wrong"
  const body = JSON.stringify(
    wire === 'responses'
      ? { model: provider.model, input: 'ping', max_output_tokens: 1 }
      : {
          model: provider.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
          stream: false
        }
  );
  const startedAt = Date.now();
  return await new Promise((resolve) => {
    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requester(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + (url.search || ''),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.api_key}`,
          'Content-Length': Buffer.byteLength(body).toString()
        },
        timeout: 8000
      },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const ms = Date.now() - startedAt;
          // Anything < 500 means we reached the provider (auth may still be off).
          const ok = res.statusCode < 500;
          resolve({
            ok,
            status: res.statusCode,
            ms,
            protocol: wire,
            reason: ok ? null : Buffer.concat(chunks).toString().slice(0, 200)
          });
        });
      }
    );
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, ms: Date.now() - startedAt, protocol: wire, reason: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, ms: Date.now() - startedAt, protocol: wire, reason: 'timeout' });
    });
    req.write(body);
    req.end();
  });
}

// ----- snapshot / restore / revert / audit -----

async function cmdSnapshot(args, lang) {
  const r = await ensurePreClaudexSnapshot();
  if (r.taken) process.stdout.write(t(lang, 'snapshotTaken', { v: r.dir }) + '\n');
  else process.stdout.write(t(lang, 'snapshotExisted') + '\n');
  return 0;
}

async function cmdRestore(args, lang) {
  const flags = parseFlags(args);
  const id = flags._[0] || 'latest';
  const result = await restoreBackup(id);
  process.stdout.write(t(lang, 'restoreOk', { v: result.id }) + '\n');
  return 0;
}

async function cmdRevert(args, lang) {
  const flags = parseFlags(args);
  const manifest = await readSnapshotManifest();
  if (!manifest) {
    process.stderr.write(t(lang, 'revertNoSnapshot') + '\n');
    return 1;
  }
  if (!flags.yes) {
    const rl = readline.createInterface({ input, output });
    let ans;
    try {
      ans = (await rl.question(t(lang, 'revertConfirm'))).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (ans !== 'y' && ans !== 'yes') {
      process.stdout.write(t(lang, 'canceled') + '\n');
      return 0;
    }
  }
  await revertToPreClaudex({
    removeStateFiles: true,
    preserveBackups: flags['preserve-backups'] !== false
  });
  process.stdout.write(t(lang, 'revertedOk') + '\n');
  return 0;
}

async function cmdAudit(args, lang) {
  const flags = parseFlags(args);
  const n = parseInt(flags.tail || '20', 10);
  const events = await tailAuditLog(n);
  if (events.length === 0) {
    process.stdout.write(t(lang, 'auditEmpty') + '\n');
    return 0;
  }
  process.stdout.write(t(lang, 'auditHeader', { v: events.length }) + '\n');
  for (const ev of events) {
    process.stdout.write(JSON.stringify(ev) + '\n');
  }
  return 0;
}

// ----- stubs (M4/M5) -----

async function cmdDoctor(args, lang) {
  const flags = parseFlags(args);
  const checks = await runDoctor({
    cwd: process.cwd(),
    provider: flags.provider
  });
  if (flags.json) {
    process.stdout.write(JSON.stringify({ checks, summary: summariseStatus(checks) }, null, 2) + '\n');
  } else {
    process.stdout.write(formatDoctorReport(checks));
    process.stdout.write(`Summary: ${summariseStatus(checks).toUpperCase()}\n`);
  }
  const summary = summariseStatus(checks);
  if (summary === 'fail') return 1;
  return 0;
}

async function cmdNative(args, lang) {
  process.stdout.write(t(lang, 'notImplemented') + ' (codexx native — M5)\n');
  return 0;
}

async function cmdMenu(args, lang) {
  process.stdout.write(t(lang, 'notImplemented') + ' (codexx menu — M5)\n');
  return 0;
}

async function cmdReconcile(args, lang) {
  const flags = parseFlags(args);
  const inspection = await inspectDrift();
  if (!inspection.baseline) {
    process.stdout.write('No codexx baseline yet — nothing to reconcile.\n');
    return 0;
  }
  const driftedFiles = [];
  if (inspection.drift.config) driftedFiles.push('config.toml');
  if (inspection.drift.auth) driftedFiles.push('auth.json');
  if (driftedFiles.length === 0) {
    process.stdout.write('No drift detected. State matches last codexx baseline.\n');
    return 0;
  }
  process.stdout.write(`Drift detected in: ${driftedFiles.join(', ')}\n`);
  for (const file of driftedFiles) {
    const d = file === 'config.toml' ? inspection.drift.config : inspection.drift.auth;
    process.stdout.write(`  ${file}: ${d.before?.slice(0, 12) || 'null'} → ${d.after?.slice(0, 12) || 'null'}\n`);
  }
  if (!flags.yes) {
    const rl = readline.createInterface({ input, output });
    let ans;
    try {
      ans = (await rl.question('Accept external changes as new baseline? [y/N]: ')).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (ans !== 'y' && ans !== 'yes') {
      process.stdout.write(t(lang, 'canceled') + '\n');
      return 0;
    }
  }
  await acceptExternalChanges();
  process.stdout.write('✅ Baseline updated to current state.\n');
  return 0;
}

async function cmdRestoreChatGpt(args, lang) {
  const found = await findLatestChatGptBackup();
  if (!found) {
    process.stderr.write('⚠️ No ChatGPT tokens backup found in codex-backups/.\n');
    return 1;
  }
  process.stdout.write(`Found ChatGPT tokens backup: ${found.backupId}\n`);
  const flags = parseFlags(args);
  if (!flags.yes) {
    const rl = readline.createInterface({ input, output });
    let ans;
    try {
      ans = (await rl.question('Restore ChatGPT OAuth tokens to ~/.codex/auth.json (overwriting current)? [y/N]: ')).trim().toLowerCase();
    } finally {
      rl.close();
    }
    if (ans !== 'y' && ans !== 'yes') {
      process.stdout.write(t(lang, 'canceled') + '\n');
      return 0;
    }
  }
  const result = await restoreChatGptTokens();
  process.stdout.write(`✅ ChatGPT OAuth tokens restored from backup ${result.backupId}\n`);
  return 0;
}

async function cmdUpdate(args, lang) {
  // self-update via npm; reuse pattern from claudex `claudex update`.
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve) => {
    const child = spawn(
      'npm',
      ['install', '-g', 'git+https://github.com/huaguihai/claudex-cli.git#main'],
      { stdio: 'inherit' }
    );
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => {
      process.stderr.write(`${t(lang, 'opFailed', { v: err.message })}\n`);
      resolve(1);
    });
  });
}

// ----- default + passthrough -----

async function runCodexDefault(lang) {
  const pre = await preflight();
  if (!pre.ok) {
    process.stderr.write(`${t(lang, 'opFailed', { v: pre.error })}\n`);
    return 1;
  }
  const active = await getCurrentProvider();
  if (active) {
    try {
      const provider = await readProvider(active);
      const banner = buildLaunchBanner(provider);
      if (banner && !process.env.CODEXX_QUIET) {
        process.stderr.write(banner + '\n');
      }
    } catch {
      // ignore
    }
  }
  for (const w of pre.warnings) process.stderr.write(`ℹ️ ${w}\n`);
  return await spawnCodex([]);
}

async function passthroughCodex(args) {
  return await spawnCodex(args);
}

// ----- shared flag parser -----

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      out._.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('-')) {
          out[a.slice(2)] = true;
        } else {
          out[a.slice(2)] = next;
          i++;
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      out[a.slice(1)] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}
