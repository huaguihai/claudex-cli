import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function buildTunedPolicyPack(providerProfile) {
  const variant = providerProfile?.provider_variant || 'unknown';
  const apiSurface = providerProfile?.api_surface || 'unknown';

  if (variant === 'anthropic-official') {
    return {
      pack_name: 'anthropic-official-native-pack',
      routing_defaults: ['official-anthropic-native-workflow-advantage', 'anthropic-prefers-native-workflows'],
      delegation_defaults: ['official-anthropic-allows-confident-native-delegation'],
      safety_defaults: ['preserve-explicit-user-intent']
    };
  }

  if (variant === 'proxy-openai-gateway') {
    return {
      pack_name: 'proxy-openai-gateway-balanced-pack',
      routing_defaults: ['proxy-layer-requires-extra-routing-guardrails', 'proxy-balanced-default-bias'],
      delegation_defaults: ['prefer-conservative-delegation-on-proxy'],
      safety_defaults: ['proxy-layer-prefers-stable-workflow-over-aggressive-native-parity']
    };
  }

  if (variant === 'dashscope-openai') {
    return {
      pack_name: 'dashscope-openai-guarded-pack',
      routing_defaults: ['dashscope-prefers-guarded-tool-contract', 'dashscope-balanced-default-bias'],
      delegation_defaults: ['prefer-conservative-delegation'],
      safety_defaults: ['dashscope-compatible-tooling-needs-guardrails']
    };
  }

  if (apiSurface === 'anthropic') {
    return {
      pack_name: 'anthropic-native-pack',
      routing_defaults: ['closer-to-native-routing-is-safe'],
      delegation_defaults: ['native-first-is-safe-for-anthropic-surface'],
      safety_defaults: ['preserve-explicit-user-intent']
    };
  }

  if (apiSurface === 'openai-compatible') {
    return {
      pack_name: 'openai-compatible-balanced-pack',
      routing_defaults: ['use-structured-context-to-reduce-protocol-drift', 'balanced-default-for-openai-compatible'],
      delegation_defaults: ['be-conservative-with-complex-agent-orchestration'],
      safety_defaults: ['avoid-assuming-perfect-native-tool-contract']
    };
  }

  return {
    pack_name: 'default-balanced-pack',
    routing_defaults: [],
    delegation_defaults: [],
    safety_defaults: ['preserve-explicit-user-intent']
  };
}

function readAutoTuneRecommendations() {
  try {
    const repoPath = '/root/claudex-cli/tests/native-benchmarks/last-autotune.json';
    if (fs.existsSync(repoPath)) {
      return JSON.parse(fs.readFileSync(repoPath, 'utf8'));
    }

    const homePath = path.join(os.homedir(), '.config', 'claudex-cli', 'native-autotune.json');
    if (fs.existsSync(homePath)) {
      return JSON.parse(fs.readFileSync(homePath, 'utf8'));
    }
  } catch {
    return null;
  }
  return null;
}

function findAutoTuneMatch(providerProfile, autotune) {
  const providers = autotune?.providers || [];
  return providers.find((item) => {
    const familyMatches = item.providerFamily === providerProfile?.provider_family;
    const surfaceMatches = item.apiSurface === providerProfile?.api_surface;
    const variantMatches = (item.providerVariant || 'unknown') === (providerProfile?.provider_variant || 'unknown');
    return familyMatches && surfaceMatches && variantMatches;
  }) || providers.find((item) => item.providerFamily === providerProfile?.provider_family && item.apiSurface === providerProfile?.api_surface) || null;
}

export function buildProviderTuning({ providerProfile = null } = {}) {
  const autoTune = readAutoTuneRecommendations();
  const match = findAutoTuneMatch(providerProfile, autoTune);
  if (match) {
    return {
      tuning_version: 2,
      recommendation_source: 'benchmark-autotune',
      confidence: match.gateFailures === 0 ? 'high' : 'medium',
      recommended_profile: match.recommendedProfile,
      tuned_policy_pack: `autotuned-${providerProfile?.provider_variant || match.providerFamily}`,
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        `provider variant=${providerProfile?.provider_variant || 'unknown'}`,
        'benchmark-driven recommendation',
        ...match.rationale
      ]
    };
  }

  const family = providerProfile?.provider_family || 'unknown';
  const variant = providerProfile?.provider_variant || 'unknown';
  const apiSurface = providerProfile?.api_surface || 'unknown';
  const agentRouting = providerProfile?.agent_routing_stability || 'unknown';
  const toolUse = providerProfile?.tool_use_stability || 'unknown';

  if (variant === 'anthropic-official') {
    return {
      tuning_version: 2,
      recommendation_source: 'static-provider-variant-rule',
      confidence: 'high',
      recommended_profile: 'native-first',
      tuned_policy_pack: 'anthropic-official-native-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'official anthropic surface',
        'native reliability is high',
        'native workflow and delegation are safer here'
      ]
    };
  }

  if (variant === 'proxy-openai-gateway') {
    return {
      tuning_version: 2,
      recommendation_source: 'static-provider-variant-rule',
      confidence: 'high',
      recommended_profile: 'balanced',
      tuned_policy_pack: 'proxy-openai-gateway-balanced-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'provider sits behind a proxy/gateway layer',
        `agent routing stability=${agentRouting}`,
        'prefer conservative delegation and stronger protocol guardrails',
        'avoid aggressive native-first defaults on proxy-style surfaces'
      ]
    };
  }

  if (variant === 'dashscope-openai') {
    return {
      tuning_version: 2,
      recommendation_source: 'static-provider-variant-rule',
      confidence: 'medium',
      recommended_profile: 'balanced',
      tuned_policy_pack: 'dashscope-openai-guarded-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'dashscope-compatible surface detected',
        `tool use stability=${toolUse}`,
        'keep native intent but add stronger compatibility guardrails',
        'avoid overcommitting to native-first until tooling stability improves'
      ]
    };
  }

  if (apiSurface === 'anthropic') {
    return {
      tuning_version: 1,
      recommendation_source: 'static-provider-rule',
      confidence: 'medium',
      recommended_profile: 'native-first',
      tuned_policy_pack: 'anthropic-native-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'provider exposes anthropic-style surface',
        'native reliability is high',
        'closer-to-native routing is usually safe'
      ]
    };
  }

  if (family === 'openai-compatible' || apiSurface === 'openai-compatible') {
    return {
      tuning_version: 1,
      recommendation_source: 'static-provider-rule',
      confidence: 'medium',
      recommended_profile: 'balanced',
      tuned_policy_pack: 'openai-compatible-balanced-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'provider uses openai-compatible surface',
        'protocol drift risk is higher',
        'balanced profile is safer as default'
      ]
    };
  }

  return {
    tuning_version: 1,
    recommendation_source: 'static-safe-default',
    confidence: 'low',
    recommended_profile: 'balanced',
    tuned_policy_pack: 'default-balanced-pack',
    policy_pack: buildTunedPolicyPack(providerProfile),
    rationale: [
      'provider family is unknown',
      'balanced is the safest default until more data is available'
    ]
  };
}
