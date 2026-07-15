# Reliability and Architecture Hardening Spec

## Status

- Scope: first reliability hardening pass for `claudex` and `codexx`
- Priority: restore correctness before structural refactoring
- Compatibility: no intentional CLI command or config-format changes
- Implementation: Phase 1 completed on 2026-07-15

## Problem statement

The project has useful module boundaries on the Codex side, but several user
flows still share hidden state or incomplete contracts:

- Codex provider switching writes `config.toml`, `auth.json`, and `.env`, while
  restore and drift handling do not consistently treat all three as one state.
- `codexx test` accepts any HTTP response below 500, including authentication
  and endpoint errors.
- Claude interactive commands share a global readline instance that is not
  closed, and callback-thrown back signals escape the promise chain.
- Claude provider names are accepted more broadly than the list/read paths can
  discover.
- Stats implementation and tests disagree on their data contract.
- Native benchmark reports can contain failed gates while the command exits 0.

These failures are more urgent than a broad module reorganisation because they
can produce false success, stuck commands, or mismatched provider credentials.

## Goals

1. Make provider restore deterministic across all persisted Codex state.
2. Make connectivity checks report only usable HTTP responses as success.
3. Make Claude add/edit/cancel flows terminate cleanly in TTY and non-TTY use.
4. Enforce one provider-name rule at the write boundary.
5. Restore a green and meaningful automated test baseline.
6. Make a failed Native benchmark gate fail the benchmark command.
7. Reduce coupling only where the fixes expose a shared root cause.

## Non-goals

- No dependency-injection framework, command framework, or new runtime
  dependency.
- No full rewrite of the 2,000+ line Claude CLI in this pass.
- No provider schema migration beyond rejecting newly entered invalid names.
- No change to Native routing or tuning policy.
- No redesign of terminal output.

## Required changes

### R1 — Codex backup restore is a three-file restore

`restoreBackup()` must restore `config.toml`, `auth.json`, and `.env` from the
selected backup. If a file did not exist in the backup but exists in the
current state, restore must remove it.

Acceptance:

- After `use A -> use B -> restore latest`, all three files match the state
  captured before switching to B.
- The restore result reports the `.env` action.

### R2 — Connectivity success means HTTP 2xx

`codexx test` and the post-add probe must return success only for status codes
from 200 through 299. Error responses must retain a short response-body reason.

Acceptance:

- 200/204 are successful.
- 401/403/404/429/500 are failures and return exit code 1.
- Existing timeout and network-error handling remains intact.

### R3 — Claude interaction lifecycle is command-scoped

Direct interactive commands must release readline resources before returning.
Entering `b` or `back` must follow the existing `BackSignal` path rather than
throwing outside the promise chain. Non-interactive add with missing fields
must return an actionable validation error instead of dereferencing `null`.

Acceptance:

- A fully flagged `claudex add` exits normally in a TTY.
- `b` from add/edit returns without an uncaught exception.
- Partial non-TTY add reports missing required fields.

### R4 — Provider names have one write-boundary rule

New Claude provider names must match `[A-Za-z0-9_-]+`, which is the same rule
used by provider discovery.

Acceptance:

- Valid existing names still work.
- Names containing whitespace, separators, or dots are rejected before file IO.

### R5 — Stats has one report contract

The supported model representation is `{ name, tokens }[]`, matching the
current renderer and model-breakdown implementation. The seven-day window is
inclusive of today and the previous six days. Tests must describe those
semantics.

Acceptance:

- All Stats tests pass.
- Render tests use the supported model shape and current output labels.

### R6 — Benchmark gates affect process status

The Native benchmark runner must exit non-zero when any real-task gate fails.
It must still write the report before failing so the failure is inspectable.

Acceptance:

- A clean fixture exits 0.
- A fixture with a failed real-task gate writes its report and exits 1.

## Architecture constraints

- Validation belongs at write boundaries, not duplicated in every caller.
- Restore, drift, and diagnostics should eventually share the same three-file
  state definition. This pass fixes restore; drift/doctor unification remains
  Phase 2 unless required by a regression test.
- Prefer existing `src/shared` utilities over new helpers.
- Each non-trivial fix must leave one focused regression test.

## Delivery phases

### Phase 1 — correctness gate

- Implement R1-R6.
- Run the complete unit suite.
- Run Native smoke/replay and the benchmark gate check.

### Phase 2 — coupling reduction

- Move Claude provider validation and persistence out of `src/cli.js` only when
  another provider change is required.
- Treat config/auth/env hashes as one shared Codex state in switch, reconcile,
  status, and doctor.
- Add one temporary-HOME CLI integration test per binary.

### Phase 3 — release hygiene

- Replace the current help-only lint script with a real syntax check.
- Add a minimal CI job for tests, syntax checks, package contents, and benchmark
  gates.
- Move generated benchmark artifacts to `.tmp/` unless they are intentional
  release snapshots.

## Release criteria

- `npm test` exits 0.
- `npm run benchmark:native:smoke` exits 0.
- `npm run benchmark:native:replay` exits 0.
- The benchmark runner exits non-zero for a known failed gate.
- TTY add/cancel smoke checks exit without hanging or uncaught exceptions.
- No existing user-authored files outside managed markers are modified.

## UX pass — high-frequency command paths

The next product pass targets discoverability and predictable command flows,
without changing the storage format or adding a command framework.

### UX-1 — Discoverable help

- `claudex --help` lists `stats` and the common provider workflow.
- `claudex stats --help` prints usage without reading local transcripts.
- Invalid `--since` input is an error, not a silent fallback to another date.

### UX-2 — Consistent add handoff

- `claudex add` prints the next `test` and `use` commands.
- Interactive add may run the connectivity test immediately; non-interactive
  add never waits for input.
- `--current` remains the explicit non-interactive way to activate a provider.

### UX-3 — Script-safe drift prompts

- A non-TTY `codexx use` with detected drift fails with an actionable message
  instead of opening a prompt that cannot be answered.

Acceptance:

- Help commands exit 0 without network or transcript IO.
- Invalid dates exit non-zero with the offending value.
- A non-interactive drifted switch exits non-zero and mentions `--force` or
  `reconcile`.
