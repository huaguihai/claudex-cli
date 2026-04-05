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
claudex
claudex --continue
claudex menu
```

Behavior:

- `claudex`: launch Claude directly with current provider
- `claudex --continue`: continue last conversation
- `claudex menu`: open interactive menu

`claudex menu` will open:

1. 开始配置claudex（首次使用）
2. 查看当前配置
3. 切换模型服务商
4. 管理模型服务商（新增/编辑/删除）
5. 问题排查
6. 更多设置
7. 退出

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

- `run` removes `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_BASE_URL` from current shell env before launching `claude` to avoid auth conflicts.
- `init` adds a shell helper `cdxrun()` to your shell rc file.

## License

MIT
