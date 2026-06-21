import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Resolving npm-style launchers (claude / npm / claudex / codex) on Windows
//
// On POSIX a bare command name is correct: PATH resolves it like the user's
// shell does. On Windows it is NOT: Node/libuv only appends `.exe` when
// searching PATH for an extension-less command. So spawn('claude') skips npm's
// `claude.cmd` / `claude.ps1` shims (and can hit an older WinGet `claude.exe`),
// and spawn('npm') / spawn('codex') fail outright with ENOENT because those
// ship only as `.cmd` / `.ps1` (there is no `.exe`). We replicate the shell's
// PATH×PATHEXT lookup, and for an npm-style shim we run the cli.js it wraps
// with our own node — identical to what the shim does, but Node escapes args
// safely (no shell), so values containing spaces survive.
//
// Pure core: every environment dependency is injected, so it is unit-testable
// without touching the real filesystem or running on Windows.
// ---------------------------------------------------------------------------
export function resolveWindowsLauncher(name, cliCandidates, opts = {}) {
  const platform = opts.platform || process.platform;
  if (platform !== 'win32') return { file: name, prefixArgs: [] };

  const pathEnv = opts.pathEnv ?? process.env.PATH ?? process.env.Path ?? '';
  const pathExt = opts.pathExt ?? process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD';
  const execPath = opts.execPath || process.execPath;
  const fileExists = opts.fileExists || ((p) => fs.existsSync(p));

  const dirs = pathEnv.split(';')
    .map((d) => d.trim().replace(/^"+|"+$/g, ''))
    .filter(Boolean);

  // PATHEXT order mirrors cmd.exe; append .CMD/.PS1 so npm shims stay
  // discoverable even when PATHEXT omits them (.PS1 is not in the default).
  const exts = [];
  for (const raw of `${pathExt};.CMD;.PS1`.split(';')) {
    const ext = raw.trim();
    if (ext && !exts.some((x) => x.toLowerCase() === ext.toLowerCase())) exts.push(ext);
  }

  let found = null;
  for (const dir of dirs) {
    for (const ext of exts) {
      // Lower-case the ext (PATHEXT is upper-case) so the resolved path matches
      // the on-disk name users see from `where`; Windows matches either way.
      const candidate = path.join(dir, `${name}${ext.toLowerCase()}`);
      if (fileExists(candidate)) { found = candidate; break; }
    }
    if (found) break;
  }

  if (!found) return { file: name, prefixArgs: [] };

  const ext = path.extname(found).toLowerCase();
  if (ext === '.exe' || ext === '.com') {
    return { file: found, prefixArgs: [] }; // directly spawnable; safe arg passing
  }

  // .cmd/.bat/.ps1 are shims that need a shell to run — and a shell mangles
  // args containing spaces. Resolve the cli.js the shim wraps and run it with
  // our own node instead, so Node escapes the args safely.
  const dir = path.dirname(found);
  for (const segments of cliCandidates) {
    const cli = path.join(dir, ...segments);
    if (fileExists(cli)) return { file: execPath, prefixArgs: [cli] };
  }

  // Unusual layout: fall back to a shell-resolved launch (correct binary; the
  // space-in-arg caveat only bites the rare no-cli.js shim install).
  return { file: found, prefixArgs: [], shell: true };
}

// npm-style packages keep their cli.js next to the shim, under node_modules.
const CLI_CANDIDATES = {
  claude: [['node_modules', '@anthropic-ai', 'claude-code', 'cli.js']],
  npm: [['node_modules', 'npm', 'bin', 'npm-cli.js']],
  claudex: [['node_modules', 'claudex-cli', 'bin', 'claudex.js']],
  codex: [['node_modules', '@openai', 'codex', 'bin', 'codex.js']]
};

// Map a known command name to its launcher. Unknown names pass through as-is.
export function resolveCommand(name, opts = {}) {
  const candidates = CLI_CANDIDATES[name];
  if (!candidates) return { file: name, prefixArgs: [] };
  return resolveWindowsLauncher(name, candidates, opts);
}

export function resolveClaudeCommand(opts = {}) {
  return resolveCommand('claude', opts);
}
