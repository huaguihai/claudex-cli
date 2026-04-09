function dedupe(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function buildSubagentQualityGate({ taskSignals = null, routeDecision = null, nativeProfile = 'native-first' } = {}) {
  const signals = taskSignals || {};
  const decision = routeDecision || {};
  const shouldEnable = Boolean(
    signals.repoResearch
    || signals.workflowSensitive
    || decision.workflow_mode === 'plan-first'
    || decision.delegation_mode === 'native-first'
    || decision.delegation_mode === 'thresholded'
  );

  if (!shouldEnable) {
    return {
      enabled: false,
      strictness: 'off',
      applies_to: [],
      required_evidence: [],
      evidence_richness: false
    };
  }

  const appliesTo = [];
  if (signals.repoResearch || decision.workflow_mode === 'tool-first-research') appliesTo.push('Explore');
  if (decision.workflow_mode === 'plan-first') appliesTo.push('Plan');
  if (signals.workflowSensitive || decision.delegation_mode === 'native-first' || decision.delegation_mode === 'thresholded') appliesTo.push('General');

  return {
    enabled: true,
    strictness: nativeProfile === 'native-first' ? 'strict' : 'baseline',
    applies_to: dedupe(appliesTo),
    required_evidence: ['file_path', 'symbol', 'command_evidence'],
    evidence_richness: true
  };
}

export function buildSubagentQualityGuidance(gate = null) {
  if (!gate?.enabled) return [];

  const appliesTo = Array.isArray(gate.applies_to) && gate.applies_to.length > 0
    ? gate.applies_to.join(' / ')
    : 'Explore / Plan / General';

  const evidence = Array.isArray(gate.required_evidence) && gate.required_evidence.length > 0
    ? gate.required_evidence.join('、')
    : 'file_path、symbol、command_evidence';

  const guidance = [
    `当任务走 ${appliesTo} 子代理路径时，输出至少要给出 ${evidence} 三类证据，不接受只有模糊总结的结果。`
  ];

  if (gate.evidence_richness) {
    guidance.push('证据之间必须彼此对齐且可操作：file path 要能直接定位，symbol 要与该路径内对象一致，command 要能复现或验证结论；若三者冲突、过时或无法落地，则视为证据不合格。');
  }

  return guidance;
}
