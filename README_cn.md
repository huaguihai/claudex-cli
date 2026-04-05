# claudex-cli

用一条命令切换并启动 Claude 模型服务商。

[English README](./README.md)

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](./package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**适合**：希望保留原生 `claude` 使用手感，同时需要快速切换不同服务商配置的用户。

**不适合**：只用单一固定服务商、几乎不需要切换的场景。

<!-- AI-CONTEXT
project: claudex-cli
one-liner: 用一条命令切换并启动 Claude 模型服务商
language: Node.js
min_runtime: node >= 18.0.0
package_manager: npm
install: npm i -g claudex-cli
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
npm i -g claudex-cli

# 3) 初始化（写入 shell helper + 本地状态目录）
claudex init

# 4) 新增服务商（交互录入）
claudex add
# 依次输入:
# - 服务商名称（例如 gpt）
# - 服务地址
# - API key
# - Haiku 模型
# - Sonnet 模型
# - Opus 模型

# 5) 切换到该服务商
claudex use gpt

# 6) 测试连接
claudex test

# 7) 启动 Claude
claudex

# 可选：继续最近一次会话
claudex --continue
```

## 核心能力

| 能力 | 作用 |
|---|---|
| `claudex` | 启动 `claude --settings <当前服务商配置>` |
| `claudex --continue` | 透传给 Claude 的续聊参数 |
| `claudex use <name>` | 切换并持久化当前服务商 |
| `claudex add` | 交互生成 `~/.claude/settings.<name>.json` |
| `claudex test [name]` | 在线探测接口连通性（`/v1/messages`） |
| `claudex menu` | 面向非技术用户的引导菜单 |

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
4. 启动前清理 `ANTHROPIC_AUTH_TOKEN`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`。
5. 执行 `claude --settings <file> ...args`。

### 关键设计决策

- 为什么把 `claudex` 作为默认启动命令？
日常高频路径最短，尽量接近原生 `claude` 体验。

- 为什么把菜单模式单独放到 `menu`？
新手可引导、熟练用户不被打断。

- 为什么启动前清理环境变量？
防止 shell 全局变量覆盖配置文件，导致鉴权冲突。

## 安装

### 全局安装

```bash
npm i -g claudex-cli
```

### 源码运行

```bash
git clone https://github.com/huaguihai/claudex-cli.git
cd claudex-cli
node ./bin/claudex.js --help
```

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

## 配置参考

### 服务商配置文件：`~/.claude/settings.<name>.json`

示例：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com",
    "ANTHROPIC_API_KEY": "sk-...",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "gpt-5.4",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "gpt-5.4"
  }
}
```

### 当前服务商指针

- 文件：`~/.config/claudex-cli/current-provider`
- 内容：服务商名称（如 `gpt`）

## 常见问题（Top 3）

**1）`401 Invalid API key`**
- 先检查服务商配置里的 key 和 base URL。
- 运行：`claudex test <name>`。
- 确认没有 shell 全局变量把 key 覆盖掉。

**2）提示 `Auth conflict`（token 和 API key 同时存在）**
- 保证配置里只保留一种认证方式。
- 避免在 shell 中同时设置两套 Anthropic 认证变量。

**3）`Could not resolve host` 或请求超时**
- 检查 DNS、代理、网络链路。
- 用 `curl` 直连服务地址验证。
- 运行 `claudex doctor` 快速定位。

## 许可证

MIT
