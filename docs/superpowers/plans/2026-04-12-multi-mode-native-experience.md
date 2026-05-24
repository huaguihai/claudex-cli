# Multi-Mode Native Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-facing Stable / Native / Aggressive experience modes that absorb the highest-value hello2cc-style behavior patterns without sacrificing claudex's benchmarked control and provider-aware safety.

**Architecture:** Keep the current native runtime architecture intact, but introduce a new experience-mode layer that maps onto provider tuning, alignment policy, runtime context, CLI surface, and benchmark fixtures. Implement the new modes by reusing existing routing/session/provider infrastructure rather than adding a separate heuristic engine, then extend benchmark/replay/smoke fixtures so each mode has explicit, testable behavior boundaries.

**Tech Stack:** Node.js, plain JavaScript ESM, Claude Code CLI integration, JSON benchmark fixtures, markdown docs

---

## File Structure

### Existing files to modify
- `src/native-context.js`
  - Extend profile validation/default config and doctor/runtime serialization to support the new user-facing modes.
- `src/provider-tuning.js`
  - Map provider families and autotune output onto Stable / Native / Aggressive recommendations.
- `src/alignment-policy.js`
  - Define per-mode routing / delegation / response-style / safety behavior.
- `src/cli.js`
  - Update CLI/profile selection labels, help text, and persistence logic so users can choose the new modes.
- `scripts/run-native-benchmark.js`
  - Update supported profile set and recommendation scoring to include the new modes.
- `scripts/generate-native-autotune.js`
  - Regenerate recommendation output logic for the new mode names and rationale.
- `tests/native-benchmarks/core.json`
  - Add or rename benchmark fixtures to express the user-facing mode promises.
- `tests/native-benchmarks/replay.json`
  - Add continuation-heavy cases that differentiate Stable vs Native/Aggressive behavior.
- `tests/native-benchmarks/smoke.json`
  - Add high-value smoke checks for continuation, exposed-capability reuse, and aggressive workflow behavior.
- `README.md`
  - Replace engineering-facing profile language with user-facing experience-mode language.
- `README_cn.md`
  - Keep the Chinese README in lockstep with the English one.

### Generated artifacts expected to refresh
- `tests/native-benchmarks/last-report.json`
- `tests/native-benchmarks/last-summary.md`
- `tests/native-benchmarks/last-autotune.json`
- `tests/native-benchmarks/last-replay.json`
- `tests/native-benchmarks/last-smoke.json`
- `tests/native-benchmarks/dashboard.html`

### Existing code to reuse
- `src/route-guidance.js`
  - Keep the current route-decision/session-aware routing logic; only feed it stronger mode-specific hints instead of replacing it.
- `src/session-guidance.js`
  - Reuse the long-horizon / verify-closeout / verify-reentry logic as the backbone for continuation-heavy Native/Aggressive modes.
- `src/prompt-signals.js`
  - Reuse the existing signal classification; do not add a parallel classifier unless a benchmark fixture proves a missing signal.

---

### Task 1: Rename profiles into user-facing experience modes at the runtime boundary

**Files:**
- Modify: `src/native-context.js`
- Modify: `src/cli.js`
- Test: `tests/native-benchmarks/core.json`

- [ ] **Step 1: Update profile validation and defaults in `src/native-context.js`**

```js
export function defaultNativeConfig() {
  return {
    enabled: false,
    profile: 'native'
  };
}

export function validateNativeProfile(profile) {
  const value = String(profile || '').trim();
  if (value === 'stable' || value === 'native' || value === 'aggressive') return value;
  return '';
}
```

- [ ] **Step 2: Update doctor/runtime labels in `src/native-context.js` to reflect the new mode names**

```js
const normalized = {
  enabled: Boolean(config?.enabled),
  profile: validateNativeProfile(config?.profile) || 'native'
};
```

Also update all fallback strings like:

```js
context?.native_profile || 'native'
```

in both the runtime prompt builder and doctor output builder.

- [ ] **Step 3: Update CLI help and menu text in `src/cli.js`**

Replace the profile help/menu strings so users see the new experience names instead of `native-first / balanced / cost-first`.

Expected target text shape:

```js
nativeProfileHelp: 'Available profiles: stable / native / aggressive'
nativeProfile1: '1. stable       (prioritize reliability and guardrails)'
nativeProfile2: '2. native       (default; prioritize native Claude Code feel)'
nativeProfile3: '3. aggressive   (prioritize peak native-like experience)'
```

