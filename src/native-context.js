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

export function buildNativeContext(config = defaultNativeConfig(), runtime = {}) {
  const normalized = {
    enabled: Boolean(config?.enabled),
    profile: validateNativeProfile(config?.profile) || 'native-first'
  };

  return {
    schema_version: 1,
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
    provider_profile: runtime?.providerProfile || null,
    alignment_policy: runtime?.alignmentPolicy || null,
    provider_tuning: runtime?.providerTuning || null
  };
}

export function buildNativeRuntimePrompt(context) {
  if (!context?.native_enabled) return '';

  return [
    'Claudex Native Runtime is active.',
    'Use the following runtime context as supplementary guidance only. Explicit user instructions, repository rules, and explicit Claude flags always win.',
    '```json',
    JSON.stringify(context, null, 2),
    '```'
  ].join('\n');
}

export function buildNativeDoctorLines(context, lang = 'zh') {
  const state = nativeStateLabel(lang, context?.native_enabled);
  if (lang === 'zh') {
    return [
      `- Native 状态: ${state} (${context?.native_profile || 'native-first'})`,
      '- 注入方式: 启动 Claude 时追加结构化 runtime context',
      '- 优先级: 若显式传入 --system-prompt/--append-system-prompt，则以显式输入为准',
      `- Provider: ${context?.provider_name || 'unknown'}`,
      `- 协议模式: ${context?.protocol_mode || 'unknown'}`,
      `- 槽位映射: haiku=${context?.effective_slot_mapping?.haiku || 'unknown'}, sonnet=${context?.effective_slot_mapping?.sonnet || 'unknown'}, opus=${context?.effective_slot_mapping?.opus || 'unknown'}`
    ];
  }

  return [
    `- Native status: ${state} (${context?.native_profile || 'native-first'})`,
    '- Injection: append structured runtime context when launching Claude',
    '- Priority: explicit --system-prompt/--append-system-prompt always wins',
    `- Provider: ${context?.provider_name || 'unknown'}`,
    `- Protocol mode: ${context?.protocol_mode || 'unknown'}`,
    `- Slot mapping: haiku=${context?.effective_slot_mapping?.haiku || 'unknown'}, sonnet=${context?.effective_slot_mapping?.sonnet || 'unknown'}, opus=${context?.effective_slot_mapping?.opus || 'unknown'}`
  ];
}
