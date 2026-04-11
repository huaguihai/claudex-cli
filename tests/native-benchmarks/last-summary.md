# Native Benchmark Summary

- Generated: 2026-04-10T17:03:51.561Z
- Source: /root/claudex-cli/tests/native-benchmarks/last-report.json

## benchmark-openai-compat

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 36
- cost-first: 4
- native-first: 2

### Real-task pass rate
- passed: 23/23
- weighted: 81/81

### Top missing signals
- none

### Signal source contribution
- from policy pack: 24
- from base policy: 264

### Scenario recommendations
- capability-question-01 [capability-question, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-01 [repo-research, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- bounded-implementation-01 [bounded-implementation, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-sensitive-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0, missing_caps=0)
- tool-choice-01 [tool-choice-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- result-style-01 [response-style, type=signal, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- cost-first-01 [profile-sensitive, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- balanced-01 [profile-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- protocol-drift-01 [provider-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- safety-intent-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- openai-balanced-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- repo-research-02 [repo-research, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- small-fix-01 [implementation-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- multi-file-feature-01 [workflow-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- openai-compatible-native-first-risk-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=3, base_hits=0, missing_caps=0)
- delegation-balance-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- verbosity-openai-01 [response-style, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-boundary-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-escalation-cost-01 [profile-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-repo-research-runtime-01 [repo-research, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-boundary-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-multifile-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-provider-guardrails-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-session-reuse-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-capability-question-01 [capability-question, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-dynamic-routing-safety-01 [safety-sensitive, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-session-followup-research-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-plan-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-implement-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-subagent-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-task-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-session-long-horizon-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-verify-closeout-transition-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-verify-failure-reentry-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-provider-fallback-finesse-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-evidence-richness-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=5, missing_caps=0)
- real-subagent-evidence-conflict-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=6, missing_caps=0)
- real-subagent-stale-evidence-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-partial-contradiction-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-subagent-local-reverify-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-drift-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-local-fallback-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)

## benchmark-proxy-gateway

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 39
- cost-first: 4
- native-first: 2

### Real-task pass rate
- passed: 24/24
- weighted: 84/84

### Top missing signals
- none

### Signal source contribution
- from policy pack: 18
- from base policy: 288

### Scenario recommendations
- capability-question-01 [capability-question, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-01 [repo-research, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- bounded-implementation-01 [bounded-implementation, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-sensitive-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- tool-choice-01 [tool-choice-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- result-style-01 [response-style, type=signal, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- cost-first-01 [profile-sensitive, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- balanced-01 [profile-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- protocol-drift-01 [provider-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-intent-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- openai-balanced-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-02 [repo-research, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- small-fix-01 [implementation-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- multi-file-feature-01 [workflow-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- provider-proxy-gateway-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- provider-proxy-gateway-02 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- openai-compatible-native-first-risk-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- delegation-balance-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- verbosity-openai-01 [response-style, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-boundary-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-escalation-cost-01 [profile-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-repo-research-runtime-01 [repo-research, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-provider-proxy-guardrails-01 [provider-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- real-dynamic-routing-boundary-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-multifile-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-provider-guardrails-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-session-reuse-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-capability-question-01 [capability-question, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-dynamic-routing-safety-01 [safety-sensitive, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-session-followup-research-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-plan-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-implement-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-subagent-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-task-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-session-long-horizon-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-verify-closeout-transition-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-verify-failure-reentry-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-provider-fallback-finesse-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-evidence-richness-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=5, missing_caps=0)
- real-subagent-evidence-conflict-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=6, missing_caps=0)
- real-subagent-stale-evidence-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-partial-contradiction-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-subagent-local-reverify-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-drift-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-local-fallback-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)

## benchmark-dashscope-openai

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 39
- cost-first: 4
- native-first: 2

### Real-task pass rate
- passed: 24/24
- weighted: 84/84

### Top missing signals
- none

### Signal source contribution
- from policy pack: 18
- from base policy: 287

### Scenario recommendations
- capability-question-01 [capability-question, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-01 [repo-research, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- bounded-implementation-01 [bounded-implementation, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-sensitive-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- tool-choice-01 [tool-choice-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- result-style-01 [response-style, type=signal, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- cost-first-01 [profile-sensitive, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- balanced-01 [profile-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- protocol-drift-01 [provider-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-intent-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- openai-balanced-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-02 [repo-research, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- small-fix-01 [implementation-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- multi-file-feature-01 [workflow-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- provider-dashscope-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=1, base_hits=0, missing_caps=0)
- provider-dashscope-02 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- openai-compatible-native-first-risk-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- delegation-balance-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0, missing_caps=0)
- verbosity-openai-01 [response-style, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-boundary-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- workflow-escalation-cost-01 [profile-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-repo-research-runtime-01 [repo-research, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dashscope-guarded-tools-01 [provider-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- real-dynamic-routing-boundary-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-multifile-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-provider-guardrails-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-session-reuse-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-capability-question-01 [capability-question, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-dynamic-routing-safety-01 [safety-sensitive, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-session-followup-research-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-plan-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-implement-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-subagent-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-task-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-session-long-horizon-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-verify-closeout-transition-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-verify-failure-reentry-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-provider-fallback-finesse-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-evidence-richness-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=5, missing_caps=0)
- real-subagent-evidence-conflict-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=6, missing_caps=0)
- real-subagent-stale-evidence-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-partial-contradiction-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-subagent-local-reverify-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-drift-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-provider-midrun-local-fallback-01 [provider-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)

## benchmark-anthropic

- Provider family: anthropic
- API surface: anthropic
- Native reliability: high
- Workflow bias: native-like

### Recommended profile frequency
- balanced: 29
- native-first: 9
- cost-first: 4

### Real-task pass rate
- passed: 21/21
- weighted: 72/72

### Top missing signals
- none

### Signal source contribution
- from policy pack: 15
- from base policy: 229

### Scenario recommendations
- capability-question-01 [capability-question, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-01 [repo-research, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- bounded-implementation-01 [bounded-implementation, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- tool-choice-01 [tool-choice-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- result-style-01 [response-style, type=signal, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- native-first-routing-01 [routing-sensitive, type=signal, w=2]: native-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- cost-first-01 [profile-sensitive, type=signal, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- balanced-01 [profile-sensitive, type=signal, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- native-reliability-high-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- safety-intent-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0, missing_caps=0)
- anthropic-native-01 [provider-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- repo-research-02 [repo-research, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- small-fix-01 [implementation-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- multi-file-feature-01 [workflow-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- provider-anthropic-official-01 [provider-sensitive, type=signal, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0, missing_caps=0)
- provider-anthropic-official-02 [provider-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=1, base_hits=1, missing_caps=0)
- anthropic-native-first-advantage-01 [provider-sensitive, type=signal, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- delegation-balance-01 [workflow-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- delegation-native-first-01 [workflow-sensitive, type=signal, w=2]: native-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- safety-boundary-01 [safety-sensitive, type=signal, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0, missing_caps=0)
- workflow-escalation-cost-01 [profile-sensitive, type=signal, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-repo-research-runtime-01 [repo-research, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-anthropic-native-flow-01 [provider-sensitive, type=real-task, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-boundary-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-multifile-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-session-reuse-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-dynamic-routing-anthropic-01 [provider-sensitive, type=real-task, w=4]: native-first (score=1, weighted=4, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-dynamic-routing-capability-question-01 [capability-question, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-dynamic-routing-safety-01 [safety-sensitive, type=real-task, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1, missing_caps=0)
- real-session-followup-research-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-plan-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-session-followup-implement-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2, missing_caps=0)
- real-subagent-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-task-quality-01 [workflow-sensitive, type=real-task, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-session-long-horizon-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-verify-closeout-transition-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-verify-failure-reentry-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-evidence-richness-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=5, missing_caps=0)
- real-subagent-evidence-conflict-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=6, missing_caps=0)
- real-subagent-stale-evidence-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=3, missing_caps=0)
- real-subagent-partial-contradiction-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)
- real-subagent-local-reverify-01 [workflow-sensitive, type=real-task, w=4]: balanced (score=1, weighted=4, gate=true, pack_hits=0, base_hits=4, missing_caps=0)