- [ ] **Step 4: Update any profile parsing branches in `src/cli.js`**

Any branch that currently assumes:

```js
native-first / balanced / cost-first
```

must be updated to:

```js
stable / native / aggressive
```

without changing persistence file shape beyond the string value.

- [ ] **Step 5: Run the CLI smoke command to verify help still works**

Run:
```bash
cd /root/claudex-cli && node ./bin/claudex.js --help
```

Expected:
- command usage prints successfully
- profile help text mentions `stable / native / aggressive`

- [ ] **Step 6: Commit**

```bash
git -C /root/claudex-cli add src/native-context.js src/cli.js
git -C /root/claudex-cli commit -m "feat(native): rename profiles to user-facing modes"
```

---

### Task 2: Re-map provider tuning onto Stable / Native / Aggressive

**Files:**
- Modify: `src/provider-tuning.js`
- Test: `tests/native-benchmarks/core.json`

- [ ] **Step 1: Update autotune match output in `src/provider-tuning.js`**

Keep the autotune structure, but ensure the returned `recommended_profile` expects the new mode names:

```js
return {
  tuning_version: 2,
  recommendation_source: 'benchmark-autotune',
  confidence: match.gateFailures === 0 ? 'high' : 'medium',
  recommended_profile: match.recommendedProfile,
  tuned_policy_pack: `autotuned-${providerProfile?.provider_variant || match.providerFamily}`,
  policy_pack: buildTunedPolicyPack(providerProfile),
  rationale: [
    `provider variant=${providerProfile?.provider_variant || 'unknown'}`,
    'benchmark-driven recommendation',
    ...match.rationale
  ]
};
```

This step is valid only after benchmark/autotune output is also migrated in later tasks.

- [ ] **Step 2: Replace static provider recommendations with new mode names**

Update the static rules so they map as follows:

```js
if (variant === 'anthropic-official') {
  recommended_profile: 'native'
}

if (variant === 'proxy-openai-gateway') {
  recommended_profile: 'stable'
}

if (variant === 'dashscope-openai') {
  recommended_profile: 'stable'
}

if (apiSurface === 'anthropic') {
  recommended_profile: 'native'
}

if (family === 'openai-compatible' || apiSurface === 'openai-compatible') {
  recommended_profile: 'stable'
}

// fallback
recommended_profile: 'stable'
```

- [ ] **Step 3: Rewrite rationale text to match user-facing promises**

Example target wording:

```js
rationale: [
  'provider uses openai-compatible surface',
  'protocol drift risk is higher',
  'stable mode is the safer default for predictable behavior'
]
```

and:

```js
rationale: [
  'official anthropic surface',
  'native reliability is high',
  'native mode is the best default for Claude Code-like behavior'
]
```

- [ ] **Step 4: Run the benchmark report generator to verify tuning still serializes**

Run:
```bash
cd /root/claudex-cli && npm run benchmark:native
```

Expected:
- `tests/native-benchmarks/last-report.json` is written
- no crash from unknown profile names

- [ ] **Step 5: Commit**

```bash
git -C /root/claudex-cli add src/provider-tuning.js tests/native-benchmarks/last-report.json
git -C /root/claudex-cli commit -m "feat(native): remap provider tuning to stable native aggressive"
```

---

### Task 3: Encode the three experience modes in alignment policy

**Files:**
- Modify: `src/alignment-policy.js`
- Test: `tests/native-benchmarks/core.json`

- [ ] **Step 1: Replace the existing top-level profile branches in `buildAlignmentPolicy()`**

Use this target structure:

```js
if (nativeProfile === 'stable') {
  policy.response_style_hints.push('keep-concise', 'prefer-result-first');
  policy.routing_hints.push('prefer-native-tooling', 'prefer-direct-execution', 'avoid-heavyweight-workflow-escalation');
  policy.delegation_hints.push('prefer-conservative-delegation', 'delegate-only-when-clearly-valuable');
  policy.safety_hints.push('preserve-explicit-user-intent');
} else if (nativeProfile === 'native') {
  policy.response_style_hints.push('keep-concise', 'prefer-result-first', 'minimize-meta-narration');
  policy.routing_hints.push('prefer-native-tooling', 'prefer-native-claude-code-workflows', 'escalate-workflow-only-when-task-clearly-benefits');
  policy.delegation_hints.push('use-native-agent-paths-when-task-benefits');
  policy.safety_hints.push('preserve-explicit-user-intent');
} else {
  policy.response_style_hints.push('keep-concise', 'prefer-result-first', 'minimize-meta-narration', 'act-before-explaining-when-safe');
  policy.routing_hints.push('prefer-native-tooling', 'prefer-native-claude-code-workflows', 'prefer-existing-workflow-continuation');
  policy.delegation_hints.push('use-native-agent-paths-when-task-benefits', 'favor-workflow-reuse-over-replanning');
  policy.safety_hints.push('preserve-explicit-user-intent');
}
```

