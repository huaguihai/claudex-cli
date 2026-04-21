function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').trim().toLowerCase();
}

export function preferredProtocolOrder(baseUrl) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return ['anthropic', 'openai'];

  const openAiHints = [
    '/v1/chat/completions',
    '/chat/completions',
    'openai',
    'compatible',
    'dashscope',
    'localhost:3003',
    'ice.v.ua'
  ];

  if (openAiHints.some((hint) => root.includes(hint))) {
    return ['openai', 'anthropic'];
  }

  return ['anthropic', 'openai'];
}

export function inferProviderFamily(baseUrl) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return 'unknown';
  if (root.includes('anthropic')) return 'anthropic';
  if (root.includes('openai')) return 'openai-compatible';
  if (root.includes('compatible')) return 'openai-compatible';
  if (root.includes('dashscope')) return 'openai-compatible';
  if (root.includes('ice.v.ua')) return 'openai-compatible';
  if (root.includes('localhost:3003')) return 'openai-compatible';
  return 'custom';
}

export function inferApiSurface(baseUrl) {
  const order = preferredProtocolOrder(baseUrl);
  return order[0] === 'openai' ? 'openai-compatible' : 'anthropic';
}

function detectProviderVariant(baseUrl) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) return 'unknown';
  if (root.includes('api.anthropic.com')) return 'anthropic-official';
  if (root.includes('localhost:3003')) return 'proxy-openai-gateway';
  if (root.includes('dashscope')) return 'dashscope-openai';
  if (root.includes('ice.v.ua')) return 'ice-openai';
  if (root.includes('openai')) return 'openai-official-compatible';
  if (root.includes('compatible')) return 'generic-openai-compatible';
  return 'custom';
}

export function buildProviderBehaviorProfile({ providerName = '', baseUrl = '', slotMapping = {}, protocolMode = '' } = {}) {
  const providerFamily = inferProviderFamily(baseUrl);
  const apiSurface = inferApiSurface(baseUrl);
  const providerVariant = detectProviderVariant(baseUrl);
  const primaryProtocol = protocolMode || preferredProtocolOrder(baseUrl)[0] || 'unknown';

  let nativeReliability = 'unknown';
  let agentRoutingStability = 'unknown';
  let toolUseStability = 'unknown';
  let verbosityBias = 'unknown';
  let workflowBias = 'unknown';
  const compatibilityHints = [];

  if (apiSurface === 'anthropic') {
    nativeReliability = 'high';
    agentRoutingStability = 'high';
    toolUseStability = 'high';
    verbosityBias = 'low';
    workflowBias = 'native-like';
    compatibilityHints.push('prefer-anthropic-tool-contract');
    if (providerVariant === 'anthropic-official') {
      compatibilityHints.push('official-anthropic-surface');
    }
  } else if (apiSurface === 'openai-compatible') {
    nativeReliability = 'medium';
    agentRoutingStability = 'medium';
    toolUseStability = 'medium';
    verbosityBias = 'medium';
    workflowBias = 'adapter-dependent';
    compatibilityHints.push('watch-openai-compatible-protocol-drift');
    compatibilityHints.push('prefer-structured-native-context');

    if (providerVariant === 'proxy-openai-gateway') {
      agentRoutingStability = 'low';
      compatibilityHints.push('proxy-layer-may-add-routing-drift');
      compatibilityHints.push('prefer-conservative-delegation-on-proxy');
    }

    if (providerVariant === 'dashscope-openai') {
      toolUseStability = 'low';
      compatibilityHints.push('dashscope-compatible-surface-needs-extra-guardrails');
    }
  } else {
    compatibilityHints.push('unknown-provider-surface');
  }

  return {
    profile_version: 1,
    provider_name: String(providerName || '').trim() || 'unknown',
    provider_family: providerFamily,
    provider_variant: providerVariant,
    api_surface: apiSurface,
    primary_protocol: primaryProtocol,
    slot_mapping: {
      haiku: String(slotMapping?.haiku || '').trim() || 'unknown',
      sonnet: String(slotMapping?.sonnet || '').trim() || 'unknown',
      opus: String(slotMapping?.opus || '').trim() || 'unknown'
    },
    native_reliability: nativeReliability,
    agent_routing_stability: agentRoutingStability,
    tool_use_stability: toolUseStability,
    verbosity_bias: verbosityBias,
    workflow_bias: workflowBias,
    compatibility_hints: compatibilityHints
  };
}
