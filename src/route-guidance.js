function compactDecision(decision) {
  return Object.fromEntries(Object.entries(decision).filter(([, value]) => value));
}

export function buildRouteDecision({ taskSignals = null, providerProfile = null, nativeProfile = 'native-first', sessionContext = null } = {}) {
  const signals = taskSignals || {};
  const decision = {
    workflow_mode: '',
    delegation_mode: '',
    guardrail_mode: '',
    response_mode: '',
    context_mode: ''
  };

  if (signals.repoResearch) {
    decision.workflow_mode = 'tool-first-research';
    decision.response_mode = 'result-first';
  }

  if (signals.boundedFix) {
    decision.workflow_mode = 'direct-execution';
  }

  if (signals.multiFileFeature && !signals.boundedFix) {
    decision.workflow_mode = 'plan-first';
  }

  if (signals.providerSensitive && providerProfile?.api_surface === 'openai-compatible') {
    decision.guardrail_mode = 'openai-compatible-guarded';
    decision.delegation_mode = 'conservative';
  }

  if (signals.providerSensitive && providerProfile?.provider_variant === 'proxy-openai-gateway') {
    decision.guardrail_mode = 'openai-compatible-guarded';
    decision.delegation_mode = 'conservative';
  }

  if (signals.providerSensitive && providerProfile?.provider_variant === 'dashscope-openai') {
    decision.guardrail_mode = 'openai-compatible-guarded';
    decision.delegation_mode = 'conservative';
  }

  if (signals.providerSensitive && providerProfile?.api_surface === 'anthropic' && nativeProfile === 'native-first') {
    decision.guardrail_mode = decision.guardrail_mode || 'anthropic-native';
  }

  if (signals.workflowSensitive && nativeProfile === 'balanced') {
    decision.delegation_mode = decision.delegation_mode || 'thresholded';
  }

  if (signals.workflowSensitive && nativeProfile === 'native-first' && providerProfile?.api_surface === 'anthropic') {
    decision.delegation_mode = 'native-first';
  }

  if (signals.capabilityQuestion) {
    decision.response_mode = decision.response_mode || 'result-first';
  }

  if (signals.safetySensitive) {
    decision.guardrail_mode = decision.guardrail_mode || 'safety-first';
  }

  if (signals.sessionFollowup) {
    decision.context_mode = 'reuse-session-context';
  }

  if (signals.sessionFollowup && sessionContext?.recentStepKind === 'research') {
    decision.context_mode = 'followup-after-research';
  }

  if (signals.sessionFollowup && sessionContext?.recentStepKind === 'plan') {
    decision.context_mode = 'followup-after-plan';
  }

  if (signals.sessionFollowup && sessionContext?.recentStepKind === 'implement') {
    decision.context_mode = 'followup-after-implement';
  }

  return compactDecision(decision);
}

export function buildDynamicRouteGuidance({ taskSignals = null, providerProfile = null, nativeProfile = 'native-first', sessionContext = null } = {}) {
  const decision = buildRouteDecision({ taskSignals, providerProfile, nativeProfile, sessionContext });
  const steps = [];

  if (decision.workflow_mode === 'tool-first-research') {
    steps.push('先用原生搜索工具快速定位入口、适配层和运行时层，再给结论。');
  }

  if (decision.workflow_mode === 'direct-execution') {
    steps.push('任务边界明确且涉及文件较少，优先直接执行，不要先进入重型规划。');
  }

  if (decision.workflow_mode === 'plan-first') {
    steps.push('任务涉及多文件或实现路径有分歧，先做轻量方案判断，再决定是否进入 plan/agent 路径。');
  }

  if (decision.guardrail_mode === 'openai-compatible-guarded') {
    steps.push('当前 provider 属于 openai-compatible，优先保守 delegation，并显式防范协议或 tool contract 漂移。');
  }

  if (decision.guardrail_mode === 'proxy-guarded') {
    steps.push('当前 provider 经过 proxy/gateway，优先稳定工作流与保守 delegation。');
  }

  if (decision.guardrail_mode === 'dashscope-guarded') {
    steps.push('当前 provider 属于 dashscope 兼容层，优先 guarded tool contract。');
  }

  if (decision.delegation_mode === 'thresholded') {
    steps.push('只有在任务明确受益时才升级为更重的 workflow；否则保持原生工具优先。');
  }

  if (decision.delegation_mode === 'native-first') {
    steps.push('当前任务明显受益于 agent 路径，可采用更强的 native-first delegation。');
  }

  if (decision.response_mode === 'result-first') {
    steps.push('先直接给简洁结论，再按需补充最少必要依据。');
  }

  if (decision.guardrail_mode === 'safety-first') {
    steps.push('任何动态路由都不能覆盖显式用户意图与安全边界。');
  }

  if (decision.context_mode === 'reuse-session-context') {
    steps.push('这是 follow-up 任务，应优先复用已获得的研究结论，避免重复探索或不必要的流程升级。');
  }

  if (decision.context_mode === 'followup-after-research') {
    steps.push('最近一步是 research，应直接复用已定位的入口、文件和结论，避免重复搜索。');
  }

  if (decision.context_mode === 'followup-after-plan') {
    steps.push('最近一步是 plan，应优先沿用既有方案继续推进，除非用户明确要求改方案。');
  }

  if (decision.context_mode === 'followup-after-implement') {
    steps.push('最近一步是 implement，应优先继续执行、验证或收尾，不要无故回退到重型探索或规划。');
  }

  if (Array.isArray(sessionContext?.sessionGuidance)) {
    for (const step of sessionContext.sessionGuidance) {
      if (step && !steps.includes(step)) steps.push(step);
    }
  }

  return steps;
}
