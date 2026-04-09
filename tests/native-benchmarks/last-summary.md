# Native Benchmark Summary

- Generated: 2026-04-09T05:33:25.589Z
- Source: /root/claudex-cli/tests/native-benchmarks/last-report.json

## benchmark-openai-compat

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 13
- cost-first: 4
- native-first: 2

### Top missing signals
- none

### Signal source contribution
- from policy pack: 24
- from base policy: 57

### Scenario recommendations
- capability-question-01 [capability-question, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- repo-research-01 [repo-research, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- bounded-implementation-01 [bounded-implementation, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- workflow-sensitive-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0)
- tool-choice-01 [tool-choice-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- result-style-01 [response-style, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- cost-first-01 [profile-sensitive, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- balanced-01 [profile-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- protocol-drift-01 [provider-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=2, base_hits=0)
- safety-intent-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- openai-balanced-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0)
- repo-research-02 [repo-research, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- small-fix-01 [implementation-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- multi-file-feature-01 [workflow-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- openai-compatible-native-first-risk-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=3, base_hits=0)
- delegation-balance-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- verbosity-openai-01 [response-style, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-boundary-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- workflow-escalation-cost-01 [profile-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)

## benchmark-proxy-gateway

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 15
- cost-first: 4
- native-first: 2

### Top missing signals
- none

### Signal source contribution
- from policy pack: 12
- from base policy: 81

### Scenario recommendations
- capability-question-01 [capability-question, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- repo-research-01 [repo-research, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- bounded-implementation-01 [bounded-implementation, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- workflow-sensitive-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- tool-choice-01 [tool-choice-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- result-style-01 [response-style, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- cost-first-01 [profile-sensitive, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- balanced-01 [profile-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- protocol-drift-01 [provider-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-intent-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- openai-balanced-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- repo-research-02 [repo-research, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- small-fix-01 [implementation-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- multi-file-feature-01 [workflow-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- provider-proxy-gateway-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0)
- provider-proxy-gateway-02 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0)
- openai-compatible-native-first-risk-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=3)
- delegation-balance-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- verbosity-openai-01 [response-style, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-boundary-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- workflow-escalation-cost-01 [profile-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)

## benchmark-dashscope-openai

- Provider family: openai-compatible
- API surface: openai-compatible
- Native reliability: medium
- Workflow bias: adapter-dependent

### Recommended profile frequency
- balanced: 15
- cost-first: 4
- native-first: 2

### Top missing signals
- none

### Signal source contribution
- from policy pack: 12
- from base policy: 80

### Scenario recommendations
- capability-question-01 [capability-question, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- repo-research-01 [repo-research, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- bounded-implementation-01 [bounded-implementation, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- workflow-sensitive-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- tool-choice-01 [tool-choice-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- result-style-01 [response-style, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- cost-first-01 [profile-sensitive, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- balanced-01 [profile-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- protocol-drift-01 [provider-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-intent-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- openai-balanced-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- repo-research-02 [repo-research, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- small-fix-01 [implementation-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- multi-file-feature-01 [workflow-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- provider-dashscope-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=1, base_hits=0)
- provider-dashscope-02 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0)
- openai-compatible-native-first-risk-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=3)
- delegation-balance-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0)
- verbosity-openai-01 [response-style, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-boundary-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- workflow-escalation-cost-01 [profile-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)

## benchmark-anthropic

- Provider family: anthropic
- API surface: anthropic
- Native reliability: high
- Workflow bias: native-like

### Recommended profile frequency
- balanced: 10
- native-first: 7
- cost-first: 4

### Top missing signals
- none

### Signal source contribution
- from policy pack: 15
- from base policy: 58

### Scenario recommendations
- capability-question-01 [capability-question, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- repo-research-01 [repo-research, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- bounded-implementation-01 [bounded-implementation, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=1)
- tool-choice-01 [tool-choice-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- result-style-01 [response-style, w=1]: native-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- native-first-routing-01 [routing-sensitive, w=2]: native-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- cost-first-01 [profile-sensitive, w=1]: cost-first (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- balanced-01 [profile-sensitive, w=1]: balanced (score=1, weighted=1, gate=true, pack_hits=0, base_hits=2)
- native-reliability-high-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=0, base_hits=1)
- safety-intent-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0)
- anthropic-native-01 [provider-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- repo-research-02 [repo-research, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- small-fix-01 [implementation-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- multi-file-feature-01 [workflow-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- provider-anthropic-official-01 [provider-sensitive, w=3]: balanced (score=1, weighted=3, gate=true, pack_hits=2, base_hits=0)
- provider-anthropic-official-02 [provider-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=1, base_hits=1)
- anthropic-native-first-advantage-01 [provider-sensitive, w=3]: native-first (score=1, weighted=3, gate=true, pack_hits=0, base_hits=2)
- delegation-balance-01 [workflow-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=0, base_hits=1)
- delegation-native-first-01 [workflow-sensitive, w=2]: native-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)
- safety-boundary-01 [safety-sensitive, w=2]: balanced (score=1, weighted=2, gate=true, pack_hits=1, base_hits=0)
- workflow-escalation-cost-01 [profile-sensitive, w=2]: cost-first (score=1, weighted=2, gate=true, pack_hits=0, base_hits=2)

