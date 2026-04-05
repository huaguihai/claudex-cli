# claudex-cli

A lightweight CLI for non-technical users to configure and switch Claude Code providers without editing shell files manually.

## Features

- Interactive provider setup (`provider add`)
- Persistent provider switch (`provider use`)
- One-command run with conflict-safe env cleanup (`run`)
- Health diagnostics (`doctor`, `provider test`)
- Safe backup before file changes (`init`, `remove`)

## Quick Start

```bash
npm i -g claudex-cli
claudex init
claudex provider add
claudex provider test <name>
claudex provider use <name>
claudex run --continue
```

## Commands

```text
claudex init
claudex provider add [--name N --base-url URL --api-key KEY --model MODEL]
claudex provider list
claudex provider use <name>
claudex provider remove <name> [--yes]
claudex provider test <name>
claudex status
claudex doctor [--provider <name>]
claudex run [claude args...]
```

## Data Layout

- Provider settings: `~/.claude/settings.<name>.json`
- Current provider: `~/.config/claudex-cli/current-provider`
- Backups: `~/.config/claudex-cli/backups/`

## Notes

- `run` removes `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_BASE_URL` from current shell env before launching `claude` to avoid auth conflicts.
- `init` adds a shell helper `cdxrun()` to your shell rc file.

## License

MIT
