function pushUnique(target, values = []) {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value);
  }
}

function addWorkflowReuseHints(policy) {
  pushUnique(policy.routing_hints, ['prefer-existing-workflow-continuation']);
  pushUnique(policy.delegation_hints, ['favor-workflow-reuse-over-replanning']);
}

function addSharedDefaults(policy) {
  pushUnique(policy.response_style_hints, ['keep-concise', 'prefer-result-first']);
  pushUnique(policy.routing_hints, ['prefer-native-tooling']);
  pushUnique(policy.safety_hints, ['preserve-explicit-user-intent']);
}

function normalizeNativeProfile(nativeProfile = 'native') {
  if (nativeProfile === 'balanced') return 'stable';
  if (nativeProfile === 'native-first') return 'native';
  if (nativeProfile === 'cost-first') return 'stable';
  return nativeProfile;
}

function dedupePolicy(policy) {
  policy.response_style_hints = [...new Set(policy.response_style_hints || [])];
  policy.routing_hints = [...new Set(policy.routing_hints || [])];
  policy.delegation_hints = [...new Set(policy.delegation_hints || [])];
  policy.safety_hints = [...new Set(policy.safety_hints || [])];
  return policy;
}

function applyTaskSignals(policy, taskSignals = null, providerProfile = null, nativeProfile = 'native', sessionContext = null, subagentQualityGate = null, taskQualityGate = null, routeDecision = null) {
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

  if (taskSignals.workflowSensitive && nativeProfile === 'stable') {
    policy.routing_hints.push('dynamic-stable-workflow-threshold');
  }

  if (taskSignals.workflowSensitive && nativeProfile === 'native' && providerProfile?.api_surface === 'anthropic') {
    policy.delegation_hints.push('dynamic-anthropic-native-delegation');
  }

  if (taskSignals.workflowSensitive && nativeProfile === 'aggressive') {
    policy.routing_hints.push('dynamic-aggressive-workflow-escalation');
    policy.delegation_hints.push('dynamic-aggressive-delegation-bias');
  }

  if (taskSignals.capabilityQuestion) {
    policy.response_style_hints.push('dynamic-capability-question-result-first');
    if (nativeProfile === 'native' || nativeProfile === 'aggressive') {
      policy.routing_hints.push('prefer-session-exposed-tools-and-skills');
    }
  }

  if (taskSignals.safetySensitive) {
    policy.safety_hints.push('dynamic-preserve-safety-boundary');
  }

  if (taskSignals.sessionFollowup) {
    policy.routing_hints.push('dynamic-session-reuse-context');
    if (nativeProfile === 'native' || nativeProfile === 'aggressive') {
      addWorkflowReuseHints(policy);
    }
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

  if (taskSignals.sessionFollowup && sessionContext?.recentStepKind === 'verify') {
    policy.routing_hints.push('dynamic-followup-after-verify');
  }

  if (sessionContext?.longHorizonSession) {
    policy.routing_hints.push('require-long-horizon-session-stability');
    if (nativeProfile === 'native' || nativeProfile === 'aggressive') {
      addWorkflowReuseHints(policy);
    }
    if (sessionContext?.verifyReady) {
      policy.routing_hints.push('require-verify-closeout-transition');
    }
    if (sessionContext?.verifyObserved) {
      policy.routing_hints.push('require-verify-reentry-handling');
    }
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

export function buildAlignmentPolicy({ nativeProfile = 'native', providerProfile = null, policyPack = null, taskSignals = null, sessionContext = null, subagentQualityGate = null, taskQualityGate = null, routeDecision = null } = {}) {
  const normalizedProfile = normalizeNativeProfile(nativeProfile);
  const policy = {
    policy_version: 1,
    response_style_hints: [],
    routing_hints: [],
    delegation_hints: [],
    safety_hints: []
  };

  addSharedDefaults(policy);

  if (normalizedProfile === 'stable') {
    pushUnique(policy.response_style_hints, ['avoid-verbose-meta']);
    pushUnique(policy.routing_hints, [
      'prefer-direct-execution',
      'escalate-workflow-only-when-task-clearly-benefits',
      'avoid-heavyweight-workflow-escalation'
    ]);
    pushUnique(policy.delegation_hints, ['prefer-conservative-delegation', 'delegate-only-when-clearly-valuable']);
  } else if (normalizedProfile === 'aggressive') {
    pushUnique(policy.response_style_hints, ['minimize-meta-narration', 'act-before-explaining-when-safe']);
    pushUnique(policy.routing_hints, [
      'prefer-native-claude-code-workflows',
      'favor-peak-native-workflow-experience',
      'prefer-session-exposed-tools-and-skills'
    ]);
    pushUnique(policy.delegation_hints, [
      'use-native-agent-paths-when-task-benefits'
    ]);
    addWorkflowReuseHints(policy);
  } else {
    pushUnique(policy.response_style_hints, ['minimize-meta-narration']);
    pushUnique(policy.routing_hints, [
      'prefer-native-claude-code-workflows',
      'prefer-session-exposed-tools-and-skills',
      'escalate-workflow-only-when-task-clearly-benefits'
    ]);
    pushUnique(policy.delegation_hints, ['use-native-agent-paths-when-task-benefits']);
  }

  if (providerProfile?.api_surface === 'openai-compatible') {
    policy.routing_hints.push('use-structured-context-to-reduce-protocol-drift');
    policy.delegation_hints.push('be-conservative-with-complex-agent-orchestration');
    policy.safety_hints.push('avoid-assuming-perfect-native-tool-contract');
    policy.routing_hints.push('require-provider-fallback-finesse');
    if (normalizedProfile === 'stable') {
      policy.routing_hints.push('stable-default-for-openai-compatible');
    }
  }

  if (providerProfile?.provider_variant === 'proxy-openai-gateway') {
    policy.routing_hints.push('proxy-layer-requires-extra-routing-guardrails');
    policy.delegation_hints.push('prefer-conservative-delegation-on-proxy');
    policy.safety_hints.push('proxy-layer-prefers-stable-workflow-over-aggressive-native-parity');
    if (normalizedProfile === 'stable') {
      policy.routing_hints.push('proxy-stable-default-bias');
    }
  }

  if (providerProfile?.provider_variant === 'dashscope-openai') {
    policy.safety_hints.push('dashscope-compatible-tooling-needs-guardrails');
    policy.routing_hints.push('dashscope-prefers-guarded-tool-contract');
    if (normalizedProfile === 'stable') {
      policy.routing_hints.push('dashscope-stable-default-bias');
    }
  }

  if (providerProfile?.provider_variant === 'anthropic-official' && normalizedProfile === 'native') {
    policy.routing_hints.push('official-anthropic-native-workflow-advantage');
    policy.routing_hints.push('official-anthropic-supports-strong-native-tooling');
    policy.delegation_hints.push('official-anthropic-allows-confident-native-delegation');
  }

  if (providerProfile?.provider_variant === 'anthropic-official' && normalizedProfile === 'aggressive') {
    policy.routing_hints.push('official-anthropic-supports-peak-native-experience');
    policy.delegation_hints.push('official-anthropic-allows-peak-native-delegation');
  }

  if (providerProfile?.api_surface === 'anthropic') {
    policy.routing_hints.push('closer-to-native-routing-is-safe');
    if (normalizedProfile === 'stable') {
      policy.routing_hints.push('stable-still-tool-first-on-anthropic');
    }
    if (normalizedProfile === 'native') {
      policy.routing_hints.push('anthropic-native-advantage');
      policy.routing_hints.push('anthropic-prefers-native-tooling');
      policy.routing_hints.push('anthropic-prefers-native-workflows');
      policy.delegation_hints.push('native-is-safe-for-anthropic-surface');
      policy.delegation_hints.push('anthropic-allows-stronger-native-delegation');
      policy.response_style_hints.push('anthropic-native-result-bias');
    }
    if (normalizedProfile === 'aggressive') {
      policy.routing_hints.push('anthropic-peak-native-workflow-advantage');
      policy.routing_hints.push('anthropic-prefers-native-workflow-escalation');
      policy.delegation_hints.push('anthropic-allows-aggressive-native-delegation');
      policy.response_style_hints.push('anthropic-peak-result-bias');
    }
  }

  if (providerProfile?.native_reliability === 'high') {
    policy.routing_hints.push('closer-to-native-routing-is-safe');
    if (normalizedProfile === 'native') {
      policy.routing_hints.push('high-reliability-prefers-native');
      policy.routing_hints.push('high-reliability-allows-native-workflow-escalation');
    }
    if (normalizedProfile === 'aggressive') {
      policy.routing_hints.push('high-reliability-supports-aggressive-native-escalation');
    }
  }

  if (providerProfile?.verbosity_bias === 'medium') {
    policy.response_style_hints.push('actively-compress-output');
  }

  applyTaskSignals(policy, taskSignals, providerProfile, normalizedProfile, sessionContext, subagentQualityGate, taskQualityGate, routeDecision);

  pushUnique(policy.routing_hints, policyPack?.routing_defaults || []);
  pushUnique(policy.delegation_hints, policyPack?.delegation_defaults || []);
  pushUnique(policy.safety_hints, policyPack?.safety_defaults || []);

  return dedupePolicy(policy);
}
