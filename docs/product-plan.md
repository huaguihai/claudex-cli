# Product Plan (v0.1)

## Target User

Users who can run terminal commands but do not want to manually edit Claude settings and shell profile files.

## Core Journey

1. Install CLI
2. Run `claudex init`
3. Add provider through prompts (`claudex provider add`)
4. Test provider (`claudex provider test <name>`)
5. Switch provider (`claudex provider use <name>`)
6. Launch Claude (`claudex run --continue`)

## v0.1 Scope

- Provider CRUD
- Persistent current provider
- Claude launch wrapper with env sanitization
- Basic diagnostics and provider test
- Backup before modifying files

## v0.2 Ideas

- Preset templates (OpenAI-compatible, Anthropic-compatible, New API)
- Better diagnosis categories (DNS/TLS/Auth/Protocol)
- Non-interactive CI mode
- PowerShell support and Windows installer

## Risks

- Different proxy/provider protocol edge cases
- Users with heavily customized shell files
- Sensitive key storage expectations

## Mitigation

- Keep writes minimal and block-scoped
- Always backup before mutate
- Keep keys out of logs
- Provide deterministic doctor output and suggested fixes
