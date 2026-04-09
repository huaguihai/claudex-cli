# Product Plan

## Target user

Users who want Claude Code to remain simple at the command line, but need a stable way to switch third-party providers and make those providers behave closer to native Claude Code workflows.

## Product direction

Claudex has moved beyond a provider switcher. The longer-term direction is a third-party model runtime manager for Claude Code, with `native` as the alignment subsystem.

That means the product is responsible for two things at the same time:

1. Provider lifecycle management
2. Runtime behavior alignment toward a more native Claude Code experience

## Core journey

1. Install CLI
2. Run `claudex init`
3. Add provider through prompts (`claudex provider add`)
4. Test provider (`claudex provider test <name>`)
5. Switch provider (`claudex provider use <name>`)
6. Enable Native mode (`claudex native on`)
7. Choose profile (`claudex native profile <name>`)
8. Launch Claude (`claudex` / `claudex --continue`)

## Current product surface

### Provider management

- Provider CRUD
- Persistent current provider
- Claude launch wrapper with env sanitization
- Basic diagnostics and provider testing
- Backup before modifying files

### Native runtime system

- Persistent Native mode state
- Command entry + menu entry
- Structured runtime context injection
- Provider behavior profile inference
- Alignment policy generation
- Provider-aware tuning and autotune support
- De-duplicated policy output for clearer `native doctor` diagnostics

### Evaluation system

- Native benchmark runner
- Markdown benchmark summary
- Autotune recommendation output
- HTML dashboard output
- Provider/profile-sensitive scenarios that can distinguish anthropic/native-first from openai-compatible/balanced defaults

## Phase roadmap

### Phase 0 — Product shell

- Provider switching works
- Native mode is persistent
- Menu and command entry both exist
- Doctor/status can see Native state

### Phase 1 — Native Context v1

- Structured runtime context replaces a single lightweight hint
- Explicit user prompt flags always keep higher priority

### Phase 2 — Provider Behavior Profile

- Provider differences become explicit inputs to the runtime layer
- Different API surfaces can produce different Native behavior

### Phase 3 — Alignment Policy Core

- Routing / delegation / response-style hints become explicit policy output
- Native profiles stop being only labels and begin affecting behavior

### Phase 4 — Evaluation Harness

- Native changes can be benchmarked and compared
- Provider/profile regressions become visible

### Phase 5 — Experience maximization

- Focus only on high-frequency task quality
- Improve the scenarios that most affect “native feel”
- Current focus: benchmark and policy thickness, not new product surfaces

### Phase 6 — Multi-provider optimization

- Different provider families can get different tuned defaults

### Phase 7 — Native auto-tuning

- Benchmark output can recommend better profiles automatically
- Current stable outcome: anthropic/high-reliability providers trend toward `native-first`; openai-compatible families trend toward `balanced`

### Phase 8 — Control plane

- Reports and comparisons become easier to inspect and operate

### Phase 9 — Platform maturity

- New providers, new scenarios, and new tuning strategies can be added without turning the system into a hook-heavy maintenance burden

## Key risks

- Provider protocol edge cases and adapter drift
- Overfitting to prompt tweaks instead of building a stable runtime layer
- Adding complexity faster than measurable quality gains

## Mitigation

- Keep provider/runtime/policy/evaluation layers separated
- Use benchmark outputs to justify policy changes
- Prefer small, explicit, testable hints over sprawling rule stacks
- Keep the user mental model simple even if provider-specific optimization grows internally

## Related docs

- `docs/native-roadmap.md`
- `tests/native-benchmarks/`