- [ ] **Step 2: Re-map provider-aware branches from `balanced/native-first/cost-first` to the new names**

Key replacements:

```js
if (taskSignals.workflowSensitive && nativeProfile === 'stable') {
  policy.routing_hints.push('dynamic-stable-workflow-threshold');
}

if (taskSignals.workflowSensitive && nativeProfile === 'native' && providerProfile?.api_surface === 'anthropic') {
  policy.delegation_hints.push('dynamic-anthropic-native-delegation');
}
```

and similarly update all profile-name checks throughout the file.

- [ ] **Step 3: Add explicit continuation / exposed-capability hints for Native and Aggressive**

Within `applyTaskSignals()` or adjacent logic, add the following new hints only for the appropriate modes:

```js
if (taskSignals.sessionFollowup && nativeProfile === 'native') {
  policy.routing_hints.push('prefer-existing-workflow-continuation');
}

if (taskSignals.sessionFollowup && nativeProfile === 'aggressive') {
  policy.routing_hints.push('prefer-existing-workflow-continuation');
  policy.routing_hints.push('favor-workflow-reuse-over-replanning');
}
```

- [ ] **Step 4: Add host-capability reuse hints for Native and Aggressive**

Add policy defaults like:

```js
if (nativeProfile === 'native' || nativeProfile === 'aggressive') {
  policy.routing_hints.push('prefer-session-exposed-tools-and-skills');
}
```

- [ ] **Step 5: Run the benchmark to verify policy generation still passes**

Run:
```bash
cd /root/claudex-cli && npm run benchmark:native
```

Expected:
- benchmark completes
- report contains new hint names instead of old profile names

- [ ] **Step 6: Commit**

```bash
git -C /root/claudex-cli add src/alignment-policy.js tests/native-benchmarks/last-report.json
git -C /root/claudex-cli commit -m "feat(native): encode stable native aggressive behavior"
```

---

### Task 4: Update benchmark fixtures to reflect the new user-facing mode promises

**Files:**
- Modify: `tests/native-benchmarks/core.json`
- Test: `scripts/run-native-benchmark.js`

- [ ] **Step 1: Rename profile-sensitive expectations in `tests/native-benchmarks/core.json`**

Replace old fixture text and expected profiles so they refer to the new modes.

Example replacements:

```json
{
  "id": "stable-01",
  "category": "profile-sensitive",
  "weight": 1,
  "prompt": "如果当前模式是 stable，在复杂任务上应该怎么收敛行为？",
  "expectedSignals": ["avoid-heavyweight-workflow-escalation", "delegate-only-when-clearly-valuable"]
}
```

```json
{
  "id": "native-01",
  "category": "profile-sensitive",
  "weight": 1,
  "prompt": "如果当前模式是 native，应该怎么处理工具优先、已有 workflow 延续和接近原生体验之间的取舍？",
  "expectedSignals": ["prefer-native-tooling", "prefer-native-claude-code-workflows"]
}
```

- [ ] **Step 2: Add a new Aggressive profile fixture**

Append a case like:

```json
{
  "id": "aggressive-01",
  "category": "profile-sensitive",
  "weight": 2,
  "prompt": "如果当前模式是 aggressive，系统在 follow-up 场景里应该更偏向继续已有 workflow 还是重新规划？",
  "expectedSignals": ["prefer-existing-workflow-continuation", "favor-workflow-reuse-over-replanning"]
}
```

- [ ] **Step 3: Add capability-reuse benchmark cases**

Add a real-task case like:

```json
{
  "id": "real-session-exposed-capabilities-01",
  "scenarioType": "real-task",
  "category": "workflow-sensitive",
  "weight": 4,
  "prompt": "当前会话已经暴露了 skill、tool 和 MCP，用户只说继续完成任务。系统至少应优先表现出什么能力？",
  "expectedProfiles": ["native", "aggressive"],
  "expectedSignals": ["prefer-session-exposed-tools-and-skills", "prefer-existing-workflow-continuation"],
  "requiredCapabilities": ["session-aware-guidance", "long-horizon-session-stability"]
}
```

