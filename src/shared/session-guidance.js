function normalizePromptExcerpt(promptText = '') {
  return String(promptText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function normalizeRecentSteps(steps = []) {
  return (Array.isArray(steps) ? steps : [])
    .filter(Boolean)
    .map((step) => ({
      step_kind: String(step?.step_kind || '').trim() || 'unknown',
      task_signals: Array.isArray(step?.task_signals) ? [...new Set(step.task_signals.filter(Boolean))] : [],
      route_decision: step?.route_decision || null,
      prompt_excerpt: normalizePromptExcerpt(step?.prompt_excerpt || ''),
      updated_at: String(step?.updated_at || '').trim()
    }));
}

export function defaultSessionState() {
  return {
    last_step_kind: 'unknown',
    last_task_signals: [],
    last_route_decision: null,
    source_prompt_excerpt: '',
    updated_at: '',
    recent_steps: []
  };
}

export async function readSessionState(filePath, readText) {
  try {
    const raw = await readText(filePath);
    const parsed = JSON.parse(raw);
    return {
      ...defaultSessionState(),
      ...parsed,
      last_task_signals: Array.isArray(parsed?.last_task_signals) ? parsed.last_task_signals.filter(Boolean) : [],
      source_prompt_excerpt: normalizePromptExcerpt(parsed?.source_prompt_excerpt || ''),
      recent_steps: normalizeRecentSteps(parsed?.recent_steps || [])
    };
  } catch {
    return defaultSessionState();
  }
}

export async function writeSessionState(filePath, state, writeText) {
  const next = {
    ...defaultSessionState(),
    ...state,
    last_task_signals: Array.isArray(state?.last_task_signals) ? [...new Set(state.last_task_signals.filter(Boolean))] : [],
    source_prompt_excerpt: normalizePromptExcerpt(state?.source_prompt_excerpt || ''),
    updated_at: state?.updated_at || new Date().toISOString(),
    recent_steps: normalizeRecentSteps(state?.recent_steps || [])
  };
  await writeText(filePath, JSON.stringify(next, null, 2));
  return next;
}

export function inferStepKind({ taskSignals = null, routeDecision = null } = {}) {
  if (taskSignals?.repoResearch) return 'research';
  if (routeDecision?.context_mode === 'followup-after-verify') return 'verify';
  if (taskSignals?.sessionFollowup && routeDecision?.context_mode === 'followup-after-plan') return 'implement';
  if (taskSignals?.sessionFollowup && routeDecision?.context_mode === 'followup-after-implement') {
    return taskSignals?.verifyIntent ? 'verify' : 'implement';
  }
  if (routeDecision?.workflow_mode === 'plan-first' || taskSignals?.multiFileFeature) return 'plan';
  if (routeDecision?.workflow_mode === 'direct-execution' || taskSignals?.boundedFix) return 'implement';
  return 'unknown';
}

export function buildLongHorizonSessionContext({ taskSignals = null, previousState = null } = {}) {
  const prior = previousState || defaultSessionState();
  const steps = normalizeRecentSteps(prior.recent_steps || []);
  const projectedSteps = taskSignals?.sessionFollowup && prior.last_step_kind
    ? normalizeRecentSteps([
      ...steps,
      {
        step_kind: prior.last_step_kind,
        task_signals: Array.isArray(prior.last_task_signals) ? prior.last_task_signals : [],
        route_decision: prior.last_route_decision || null,
        prompt_excerpt: prior.source_prompt_excerpt || '',
        updated_at: prior.updated_at || ''
      }
    ])
    : steps;
  const stepKinds = projectedSteps.map((step) => step.step_kind).filter(Boolean);
  const isFollowup = taskSignals?.sessionFollowup === true;

  const researchIndex = stepKinds.indexOf('research');
  const planIndex = stepKinds.indexOf('plan');
  const implementIndex = stepKinds.indexOf('implement');
  const verifyIndex = stepKinds.indexOf('verify');
  const orderedTrajectory = researchIndex !== -1 && planIndex > researchIndex && implementIndex > planIndex;
  const verifyTrajectory = orderedTrajectory && verifyIndex > implementIndex;

  const longHorizonSession = Boolean(isFollowup && orderedTrajectory);
  const sessionTrajectory = verifyTrajectory
    ? ['research', 'plan', 'implement', 'verify']
    : (longHorizonSession ? ['research', 'plan', 'implement'] : []);
  const longHorizonGuidance = [];

  if (verifyTrajectory) {
    longHorizonGuidance.push('最近几步已经形成 research → plan → implement → verify 链路，当前 follow-up 应在 verify 结果基础上决定收尾或返工。');
  } else if (longHorizonSession) {
    longHorizonGuidance.push('最近几步已经形成 research → plan → implement 链路，当前 follow-up 应优先进入 verify/收尾，而不是回退到 research 或重做 plan。');
  }

  return {
    longHorizonSession,
    sessionTrajectory,
    longHorizonGuidance,
    verifyReady: Boolean(longHorizonSession && !verifyTrajectory),
    verifyObserved: Boolean(verifyTrajectory)
  };
}

export function buildSessionContext({ taskSignals = null, routeDecision = null, previousState = null } = {}) {
  const prior = previousState || defaultSessionState();
  const recentStepKind = taskSignals?.sessionFollowup ? (prior.last_step_kind || 'unknown') : 'unknown';
  const isFollowup = taskSignals?.sessionFollowup === true;
  const sessionGuidance = [];
  const longHorizon = buildLongHorizonSessionContext({ taskSignals, previousState: prior });

  if (isFollowup && recentStepKind === 'research') {
    sessionGuidance.push('最近一步是 research，优先复用已定位的入口、文件与结论，避免重复搜索。');
  }
  if (isFollowup && recentStepKind === 'plan') {
    sessionGuidance.push('最近一步是 plan，优先沿用既有方案推进实现，除非用户明确要求改方案。');
  }
  if (isFollowup && recentStepKind === 'implement') {
    sessionGuidance.push('最近一步是 implement，优先继续执行、验证或收尾，不要无故回退到重型探索或规划。');
    if (longHorizon.verifyReady) {
      sessionGuidance.push('实现阶段已完成关键链路，下一步应优先进入 verify/closeout，而不是继续把 implement 当默认落点。');
    }
  }
  if (isFollowup && recentStepKind === 'verify') {
    sessionGuidance.push('最近一步是 verify，应根据验证结果决定收尾还是回到 implement 修正，而不是回退到 research/plan。');
  }
  if (isFollowup && recentStepKind === 'unknown') {
    sessionGuidance.push('这是 follow-up 任务，但最近一步类型未知；仅做轻量上下文复用，不要过度假设。');
  }
  for (const step of longHorizon.longHorizonGuidance) {
    if (step && !sessionGuidance.includes(step)) sessionGuidance.push(step);
  }

  return {
    isFollowup,
    recentStepKind,
    previousState: prior,
    sessionGuidance,
    longHorizonSession: longHorizon.longHorizonSession,
    sessionTrajectory: longHorizon.sessionTrajectory,
    longHorizonGuidance: longHorizon.longHorizonGuidance,
    verifyReady: longHorizon.verifyReady,
    verifyObserved: longHorizon.verifyObserved
  };
}

export function appendSessionStep(previousState = null, nextStep = null, limit = 4) {
  const prior = previousState || defaultSessionState();
  const normalized = normalizeRecentSteps(prior.recent_steps || []);
  const appended = normalizeRecentSteps([...
    normalized,
    nextStep || {}
  ]);
  return appended.slice(-Math.max(1, limit));
}
