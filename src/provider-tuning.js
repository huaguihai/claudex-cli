import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function normalizeRecommendedProfile(profile) {
  const value = String(profile || '').trim();
  if (value === 'stable' || value === 'native' || value === 'aggressive') return value;
  if (value === 'balanced') return 'stable';
  if (value === 'native-first') return 'native';
  if (value === 'cost-first') return 'stable';
  return 'stable';
}

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
      pack_name: 'proxy-openai-gateway-stable-pack',
      routing_defaults: ['proxy-layer-requires-extra-routing-guardrails', 'proxy-stable-default-bias'],
      delegation_defaults: ['prefer-conservative-delegation-on-proxy'],
      safety_defaults: ['proxy-layer-prefers-stable-workflow-over-aggressive-native-parity']
    };
  }

  if (variant === 'dashscope-openai') {
    return {
      pack_name: 'dashscope-openai-stable-pack',
      routing_defaults: ['dashscope-prefers-guarded-tool-contract', 'dashscope-stable-default-bias'],
      delegation_defaults: ['prefer-conservative-delegation'],
      safety_defaults: ['dashscope-compatible-tooling-needs-guardrails']
    };
  }

  if (apiSurface === 'anthropic') {
    return {
      pack_name: 'anthropic-native-pack',
      routing_defaults: ['closer-to-native-routing-is-safe'],
      delegation_defaults: ['native-is-safe-for-anthropic-surface'],
      safety_defaults: ['preserve-explicit-user-intent']
    };
  }

  if (apiSurface === 'openai-compatible') {
    return {
      pack_name: 'openai-compatible-stable-pack',
      routing_defaults: ['use-structured-context-to-reduce-protocol-drift', 'stable-default-for-openai-compatible'],
      delegation_defaults: ['be-conservative-with-complex-agent-orchestration'],
      safety_defaults: ['avoid-assuming-perfect-native-tool-contract']
    };
  }

  return {
    pack_name: 'default-stable-pack',
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
    const recommendedProfile = normalizeRecommendedProfile(match.recommendedProfile);
    return {
      tuning_version: 2,
      recommendation_source: 'benchmark-autotune',
      confidence: match.gateFailures === 0 ? 'high' : 'medium',
      recommended_profile: recommendedProfile,
      tuned_policy_pack: `autotuned-${providerProfile?.provider_variant || match.providerFamily}-${recommendedProfile}`,
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should keep a predictable Claudex Native experience.',
        'Routing and delegation stay aligned with the latest benchmark evidence.',
        ...match.rationale.filter((entry) => !/\bbalanced\b|\bnative-first\b|\bcost-first\b/.test(String(entry || '')))
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
      recommended_profile: 'native',
      tuned_policy_pack: 'anthropic-official-native-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should deliver the strongest Claudex Native experience.',
        'Native workflows can stay fast and direct here.',
        'Delegation can remain confident without adding extra friction.'
      ]
    };
  }

  if (variant === 'proxy-openai-gateway') {
    return {
      tuning_version: 2,
      recommendation_source: 'static-provider-variant-rule',
      confidence: 'high',
      recommended_profile: 'stable',
      tuned_policy_pack: 'proxy-openai-gateway-stable-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should favor consistent results over aggressive behavior.',
        `Agent routing stability is currently ${agentRouting}.`,
        'The default promise is safer execution with stronger compatibility guardrails.',
        'Users should expect conservative delegation on proxy-style surfaces.'
      ]
    };
  }

  if (variant === 'dashscope-openai') {
    return {
      tuning_version: 2,
      recommendation_source: 'static-provider-variant-rule',
      confidence: 'medium',
      recommended_profile: 'stable',
      tuned_policy_pack: 'dashscope-openai-stable-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should prioritize reliable compatibility by default.',
        `Tool use stability is currently ${toolUse}.`,
        'The user-facing promise is steady execution with extra guardrails where needed.',
        'Claudex Native should stay careful until tooling stability is stronger.'
      ]
    };
  }

  if (apiSurface === 'anthropic') {
    return {
      tuning_version: 1,
      recommendation_source: 'static-provider-rule',
      confidence: 'medium',
      recommended_profile: 'native',
      tuned_policy_pack: 'anthropic-native-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should feel close to the default Claudex Native path.',
        'Users should get direct routing with minimal compatibility drag.',
        'Native workflows are expected to stay dependable here.'
      ]
    };
  }

  if (family === 'openai-compatible' || apiSurface === 'openai-compatible') {
    return {
      tuning_version: 1,
      recommendation_source: 'static-provider-rule',
      confidence: 'medium',
      recommended_profile: 'stable',
      tuned_policy_pack: 'openai-compatible-stable-pack',
      policy_pack: buildTunedPolicyPack(providerProfile),
      rationale: [
        'This provider should default to predictable compatibility behavior.',
        'Users should get safer routing when protocol differences might show up.',
        'The baseline promise is stability before aggressiveness.'
      ]
    };
  }

  return {
    tuning_version: 1,
    recommendation_source: 'static-safe-default',
    confidence: 'low',
    recommended_profile: 'stable',
    tuned_policy_pack: 'default-stable-pack',
    policy_pack: buildTunedPolicyPack(providerProfile),
    rationale: [
      'This provider should start from the safest Claudex Native default.',
      'Users should get predictable behavior until more benchmark data is available.'
    ]
  };
}