- [ ] **Step 4: Add output-shell / low-meta benchmark cases**

Append a response-style case like:

```json
{
  "id": "native-output-shell-01",
  "category": "response-style",
  "weight": 2,
  "prompt": "如果目标是让第三方模型更像原生 Claude Code，输出风格最应该减少什么？",
  "expectedSignals": ["minimize-meta-narration", "prefer-result-first"]
}
```

- [ ] **Step 5: Run benchmark to validate fixture compatibility**

Run:
```bash
cd /root/claudex-cli && npm run benchmark:native
```

Expected:
- benchmark completes
- new fixture IDs appear in `last-report.json`

- [ ] **Step 6: Commit**

```bash
git -C /root/claudex-cli add tests/native-benchmarks/core.json tests/native-benchmarks/last-report.json
git -C /root/claudex-cli commit -m "test(native): add benchmark fixtures for experience modes"
```

---

### Task 5: Extend replay and smoke for hello2cc-style continuation behavior

**Files:**
- Modify: `tests/native-benchmarks/replay.json`
- Modify: `tests/native-benchmarks/smoke.json`
- Test: `scripts/run-native-replay.js`
- Test: `scripts/run-native-smoke.js`

- [ ] **Step 1: Add a continuation-heavy replay case**

Append a replay case like:

```json
{
  "id": "workflow-continuation-chain-01",
  "summary": "follow-up 应优先继续已有 workflow，而不是重新 research/plan",
  "steps": [
    {
      "prompt": "先研究这个仓库的入口和 skill 暴露点",
      "expected": {
        "recentStepKind": "research",
        "context_mode": "",
        "verifyReady": false,
        "verifyObserved": false
      }
    },
    {
      "prompt": "先给我方案再做",
      "expected": {
        "recentStepKind": "plan",
        "context_mode": "",
        "verifyReady": false,
        "verifyObserved": false
      }
    },
    {
      "prompt": "继续，沿用刚才的 workflow 往下做，不要重讲",
      "expected": {
        "recentStepKind": "implement",
        "context_mode": "followup-after-plan",
        "trajectory": [],
        "verifyReady": false,
        "verifyObserved": false
      }
    }
  ]
}
```

- [ ] **Step 2: Add smoke coverage for exposed-capability reuse**

Append a smoke case like:

```json
{
  "id": "smoke-exposed-capability-reuse-01",
  "summary": "已暴露能力场景应优先复用已有工具和 workflow",
  "prompt": "当前 skill、tool、MCP 都已经在会话里暴露出来了，继续把刚才那条链路做完，不要重新发明流程。",
  "expectedSignals": [
    "prefer-existing-workflow-continuation",
    "prefer-session-exposed-tools-and-skills"
  ]
}
```

- [ ] **Step 3: Add smoke coverage for aggressive continuation**

Append a smoke case like:

```json
{
  "id": "smoke-aggressive-followup-01",
  "summary": "aggressive 模式应更偏继续已有 workflow",
  "prompt": "继续沿刚才的 workflow 做，不要重新规划，直接把剩下的收尾。",
  "previousState": {
    "last_step_kind": "implement",
    "last_task_signals": ["sessionFollowup", "workflowSensitive"],
    "last_route_decision": {"context_mode": "followup-after-plan"},
    "source_prompt_excerpt": "继续往下实现",
    "updated_at": "2026-04-12T00:00:00.000Z",
    "recent_steps": [
      {
        "step_kind": "research",
        "task_signals": ["repoResearch"],
        "route_decision": {"workflow_mode": "tool-first-research", "response_mode": "result-first"},
        "prompt_excerpt": "先研究入口",
        "updated_at": "2026-04-12T00:00:00.000Z"
      },
      {
        "step_kind": "plan",
        "task_signals": ["multiFileFeature", "workflowSensitive"],
        "route_decision": {"workflow_mode": "plan-first"},
        "prompt_excerpt": "先给方案",
        "updated_at": "2026-04-12T00:00:00.000Z"
      },
      {
        "step_kind": "implement",
        "task_signals": ["sessionFollowup"],
        "route_decision": {"context_mode": "followup-after-plan"},
        "prompt_excerpt": "继续往下实现",
        "updated_at": "2026-04-12T00:00:00.000Z"
      }
    ]
  },
  "expectedSignals": [
    "followup-after-implement",
    "优先继续执行、验证或收尾"
  ]
}
```

