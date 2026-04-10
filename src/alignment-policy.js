function pushUnique(target, values = []) {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
}

function dedupePolicy(policy) {
  policy.response_style_hints = [...new Set(policy.response_style_hints || [])];
  policy.routing_hints = [...new Set(policy.routing_hints || [])];
  policy.delegation_hints = [...new Set(policy.delegation_hints || [])];
  policy.safety_hints = [...new Set(policy.safety_hints || [])];
  return policy;
}

function applyTaskSignals(policy, taskSignals = null, providerProfile = null, nativeProfile = 'native-first', sessionContext = null, subagentQualityGate = null, taskQualityGate = null, routeDecision = null) {
  if (!taskSignals) return;

  if (taskSignals.repoResearch) {
    policy.routing_hints.push('dynamic-repo-research-tool-first');
    policy.response_style_hints.push('dynamic-research-result-first');
  }

  if (taskSignals.boundedFix) {
    policy.routing_hints.push('dynamic-bounded-fix-direct-execution');
  }

  if (taskSignals.multiFileFeature && !taskSignals.boundedFix) {
    policy.routing_hints.push('dynamic-multi-file-plan-before-execute');
  }

  if (taskSignals.providerSensitive && providerProfile?.api_surface === 'openai-compatible') {
    policy.routing_hints.push('dynamic-openai-compatible-guardrails');
    policy.delegation_hints.push('dynamic-conservative-delegation');
  }

  if (taskSignals.workflowSensitive && nativeProfile === 'balanced') {
    policy.routing_hints.push('dynamic-balanced-workflow-threshold');
  }

  if (taskSignals.workflowSensitive && nativeProfile === 'native-first' && providerProfile?.api_surface === 'anthropic') {
    policy.delegation_hints.push('dynamic-anthropic-native-delegation');
  }

  if (taskSignals.capabilityQuestion) {
    policy.response_style_hints.push('dynamic-capability-question-result-first');
  }

  if (taskSignals.safetySensitive) {
    policy.safety_hints.push('dynamic-preserve-safety-boundary');
  }

  if (taskSignals.sessionFollowup) {
    policy.routing_hints.push('dynamic-session-reuse-context');
  }

  if (taskSignals.sessionFollowup && sessionContext?.recentStepKind === 'research') {
    policy.routing_hints.push('dynamic-followup-after-research');
  }

  if (taskSignals.sessionFollowup && sessionContext?.recentStepKind === 'plan') {
    policy.routing_hints.push('dynamic-followup-after-plan');
  }

  if (taskSignals.sessionFollowup && sessionContext?.recentStepKind === 'implement') {
    policy.routing_hints.push('dynamic-followup-after-implement');
  }

  if (sessionContext?.longHorizonSession) {
    policy.routing_hints.push('require-long-horizon-session-stability');
  }

  if (subagentQualityGate?.enabled) {
    policy.routing_hints.push('dynamic-subagent-quality-gate');
    if (subagentQualityGate.required_evidence?.includes('file_path')) {
      policy.routing_hints.push('require-subagent-file-path-evidence');
    }
    if (subagentQualityGate.required_evidence?.includes('symbol')) {
      policy.routing_hints.push('require-subagent-symbol-evidence');
    }
    if (subagentQualityGate.required_evidence?.includes('command_evidence')) {
      policy.routing_hints.push('require-subagent-command-evidence');
    }
    if (subagentQualityGate.evidence_richness) {
      policy.routing_hints.push('require-subagent-evidence-richness');
    }
    if (subagentQualityGate.conflict_resolution) {
      policy.routing_hints.push('require-subagent-conflict-resolution');
    }
    if (subagentQualityGate.prefer_local_reverification) {
      policy.routing_hints.push('prefer-local-reverification-after-subagent-conflict');
    }
  }

  if (routeDecision?.provider_drift_mode) {
    policy.routing_hints.push('require-provider-midrun-drift-handling');
    if (routeDecision.provider_drift_mode === 'local-fallback') {
      policy.routing_hints.push('prefer-local-fallback-after-provider-drift');
    }
  }

  if (taskQualityGate?.enabled) {
    policy.routing_hints.push('dynamic-task-quality-gate');
    if (taskQualityGate.subject_rules?.includes('specific_action') || taskQualityGate.subject_rules?.includes('clear_object')) {
      policy.routing_hints.push('require-task-specific-subject');
    }
    if (taskQualityGate.description_rules?.includes('deliverable_required')) {
      policy.routing_hints.push('require-task-deliverable-description');
    }
    if (taskQualityGate.description_rules?.includes('verification_evidence_required')) {
      policy.routing_hints.push('require-task-verification-evidence');
    }
  }
}

