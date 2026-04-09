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

**适合**：希望保留原生 `claude` 使用手感，同时需要快速切换不同服务商配置，并为第三方模型长期保持 Native 模式的用户。

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

# 6) 开启 Native 模式（持久生效）
claudex native on
claudex native profile native-first

# 7) 测试连接
claudex test
# => ✅ 测试通过: gpt (200)

# 8) 启动 Claude
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
| `claudex test [name]` | 按 provider 协议特征做连通性探测，必要时回退到 Claude smoke test |
| `claudex doctor` | 检查 Claude Code 安装、环境变量冲突、Native 状态和服务商连通性 |
| `claudex native ...` | 持久 Native 模式：开启/关闭、查看状态、选择配置档，也可从 `claudex menu` 进入同样流程 |
| `claudex menu` | 引导菜单，适合不想记命令的用户 |
| Native runtime context | 启动时注入结构化运行时上下文，包含 provider 画像、策略提示和调优结果 |
| Native benchmark harness | 用固定场景比较 `balanced` / `native-first` / `cost-first` |
| Native autotune | 根据 benchmark 结果生成 profile 推荐 |
| Native dashboard | 把 benchmark 摘要、推荐结果和 provider 对比渲染成 HTML |

## Native 运行时系统

Claudex Native 不是单纯的开关，而是让第三方模型在 Claude Code 中尽可能接近原生工作流的运行时层。

当前结构：

- `src/native-context.js` — 结构化 Native context builder
- `src/provider-profile.js` — provider 行为画像推断
- `src/alignment-policy.js` — routing / delegation / response-style 策略提示
- `src/provider-tuning.js` — provider-aware 默认 profile 与 autotune 接入
- `scripts/run-native-benchmark.js` — benchmark 执行器
- `scripts/summarize-native-benchmark.js` — markdown 摘要生成器
- `scripts/generate-native-autotune.js` — 自动调优推荐生成器
- `scripts/render-native-dashboard.js` — HTML dashboard 渲染器

三种 profile 的意图：

- `native-first` — 更强调接近原生 Claude Code 的路由和工作流
- `balanced` — 优先保持 Native 体验，同时对兼容性敏感 provider 更保守
- `cost-first` — 压低重型工作流升级与 delegation 倾向

provider-aware 默认策略：

- anthropic / 高可靠 provider 更偏 `native-first`
- openai-compatible provider 默认更偏 `balanced`
- 如果存在 autotune 结果，则优先采用 benchmark 驱动的推荐而不是静态默认值
- 当前 benchmark 已能在不扩产品面的前提下区分 anthropic/native-first 与 openai-compatible、proxy、dashscope/balanced 的默认走向

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

### 开启 Native 模式

```bash
claudex native on
claudex native profile native-first
# 之后切换服务商会自动继承，直到你手动修改
```

当前 Native 模式不再只是追加一句轻量提示，而是注入结构化 runtime context，里面可以包含：

- provider 名称与 settings 文件
- protocol mode 与 slot mapping
- provider behavior profile
- alignment policy hints
- provider tuning / autotune recommendation

如果你显式传了 `--system-prompt` 或 `--append-system-prompt`，仍然以你的显式输入为准。

### Benchmark 与自动调优

```bash
npm run benchmark:native
npm run benchmark:native:summary
npm run benchmark:native:autotune
npm run benchmark:native:dashboard
```

产物：

- `tests/native-benchmarks/last-report.json`
- `tests/native-benchmarks/last-summary.md`
- `tests/native-benchmarks/last-autotune.json`
- `tests/native-benchmarks/dashboard.html`

当前 benchmark/autotune 结论：

- anthropic / 高可靠 surface 当前稳定收敛到 `native-first`
- openai-compatible / proxy / dashscope surface 当前稳定收敛到 `balanced`
- `native doctor` 现在会输出去重后的 policy hints，更容易检查实际 routing / delegation 策略

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
# => - Native 状态: 已开启 (native-first)
# => - 服务商测试: 通过 (gpt, HTTP 200, openai-chat-completions)
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
claudex native on                # 开启持久 Native 模式
claudex native off               # 关闭持久 Native 模式
claudex native status            # 查看 Native 状态
claudex native profile [name]    # 设置或交互选择配置档
claudex native doctor            # 查看 Native 检查结果
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

### Native 模式状态

| 项目 | 值 |
|------|-----|
| 文件 | `~/.config/claudex-cli/native.json` |
| 内容 | `{ "enabled": boolean, "profile": "native-first|balanced|cost-first" }` |

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

## 文档

- `docs/product-plan.md`
- `docs/native-roadmap.md`
- `tests/native-benchmarks/`