- [ ] **Step 4: Run replay and smoke**

Run:
```bash
cd /root/claudex-cli && npm run benchmark:native:replay && npm run benchmark:native:smoke
```

Expected:
- replay report written
- smoke report written
- all added cases pass

- [ ] **Step 5: Commit**

```bash
git -C /root/claudex-cli add tests/native-benchmarks/replay.json tests/native-benchmarks/smoke.json tests/native-benchmarks/last-replay.json tests/native-benchmarks/last-smoke.json
git -C /root/claudex-cli commit -m "test(native): cover continuation-heavy session behavior"
```

---

### Task 6: Regenerate autotune and update docs to sell the new modes

**Files:**
- Modify: `README.md`
- Modify: `README_cn.md`
- Modify: `scripts/generate-native-autotune.js`
- Test: `tests/native-benchmarks/last-autotune.json`
- Test: `tests/native-benchmarks/last-summary.md`

- [ ] **Step 1: Update autotune summary wording in `scripts/generate-native-autotune.js`**

Replace old profile-name references in rationale generation with the new mode language.

Example target wording:

```js
decisionNotes.push('native mode now covers the highest-value native-feel gaps in the current benchmark set');
decisionNotes.push('stable mode remains the safer default on compatibility-sensitive surfaces');
decisionNotes.push('aggressive mode should only be recommended when continuation-heavy peak experience clearly wins');
```

- [ ] **Step 2: Update English README mode descriptions**

In `README.md`, replace old profile intent text with user-facing mode text:

```md
- `stable` — prioritize reliability, conservative delegation, and predictable guardrails
- `native` — default; prioritize Claude Code-like workflow continuation and output feel
- `aggressive` — prioritize peak native-like experience and stronger workflow reuse, accepting more variance
```

- [ ] **Step 3: Update Chinese README mode descriptions**

In `README_cn.md`, use:

```md
- `stable` — 优先可靠性、保守 delegation 与可预期护栏
- `native` — 默认模式；优先更像 Claude Code 的 workflow continuation 与输出体感
- `aggressive` — 优先追求高峰值原生体验与更强 workflow reuse，但接受更高波动
```

- [ ] **Step 4: Add a short “Why three modes exist” section to both READMEs**

English target content:

```md
These modes are not cost tiers. They are experience promises:
- stable = predictability first
- native = default native-feel mode
- aggressive = peak experience mode for users willing to trade some stability
```

Chinese target content:

```md
这三档不是成本档，而是体验承诺：
- stable = 先稳
- native = 默认更像原生
- aggressive = 追求高峰值体验，接受一定波动
```

- [ ] **Step 5: Regenerate benchmark outputs**

Run:
```bash
cd /root/claudex-cli && npm run benchmark:native:all && npm run benchmark:native:replay
```

Expected:
- `last-summary.md` and `last-autotune.json` regenerate with the new mode names
- smoke and replay still pass

- [ ] **Step 6: Commit**

```bash
git -C /root/claudex-cli add scripts/generate-native-autotune.js README.md README_cn.md tests/native-benchmarks/last-autotune.json tests/native-benchmarks/last-summary.md tests/native-benchmarks/dashboard.html tests/native-benchmarks/last-report.json tests/native-benchmarks/last-smoke.json tests/native-benchmarks/last-replay.json
git -C /root/claudex-cli commit -m "docs(native): document stable native aggressive modes"
```

---

## Self-Review

### Spec coverage
- Stable / Native / Aggressive user-facing experience modes: covered in Tasks 1, 2, 3, 6.
- Reuse hello2cc-style continuation and exposed capability behavior: covered in Tasks 3, 4, 5.
- Preserve claudex benchmarkability and provider-aware safety: covered in Tasks 2, 3, 4, 5, 6.
- Refresh README / docs to sell the new product shape: covered in Task 6.

### Placeholder scan
- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every code-modifying step includes concrete code snippets or target text.
- Every verification step includes an exact command and expected result.

### Type consistency
- New mode names are consistently `stable`, `native`, `aggressive`.
- Existing runtime objects still use `recommended_profile`, `native_profile`, and `profile` as field names, only changing allowed values.

Plan complete and saved to `docs/superpowers/plans/2026-04-12-multi-mode-native-experience.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