export function buildAlignmentPolicy({ nativeProfile = 'native-first', providerProfile = null, policyPack = null, taskSignals = null, sessionContext = null, subagentQualityGate = null, taskQualityGate = null, routeDecision = null } = {}) {
  const policy = {
    policy_version: 1,
    response_style_hints: [],
    routing_hints: [],
    delegation_hints: [],
    safety_hints: []
  };

  if (nativeProfile === 'cost-first') {
    policy.response_style_hints.push('keep-concise', 'avoid-verbose-meta', 'prefer-result-first');
    policy.routing_hints.push('prefer-native-tooling', 'prefer-direct-execution', 'avoid-heavyweight-workflow-escalation');
    policy.delegation_hints.push('delegate-only-when-clearly-valuable');
    policy.safety_hints.push('preserve-explicit-user-intent');
  } else if (nativeProfile === 'balanced') {
    policy.response_style_hints.push('keep-concise', 'prefer-result-first');
    policy.routing_hints.push('prefer-native-tooling', 'escalate-workflow-only-when-task-clearly-benefits', 'avoid-heavyweight-workflow-escalation');
    policy.delegation_hints.push('prefer-conservative-delegation');
    policy.safety_hints.push('preserve-explicit-user-intent');
  } else {
    policy.response_style_hints.push('keep-concise', 'prefer-result-first', 'minimize-meta-narration');
    policy.routing_hints.push('prefer-native-tooling', 'prefer-native-claude-code-workflows');
    policy.delegation_hints.push('use-native-agent-paths-when-task-benefits');
    policy.safety_hints.push('preserve-explicit-user-intent');
  }

  if (providerProfile?.api_surface === 'openai-compatible') {
    policy.routing_hints.push('use-structured-context-to-reduce-protocol-drift');
    policy.delegation_hints.push('be-conservative-with-complex-agent-orchestration');
    policy.safety_hints.push('avoid-assuming-perfect-native-tool-contract');
    policy.routing_hints.push('require-provider-fallback-finesse');
    if (nativeProfile === 'balanced') {
      policy.routing_hints.push('balanced-default-for-openai-compatible');
    }
  }

  if (providerProfile?.provider_variant === 'proxy-openai-gateway') {
    policy.routing_hints.push('proxy-layer-requires-extra-routing-guardrails');
    policy.delegation_hints.push('prefer-conservative-delegation-on-proxy');
    policy.safety_hints.push('proxy-layer-prefers-stable-workflow-over-aggressive-native-parity');
    if (nativeProfile === 'balanced') {
      policy.routing_hints.push('proxy-balanced-default-bias');
    }
  }

  if (providerProfile?.provider_variant === 'dashscope-openai') {
    policy.safety_hints.push('dashscope-compatible-tooling-needs-guardrails');
    policy.routing_hints.push('dashscope-prefers-guarded-tool-contract');
    if (nativeProfile === 'balanced') {
      policy.routing_hints.push('dashscope-balanced-default-bias');
    }
  }

  if (providerProfile?.provider_variant === 'anthropic-official' && nativeProfile === 'native-first') {
    policy.routing_hints.push('official-anthropic-native-workflow-advantage');
    policy.routing_hints.push('official-anthropic-supports-strong-native-tooling');
    policy.delegation_hints.push('official-anthropic-allows-confident-native-delegation');
  }

  if (providerProfile?.api_surface === 'anthropic') {
    policy.routing_hints.push('closer-to-native-routing-is-safe');
    if (nativeProfile === 'balanced') {
      policy.routing_hints.push('balanced-still-tool-first-on-anthropic');
    }
    if (nativeProfile === 'native-first') {
      policy.routing_hints.push('anthropic-native-first-advantage');
      policy.routing_hints.push('anthropic-prefers-native-tooling');
      policy.routing_hints.push('anthropic-prefers-native-workflows');
      policy.delegation_hints.push('native-first-is-safe-for-anthropic-surface');
      policy.delegation_hints.push('anthropic-allows-stronger-native-delegation');
      policy.response_style_hints.push('anthropic-native-first-result-bias');
    }
  }

  if (providerProfile?.native_reliability === 'high') {
    policy.routing_hints.push('closer-to-native-routing-is-safe');
    if (nativeProfile === 'native-first') {
      policy.routing_hints.push('high-reliability-prefers-native-first');
      policy.routing_hints.push('high-reliability-allows-native-workflow-escalation');
    }
  }

  if (providerProfile?.verbosity_bias === 'medium') {
    policy.response_style_hints.push('actively-compress-output');
  }

  applyTaskSignals(policy, taskSignals, providerProfile, nativeProfile, sessionContext, subagentQualityGate, taskQualityGate, routeDecision);

  pushUnique(policy.routing_hints, policyPack?.routing_defaults || []);
  pushUnique(policy.delegation_hints, policyPack?.delegation_defaults || []);
  pushUnique(policy.safety_hints, policyPack?.safety_defaults || []);

  return dedupePolicy(policy);
}
