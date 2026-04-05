# claudex-cli

一个面向非技术用户的轻量 CLI，用于配置和切换 Claude Code 的模型服务商，不需要手动修改 shell 配置。

## 功能特性

- 交互式服务商配置流程
- 服务商切换可持久化保存
- 一条命令启动，并自动清理环境变量冲突
- 健康检查与故障诊断（`doctor`、`test`）
- 修改文件前自动备份

## 快速开始

```bash
npm i -g claudex-cli
claudex
claudex --continue
claudex menu
```

行为说明：

- `claudex`：使用当前服务商配置直接启动 Claude
- `claudex --continue`：继续最近一次对话
- `claudex menu`：进入交互菜单模式

## 菜单项（`claudex menu`）

1. 开始配置 Claudex（首次使用）
2. 查看当前配置
3. 切换模型服务商
4. 管理模型服务商（新增/编辑/删除）
5. 问题排查
6. 更多设置
7. 退出

## 命令列表

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

## 数据位置

- 服务商配置：`~/.claude/settings.<name>.json`
- 当前服务商：`~/.config/claudex-cli/current-provider`
- 备份目录：`~/.config/claudex-cli/backups/`

## 说明

- `run` 在启动 `claude` 之前会清理当前 shell 中的 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`，避免鉴权冲突。
- `init` 会在你的 shell 配置文件中写入快捷函数 `cdxrun()`。

## 许可证

MIT
