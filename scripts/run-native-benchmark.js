#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildProviderBehaviorProfile } from '../src/provider-profile.js';
import { buildAlignmentPolicy } from '../src/alignment-policy.js';
import { buildNativeContext } from '../src/native-context.js';
import { buildProviderTuning } from '../src/provider-tuning.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const benchmarkPath = process.argv[2] || path.join(repoRoot, 'tests', 'native-benchmarks', 'core.json');
const outputPath = process.argv[3] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-report.json');

const sampleProviders = [
  {
    providerName: 'benchmark-openai-compat',
    baseUrl: 'https://ice.v.ua',
    slotMapping: {
      haiku: 'gpt-5.4',
      sonnet: 'gpt-5.4-high',
      opus: 'gpt-5.4-xhigh-px'
    },
    protocolMode: 'openai'
  },
  {
    providerName: 'benchmark-proxy-gateway',
    baseUrl: 'http://localhost:3003',
    slotMapping: {
      haiku: 'gpt-5.4-mini',
      sonnet: 'gpt-5.4',
      opus: 'gpt-5.4-xhigh'
    },
    protocolMode: 'openai'
  },
  {
    providerName: 'benchmark-dashscope-openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    slotMapping: {
      haiku: 'qwen-turbo',
      sonnet: 'qwen-plus',
      opus: 'qwen-max'
    },
    protocolMode: 'openai'
  },
  {
    providerName: 'benchmark-anthropic',
    baseUrl: 'https://api.anthropic.com',
    slotMapping: {
      haiku: 'claude-haiku-4-5',
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-6'
    },
    protocolMode: 'anthropic'
  }
];

const profiles = ['balanced', 'native-first', 'cost-first'];
const criticalCategories = new Set(['routing-sensitive', 'provider-sensitive', 'workflow-sensitive']);

function flattenPolicySignals(policy) {
  return [
    ...(policy?.response_style_hints || []),
    ...(policy?.routing_hints || []),
    ...(policy?.delegation_hints || []),
    ...(policy?.safety_hints || [])
  ];
}

function flattenPackSignals(policyPack) {
  return [
    ...(policyPack?.routing_defaults || []),
    ...(policyPack?.delegation_defaults || []),
    ...(policyPack?.safety_defaults || [])
  ];
}

function classifySignalSources(expectedSignals, policy, policyPack) {
  const actual = new Set(flattenPolicySignals(policy));
  const packSignals = new Set(flattenPackSignals(policyPack));
  const matchedFromPack = [];
  const matchedFromBasePolicy = [];
  const missing = [];

  for (const signal of expectedSignals || []) {
    if (!actual.has(signal)) {
      missing.push(signal);
      continue;
    }
    if (packSignals.has(signal)) {
      matchedFromPack.push(signal);
    } else {
      matchedFromBasePolicy.push(signal);
    }
  }

  return {
    matchedFromPack,
    matchedFromBasePolicy,
    missing
  };
}

function scoreSignals(expectedSignals, policy, weight = 1) {
  const actual = flattenPolicySignals(policy);
  const matched = expectedSignals.filter((signal) => actual.includes(signal));
  const rawScore = expectedSignals.length === 0 ? 1 : matched.length / expectedSignals.length;
  return {
    matched,
    missing: expectedSignals.filter((signal) => !actual.includes(signal)),
    score: rawScore,
    weightedScore: rawScore * weight,
    weight
  };
}

function summarizeRecommendation(evaluations, category) {
  const sorted = [...evaluations].sort((a, b) => b.signalCheck.weightedScore - a.signalCheck.weightedScore);
  const best = sorted[0];
  const ties = sorted
    .filter((item) => item.signalCheck.weightedScore === best.signalCheck.weightedScore)
    .map((item) => item.nativeProfile);
  const categoryGate = criticalCategories.has(category);
  return {
    recommendedProfile: best.nativeProfile,
    score: best.signalCheck.score,
    weightedScore: best.signalCheck.weightedScore,
    ties,
    categoryGate,
    passedGate: categoryGate ? best.signalCheck.score >= 1 : true
  };
}

function scenarioAppliesToProvider(scenario, providerProfile) {
  const hints = Array.isArray(scenario?.providerHints) ? scenario.providerHints : [];
  if (hints.length === 0) return true;

  return hints.every((hint) => {
    if (hint === 'openai-compatible') return providerProfile?.api_surface === 'openai-compatible' || providerProfile?.provider_family === 'openai-compatible';
    if (hint === 'anthropic') return providerProfile?.api_surface === 'anthropic' || providerProfile?.provider_family === 'anthropic';
    if (hint === 'high-reliability') return providerProfile?.native_reliability === 'high';
    if (hint === 'proxy-openai-gateway') return providerProfile?.provider_variant === 'proxy-openai-gateway';
    if (hint === 'dashscope-openai') return providerProfile?.provider_variant === 'dashscope-openai';
    if (hint === 'anthropic-official') return providerProfile?.provider_variant === 'anthropic-official';
    return true;
  });
}

async function main() {
  const scenarios = JSON.parse(await fs.readFile(benchmarkPath, 'utf8'));

  const report = {
    generatedAt: new Date().toISOString(),
    benchmarkPath,
    providerResults: []
  };

  for (const sampleProvider of sampleProviders) {
    const providerProfile = buildProviderBehaviorProfile(sampleProvider);
    const providerResult = {
      providerName: sampleProvider.providerName,
      providerProfile,
      results: []
    };

    for (const scenario of scenarios) {
      if (!scenarioAppliesToProvider(scenario, providerProfile)) {
        continue;
      }

      const scenarioResult = {
        id: scenario.id,
        category: scenario.category,
        weight: scenario.weight || 1,
        prompt: scenario.prompt,
        evaluations: []
      };

      for (const nativeProfile of profiles) {
        const providerTuning = buildProviderTuning({ providerProfile });
        const policyPack = providerTuning.policy_pack || null;
        const policy = buildAlignmentPolicy({
          nativeProfile,
          providerProfile,
          policyPack
        });
        const context = buildNativeContext({ enabled: true, profile: nativeProfile }, {
          providerName: sampleProvider.providerName,
          settingsFile: '~/.claude/settings.benchmark.json',
          protocolMode: sampleProvider.protocolMode,
          slotMapping: sampleProvider.slotMapping,
          compatibilityHints: providerProfile.compatibility_hints,
          providerProfile,
          alignmentPolicy: policy
        });

        scenarioResult.evaluations.push({
          nativeProfile,
          policy,
          policyPack,
          contextSummary: {
            protocolMode: context.protocol_mode,
            providerFamily: context.provider_profile?.provider_family,
            providerVariant: context.provider_profile?.provider_variant,
            apiSurface: context.provider_profile?.api_surface
          },
          signalCheck: scoreSignals(scenario.expectedSignals || [], policy, scenario.weight || 1),
          sourceCheck: classifySignalSources(scenario.expectedSignals || [], policy, policyPack)
        });
      }

      scenarioResult.recommendation = summarizeRecommendation(scenarioResult.evaluations, scenario.category);
      providerResult.results.push(scenarioResult);
    }

    report.providerResults.push(providerResult);
  }

  await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Wrote benchmark report: ${outputPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
