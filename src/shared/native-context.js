export function defaultNativeConfig() {
  return {
    enabled: false,
    profile: 'native-first'
  };
}

export function validateNativeProfile(profile) {
  const value = String(profile || '').trim();
  if (value === 'native-first' || value === 'balanced' || value === 'cost-first') return value;
  return '';
}

export function nativeStateLabel(lang, enabled) {
  if (lang === 'zh') return enabled ? '已开启' : '已关闭';
  return enabled ? 'on' : 'off';
}

function dedupe(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function buildNativeContext(config = defaultNativeConfig(), runtime = {}) {
  const normalized = {
    enabled: Boolean(config?.enabled),
    profile: validateNativeProfile(config?.profile) || 'native-first'
  };

  return {
    schema_version: 3,
    native_enabled: normalized.enabled,
    native_profile: normalized.profile,
    provider_name: String(runtime?.providerName || '').trim() || 'unknown',
    settings_file: String(runtime?.settingsFile || '').trim() || 'unknown',
    protocol_mode: String(runtime?.protocolMode || '').trim() || 'unknown',
    effective_slot_mapping: {
      haiku: String(runtime?.slotMapping?.haiku || '').trim() || 'unknown',
      sonnet: String(runtime?.slotMapping?.sonnet || '').trim() || 'unknown',
      opus: String(runtime?.slotMapping?.opus || '').trim() || 'unknown'
    },
    compatibility_hints: Array.isArray(runtime?.compatibilityHints)
      ? runtime.compatibilityHints.filter(Boolean)
      : [],
    task_signals: runtime?.taskSignals || null,
    route_decision: runtime?.routeDecision || null,
    route_guidance: dedupe(runtime?.routeGuidance || []),
    recent_step_kind: String(runtime?.recentStepKind || '').trim() || 'unknown',
    session_state: runtime?.sessionState || null,
    session_guidance: dedupe(runtime?.sessionGuidance || []),
    session_trajectory: Array.isArray(runtime?.sessionTrajectory) ? runtime.sessionTrajectory.filter(Boolean) : [],
    long_horizon_session: Boolean(runtime?.longHorizonSession),
    long_horizon_guidance: dedupe(runtime?.longHorizonGuidance || []),
    subagent_quality_gate: runtime?.subagentQualityGate || null,
    subagent_quality_guidance: dedupe(runtime?.subagentQualityGuidance || []),
    task_quality_gate: runtime?.taskQualityGate || null,
    task_quality_guidance: dedupe(runtime?.taskQualityGuidance || []),
    provider_profile: runtime?.providerProfile || null,
    alignment_policy: runtime?.alignmentPolicy || null,
    provider_tuning: runtime?.providerTuning || null
  };
}

export function buildTaskSignalSummary(taskSignals = null) {
  if (!taskSignals || !Array.isArray(taskSignals.signalList) || taskSignals.signalList.length === 0) return '';
  return taskSignals.signalList.join(', ');
}

export function buildNativeRuntimePrompt(context) {
  if (!context?.native_enabled) return '';

  const lines = [
    'Claudex Native Runtime is active.',
    'Use the following runtime context as supplementary guidance only. Explicit user instructions, repository rules, and explicit Claude flags always win.',
    '```json',
    JSON.stringify(context, null, 2),
    '```'
  ];

  if (Array.isArray(context?.route_guidance) && context.route_guidance.length > 0) {
    lines.push('');
    lines.push('Dynamic task routing guidance:');
    for (const [index, step] of context.route_guidance.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
  }

  if (Array.isArray(context?.session_guidance) && context.session_guidance.length > 0) {
    lines.push('');
    lines.push('Session-aware guidance:');
    for (const [index, step] of context.session_guidance.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
  }

  if (Array.isArray(context?.long_horizon_guidance) && context.long_horizon_guidance.length > 0) {
    lines.push('');
    lines.push('Long-horizon session guidance:');
    for (const [index, step] of context.long_horizon_guidance.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
  }

  if (Array.isArray(context?.subagent_quality_guidance) && context.subagent_quality_guidance.length > 0) {
    lines.push('');
    lines.push('Subagent quality gate:');
    for (const [index, step] of context.subagent_quality_guidance.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
  }

  if (Array.isArray(context?.task_quality_guidance) && context.task_quality_guidance.length > 0) {
    lines.push('');
    lines.push('Task quality gate:');
    for (const [index, step] of context.task_quality_guidance.entries()) {
      lines.push(`${index + 1}. ${step}`);
    }
  }

  return lines.join('\n');
}

export function buildNativeDoctorLines(context, lang = 'zh') {
  const state = nativeStateLabel(lang, context?.native_enabled);
  const taskSignals = buildTaskSignalSummary(context?.task_signals);
  const routeGuidance = Array.isArray(context?.route_guidance) ? context.route_guidance : [];
  const sessionGuidance = Array.isArray(context?.session_guidance) ? context.session_guidance : [];
  const longHorizonGuidance = Array.isArray(context?.long_horizon_guidance) ? context.long_horizon_guidance : [];
  const sessionTrajectory = Array.isArray(context?.session_trajectory) ? context.session_trajectory : [];
  const longHorizonSession = Boolean(context?.long_horizon_session);
  const subagentQualityGuidance = Array.isArray(context?.subagent_quality_guidance) ? context.subagent_quality_guidance : [];
  const subagentQualityGate = context?.subagent_quality_gate || null;
  const taskQualityGuidance = Array.isArray(context?.task_quality_guidance) ? context.task_quality_guidance : [];
  const taskQualityGate = context?.task_quality_gate || null;
  const routeDecision = context?.route_decision || null;
  const recentStepKind = context?.recent_step_kind || 'unknown';

  if (lang === 'zh') {
    const lines = [
      `- Native 状态: ${state} (${context?.native_profile || 'native-first'})`,
      '- 注入方式: 启动 Claude 时追加结构化 runtime context',
      '- 优先级: 若显式传入 --system-prompt/--append-system-prompt，则以显式输入为准',
      `- Provider: ${context?.provider_name || 'unknown'}`,
      `- 协议模式: ${context?.protocol_mode || 'unknown'}`,
      `- 槽位映射: haiku=${context?.effective_slot_mapping?.haiku || 'unknown'}, sonnet=${context?.effective_slot_mapping?.sonnet || 'unknown'}, opus=${context?.effective_slot_mapping?.opus || 'unknown'}`,
      `- 最近一步: ${recentStepKind}`
    ];

    if (taskSignals) {
      lines.push(`- 任务信号: ${taskSignals}`);
    }
    if (routeDecision) {
      lines.push(`- 路由决策: ${JSON.stringify(routeDecision)}`);
      if (routeDecision.provider_drift_mode) {
        lines.push(`  Provider 漂移处置: ${routeDecision.provider_drift_mode}`);
      }
    }
    if (routeGuidance.length > 0) {
      lines.push('- 动态路由:');
      for (const [index, step] of routeGuidance.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }
    if (sessionGuidance.length > 0) {
      lines.push('- 会话态引导:');
      for (const [index, step] of sessionGuidance.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }
    if (longHorizonSession) {
      lines.push(`- 长链路会话: 已命中 (${sessionTrajectory.join(' -> ') || 'unknown'})`);
    }
    if (longHorizonGuidance.length > 0) {
      lines.push('- 长链路引导:');
      for (const [index, step] of longHorizonGuidance.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }
    if (subagentQualityGate?.enabled) {
      lines.push(`- 子代理质量门: 已开启 (${subagentQualityGate.strictness || 'baseline'})`);
      lines.push(`  适用: ${(subagentQualityGate.applies_to || []).join(', ') || 'unknown'}`);
      lines.push(`  证据要求: ${(subagentQualityGate.required_evidence || []).join(', ') || 'unknown'}`);
      if (subagentQualityGate.evidence_richness) {
        lines.push('  证据质量: file path、symbol、command 必须彼此一致且可操作，不能只是形式上都出现');
      }
      if (subagentQualityGate.conflict_resolution) {
        lines.push(`  冲突处置: 证据冲突时按 ${subagentQualityGate.evidence_resolution_mode || 'recheck'} 模式复核，必要时降级结论`);
      }
      if (subagentQualityGate.prefer_local_reverification) {
        lines.push('  本地复核优先: 若冲突证据会影响后续实现，优先切回本地工具复核');
      }
    }
    if (subagentQualityGuidance.length > 0) {
      lines.push('- 子代理质量要求:');
      for (const [index, step] of subagentQualityGuidance.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }
    if (taskQualityGate?.enabled) {
      lines.push(`- 任务质量门: 已开启 (${taskQualityGate.strictness || 'baseline'})`);
      lines.push(`  必填字段: ${(taskQualityGate.required_fields || []).join(', ') || 'unknown'}`);
      lines.push(`  subject 规则: ${(taskQualityGate.subject_rules || []).join(', ') || 'unknown'}`);
      lines.push(`  description 规则: ${(taskQualityGate.description_rules || []).join(', ') || 'unknown'}`);
    }
    if (taskQualityGuidance.length > 0) {
      lines.push('- 任务定义要求:');
      for (const [index, step] of taskQualityGuidance.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }

    return lines;
  }

  const lines = [
    `- Native status: ${state} (${context?.native_profile || 'native-first'})`,
    '- Injection: append structured runtime context when launching Claude',
    '- Priority: explicit --system-prompt/--append-system-prompt always wins',
    `- Provider: ${context?.provider_name || 'unknown'}`,
    `- Protocol mode: ${context?.protocol_mode || 'unknown'}`,
    `- Slot mapping: haiku=${context?.effective_slot_mapping?.haiku || 'unknown'}, sonnet=${context?.effective_slot_mapping?.sonnet || 'unknown'}, opus=${context?.effective_slot_mapping?.opus || 'unknown'}`,
    `- Recent step: ${recentStepKind}`
  ];

  if (taskSignals) {
    lines.push(`- Task signals: ${taskSignals}`);
  }
  if (routeDecision) {
    lines.push(`- Route decision: ${JSON.stringify(routeDecision)}`);
    if (routeDecision.provider_drift_mode) {
      lines.push(`  Provider drift handling: ${routeDecision.provider_drift_mode}`);
    }
  }
  if (routeGuidance.length > 0) {
    lines.push('- Dynamic routing:');
    for (const [index, step] of routeGuidance.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }
  if (sessionGuidance.length > 0) {
    lines.push('- Session-aware guidance:');
    for (const [index, step] of sessionGuidance.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }
  if (longHorizonSession) {
    lines.push(`- Long-horizon session: on (${sessionTrajectory.join(' -> ') || 'unknown'})`);
  }
  if (longHorizonGuidance.length > 0) {
    lines.push('- Long-horizon guidance:');
    for (const [index, step] of longHorizonGuidance.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }
  if (subagentQualityGate?.enabled) {
    lines.push(`- Subagent quality gate: on (${subagentQualityGate.strictness || 'baseline'})`);
    lines.push(`  Applies to: ${(subagentQualityGate.applies_to || []).join(', ') || 'unknown'}`);
    lines.push(`  Evidence required: ${(subagentQualityGate.required_evidence || []).join(', ') || 'unknown'}`);
    if (subagentQualityGate.evidence_richness) {
      lines.push('  Evidence quality: file path, symbol, and command must align and remain directly actionable, not merely co-present');
    }
    if (subagentQualityGate.conflict_resolution) {
      lines.push(`  Conflict handling: when evidence conflicts, re-evaluate under ${subagentQualityGate.evidence_resolution_mode || 'recheck'} mode and downgrade confidence if needed`);
    }
    if (subagentQualityGate.prefer_local_reverification) {
      lines.push('  Local reverification preference: if conflicting evidence can affect implementation, prefer local tools before trusting the subagent output');
    }
  }
  if (subagentQualityGuidance.length > 0) {
    lines.push('- Subagent quality guidance:');
    for (const [index, step] of subagentQualityGuidance.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }
  if (taskQualityGate?.enabled) {
    lines.push(`- Task quality gate: on (${taskQualityGate.strictness || 'baseline'})`);
    lines.push(`  Required fields: ${(taskQualityGate.required_fields || []).join(', ') || 'unknown'}`);
    lines.push(`  Subject rules: ${(taskQualityGate.subject_rules || []).join(', ') || 'unknown'}`);
    lines.push(`  Description rules: ${(taskQualityGate.description_rules || []).join(', ') || 'unknown'}`);
  }
  if (taskQualityGuidance.length > 0) {
    lines.push('- Task quality guidance:');
    for (const [index, step] of taskQualityGuidance.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }

  return lines;
}
