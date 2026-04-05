# claudex-cli

A lightweight CLI for non-technical users to configure and switch Claude Code providers without editing shell files manually.

[中文说明 (README_cn.md)](./README_cn.md)

## Features

- Interactive setup flow for providers
- Persistent provider switching
- One-command launch with environment conflict cleanup
- Health diagnostics (`doctor`, `test`)
- Automatic backup before file changes

## Quick Start

```bash
npm i -g claudex-cli
claudex
claudex --continue
claudex menu
```

Behavior:

- `claudex`: launch Claude directly with the current provider
- `claudex --continue`: continue the most recent conversation
- `claudex menu`: open interactive menu mode

## Menu Items (`claudex menu`)

1. Initial setup for Claudex (first-time use)
2. View current configuration
3. Switch model provider
4. Manage model providers (add/edit/remove)
5. Troubleshooting
6. More settings
7. Exit

## Commands

```text
claudex
claudex --continue
claudex menu
claudex init
claudex add
claudex list
claudex use <name>
claudex remove <name> [--yes]
claudex test [name]
claudex status
claudex doctor [--provider <name>]
claudex run [claude args...]
```

## Data Layout

- Provider settings: `~/.claude/settings.<name>.json`
- Current provider: `~/.config/claudex-cli/current-provider`
- Backups: `~/.config/claudex-cli/backups/`

## Notes

- `run` removes `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_BASE_URL` from the current shell environment before launching `claude`, to avoid auth conflicts.
- `init` adds a shell helper `cdxrun()` to your shell profile.

## License

MIT
