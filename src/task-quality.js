function dedupe(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function buildTaskQualityGate({ taskSignals = null, routeDecision = null, nativeProfile = 'native-first' } = {}) {
  const signals = taskSignals || {};
  const decision = routeDecision || {};
  const shouldEnable = Boolean(
    signals.workflowSensitive
    || signals.multiFileFeature
    || decision.workflow_mode === 'plan-first'
    || decision.delegation_mode === 'native-first'
    || decision.delegation_mode === 'thresholded'
  );

  if (!shouldEnable) {
    return {
      enabled: false,
      strictness: 'off',
      required_fields: [],
      subject_rules: [],
      description_rules: []
    };
  }

  return {
    enabled: true,
    strictness: nativeProfile === 'native-first' ? 'strict' : 'baseline',
    required_fields: ['subject', 'description'],
    subject_rules: ['specific_action', 'clear_object'],
    description_rules: ['deliverable_required', 'verification_evidence_required']
  };
}

export function buildTaskQualityGuidance(gate = null) {
  if (!gate?.enabled) return [];

  return [
    '创建任务时，subject 不能过泛，必须体现明确动作与对象。',
    '创建任务时，description 必须写清交付物，以及完成后如何验证。'
  ];
}
