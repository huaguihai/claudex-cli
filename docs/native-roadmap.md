# Claudex Native Roadmap

## Final goal

`claudex native` 的最终目标不是做一个开关，而是让通过 claudex 接入的第三方模型，在 Claude Code 中的高频任务行为尽可能稳定地接近原生 Opus / Sonnet 体验。

这里的“接近原生”至少包括：

1. 工具和工作流路由更接近 Claude Code 原生习惯
2. 不同 provider 下的协议与行为差异可控
3. provider 能力边界对系统是显式可见的
4. 用户只需要理解少量命令与少量状态
5. 研发过程可测、可回归、可持续优化

## Product principles

- 不复刻 hello2cc 的重型 hook 堆叠路线
- 不为了轻量而牺牲行为质量
- 不把核心逻辑永久堆在 `src/cli.js`
- 不在没有 benchmark 的情况下声称“更接近原生”
- 每个阶段都只做对“更接近原生体验”有直接贡献的事情

## Current architecture

当前仓库已经具备 Native 运行时骨架：

- `src/native-context.js`：结构化 Native runtime context
- `src/provider-profile.js`：provider behavior profile 推断
- `src/alignment-policy.js`：profile + provider-aware 策略提示
- `src/provider-tuning.js`：provider 默认 profile 与 autotune 接入
- `scripts/run-native-benchmark.js`：benchmark runner
- `scripts/summarize-native-benchmark.js`：摘要生成
- `scripts/generate-native-autotune.js`：自动调优推荐
- `scripts/render-native-dashboard.js`：HTML dashboard

## Phase roadmap

### Phase 0 — Product shell

已完成的方向：

- `claudex native` 命令入口
- `claudex menu` 中的 Native 入口
- `native.json` 持久状态
- `status` / `doctor` / `use` 联动
- 启动时 Native 注入链路

### Phase 1 — Native Context v1

目标：把 Native 模式从自由文本提示升级为结构化 runtime context。

关键结果：

- Native context schema
- 启动注入优先级规则
- `native doctor` 能展示结构化摘要

### Phase 2 — Provider Behavior Profile

目标：从“当前 provider 名称”升级为“可用于决策的行为画像”。

关键结果：

- `provider_family`
- `api_surface`
- `native_reliability`
- `workflow_bias`
- `compatibility_hints`

### Phase 3 — Alignment Policy Core

目标：建立小而硬、可测的行为对齐内核。

关键结果：

- `response_style_hints`
- `routing_hints`
- `delegation_hints`
- `safety_hints`

### Phase 4 — Evaluation Harness

目标：让 Native 策略可以被 benchmark、回放和对比。

关键结果：

- 固定任务集
- provider/profile 对比
- JSON 报告 + markdown 摘要

### Phase 5 — Experience maximization

目标：围绕关键任务集持续逼近原生 Opus 体验。

当前状态：进行中。当前 benchmark 已能稳定覆盖 repo research、small fix、workflow-sensitive、provider-sensitive 等高频场景，并且用最小 policy 补强消除了推荐 profile 口径下的核心缺失信号。

关键结果：

- 找出最关键差距
- 只补最影响体验的短板
- 保持架构清晰和维护成本可控
- 在不扩产品面的前提下补齐高频工作流信号

### Phase 6 — Multi-provider optimization layer

目标：同一套产品面下，对不同 provider family 做差异化最优策略。

当前状态：已起步。当前 benchmark 与 autotune 已能稳定把 anthropic / high-reliability surface 与 openai-compatible / proxy / dashscope surface 区分开来：前者更偏 `native-first`，后者更偏 `balanced`。

关键结果：

- tuned policy pack
- provider-aware 默认策略
- 不同 provider 的更优默认 profile
- provider-specific benchmark 场景已能表达差异

### Phase 7 — Native auto-tuning

目标：让系统能基于 benchmark 结果自动给出 profile 推荐。

当前状态：已有可用闭环。`last-autotune.json` 已可稳定产出 anthropic=`native-first`、openai-compatible / proxy / dashscope=`balanced` 的推荐，且 `native doctor` 可展示推荐结果与理由。

关键结果：

- benchmark-driven recommendation
- `native doctor` 可展示推荐 profile
- 静态规则向数据驱动过渡

### Phase 8 — Native control plane

目标：把 benchmark、推荐、provider 状态沉淀成可观测控制面。

关键结果：

- dashboard
- provider 对比视图
- 回归可视化

### Phase 9 — Experience leadership

目标：不只追求“能用”，而是长期保持第三方模型 Claude Code 体验对齐的领先能力。

关键结果：

- 新 provider 接入更快
- benchmark 任务集持续扩展
- 策略迭代仍保持低复杂度

## Current validation loop

当前建议的迭代闭环：

1. 调整 provider profile / alignment policy / tuning 逻辑
2. 运行 `npm run benchmark:native`
3. 运行 `npm run benchmark:native:summary`
4. 运行 `npm run benchmark:native:autotune`
5. 运行 `npm run benchmark:native:dashboard`
6. 查看 `tests/native-benchmarks/` 下的报告、推荐和 dashboard

## Stop / continue criteria

值得继续推进的信号：

- `native-first` / `balanced` 相对 native off 有稳定收益
- provider 差异开始可解释，而不是随机
- benchmark 结果能指导默认 profile 与策略收敛

需要重新评估路线的信号：

- 收益只能靠不断堆 prompt 和规则维持
- provider 差异大到单一 runtime manager 难以收敛
- benchmark 难以稳定描述“更像原生”的成功标准
- 复杂度增长速度逼近 hello2cc 的维护曲线
