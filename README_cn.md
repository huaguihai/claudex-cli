# claudex-cli

```
  ____ _        _   _   _ ____  _______  __
 / ___| |      / \ | | | |  _ \| ____\ \/ /
| |   | |     / _ \| | | | | | |  _|  \  /
| |___| |___ / ___ \ |_| | |_| | |___ /  \
 \____|_____/_/   \_\___/|____/|_____/_/\_\
```

切个 Claude 服务商要改 3 个环境变量？`claudex use gpt` 一条命令搞定。

[![English](https://img.shields.io/badge/English-111827?style=flat-square)](./README.md)
[![简体中文](https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-DC2626?style=flat-square)](./README_cn.md)

[![Version](https://img.shields.io/badge/version-0.1.0-orange)](./package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](./package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**适合**：希望保留原生 `claude` 使用手感，同时需要快速切换不同服务商配置的用户。

**不适合**：只用单一固定服务商、几乎不需要切换的场景。

<!-- AI-CONTEXT
project: claudex-cli
one-liner: 一条命令切换 Claude 服务商，不用碰环境变量
language: Node.js
min_runtime: node >= 18.0.0
package_manager: npm
install: npm i -g git+https://github.com/huaguihai/claudex-cli.git#main
verify: claudex --help
config_file: ~/.claude/settings.<name>.json; ~/.config/claudex-cli/current-provider
entry: bin/claudex.js
-->

## Agent Quick Start

```bash
# 1) 检查环境
node -v
# 要求: >= 18

# 2) 安装
npm i -g git+https://github.com/huaguihai/claudex-cli.git#main

# 3) 初始化（写入 shell helper + 本地状态目录）
claudex init
# 注意：如果未安装 Claude Code，claudex 会在首次运行时
# 自动检测并引导你安装。

# 4) 创建服务商配置（非交互式）
mkdir -p ~/.claude
cat > ~/.claude/settings.gpt.json << 'EOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com",
    "ANTHROPIC_API_KEY": "sk-your-key",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "your-haiku-model",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "your-sonnet-model",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "your-opus-model"
  }
}
EOF

# 或者用交互向导：
# claudex add

# 5) 切换到该服务商
claudex use gpt
# => 📌 当前服务商: gpt

# 6) 测试连接
claudex test
# => ✅ 测试通过: gpt (200)

# 7) 启动 Claude
claudex
# => 以 --settings ~/.claude/settings.gpt.json 启动 claude

# 可选：继续最近一次会话
claudex --continue
```

## 核心能力

| 能力 | 作用 |
|---|---|
| `claudex` | 以当前服务商配置启动 `claude` — 未安装 Claude Code 时自动检测并引导安装 |
| `claudex use <name>` | 一条命令切换服务商，跨会话持久化 |
| `claudex add` | 交互向导：名称 → 服务地址 → API key → 模型 |
| `claudex test [name]` | 在线探测 `/v1/messages` — 确认 key 和地址可用 |
| `claudex doctor` | 检查 Claude Code 安装、环境变量冲突和 API 连通性 |
| `claudex menu` | 引导菜单，适合不想记命令的用户 |
| `claudex --continue` | 透传给 Claude 的续聊参数 |

## 工作原理

```mermaid
graph LR
    A[用户命令] --> B[src/cli.js 参数解析]
    B --> C[当前服务商 ~/.config/claudex-cli/current-provider]
    C --> D[服务商配置 ~/.claude/settings.<name>.json]
    D --> E[以 --settings 启动 claude]
    E --> F[启动前清理冲突环境变量]
```

### 运行流程

1. 在 [`src/cli.js`](./src/cli.js) 解析命令。
2. 从 `~/.config/claudex-cli/current-provider` 读取当前服务商。
3. 加载 `~/.claude/settings.<name>.json`。
4. 从进程环境中剥离 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`。
5. 执行 `claude --settings <file> ...args`。

### 关键设计决策

- **为什么启动前要剥离环境变量？**
不剥离的话，shell 里的 `ANTHROPIC_API_KEY` 会悄悄覆盖配置文件里的 key。你以为切到了服务商 B，请求其实还在打服务商 A。这个 bug 完全无感，直到你查账单才发现。

- **为什么 `claudex`（无参数）直接启动 Claude？**
大多数用户每天启动几十次 Claude。`claudex` 和 `claude` 是一样的肌肉记忆，只是多了自动路由到当前服务商。加个子命令（`claudex run`）会拖慢最常走的路径。

- **为什么把菜单模式单独放到 `menu`？**
熟练用户不想在 shell 和 Claude 之间多一层菜单。新手需要引导。分开意味着两种人都不用为对方买单。

## 安装

### 全局安装

```bash
npm i -g git+https://github.com/huaguihai/claudex-cli.git#main
```

### 源码运行

```bash
git clone https://github.com/huaguihai/claudex-cli.git
cd claudex-cli
node ./bin/claudex.js --help
```

## 基本用法

### 切换服务商并启动

```bash
claudex use gpt
# => 📌 当前服务商: gpt

claudex
# => 以 gpt 服务商配置启动 claude
```

### 继续上次会话

```bash
claudex --continue
```

### 快速诊断

```bash
claudex doctor
# => 🩺 诊断检查:
# => - Claude Code: 已安装 (2.1.86)
# => - 环境变量冲突: 无
# => - 服务商测试: 通过 (gpt, HTTP 200)
```

## 命令列表

```text
claudex                          # 以当前服务商启动 claude
claudex --continue               # 继续最近一次会话
claudex menu                     # 交互菜单
claudex init                     # 初始化 shell helper + 状态目录
claudex add                      # 新增服务商（交互）
claudex list                     # 列出所有服务商
claudex use <name|序号>           # 切换服务商
claudex remove <name|序号> [--yes]
claudex test [name|序号]          # 测试 API 连通性
claudex lang <zh|en>             # 切换语言
claudex status                   # 查看当前配置
claudex update [--from-local <path>] [--from-npm]
claudex doctor [--provider <name>]
claudex run [claude args...]     # 透传给 claude
```

更新源：`claudex update` 默认从 GitHub 拉取。加 `--from-npm` 走 npm registry。

## 配置参考

### 服务商配置文件：`~/.claude/settings.<name>.json`

| 字段 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_BASE_URL` | 是 | API 地址（如 `https://api.anthropic.com`） |
| `ANTHROPIC_API_KEY` | 是 | API 密钥 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 是 | Haiku 级别请求使用的模型名 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 是 | Sonnet 级别请求使用的模型名 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 是 | Opus 级别请求使用的模型名 |

所有字段在 `env` 键下：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com",
    "ANTHROPIC_API_KEY": "sk-...",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4-mini",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4-xhigh"
  }
}
```

### 当前服务商指针

| 项目 | 值 |
|------|-----|
| 文件 | `~/.config/claudex-cli/current-provider` |
| 内容 | 服务商名称（如 `gpt`） |

### 备份

每次覆盖服务商配置文件时，旧版本自动保存到 `~/.config/claudex-cli/backups/`。

## 常见问题（Top 3）

**`401 Invalid API key`**
→ 检查服务商配置里的 key 和 base URL。运行 `claudex test <name>`。确认 shell 全局变量没有把 key 覆盖掉。

**`Auth conflict`（token 和 API key 同时存在）**
→ 配置里只保留一种认证方式。避免在 shell 中同时设置两套 Anthropic 认证变量。

**`Could not resolve host` 或请求超时**
→ 检查 DNS、代理、网络链路。用 `curl` 直连服务地址验证。运行 `claudex doctor` 快速定位。

## 许可证

MIT
