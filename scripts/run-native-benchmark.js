#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildProviderBehaviorProfile } from '../src/provider-profile.js';
import { buildAlignmentPolicy } from '../src/alignment-policy.js';
import { buildNativeContext } from '../src/native-context.js';
import { buildProviderTuning } from '../src/provider-tuning.js';
import { classifyPromptSignals } from '../src/prompt-signals.js';
import { buildDynamicRouteGuidance, buildRouteDecision } from '../src/route-guidance.js';
import { buildSessionContext } from '../src/session-guidance.js';
import { buildSubagentQualityGate, buildSubagentQualityGuidance } from '../src/subagent-quality.js';
import { buildTaskQualityGate, buildTaskQualityGuidance } from '../src/task-quality.js';

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

function scoreRealTask(scenario, evaluation) {
  const expectedProfiles = Array.isArray(scenario?.expectedProfiles) ? scenario.expectedProfiles : [];
  const expectedSignals = Array.isArray(scenario?.expectedSignals) ? scenario.expectedSignals : [];
  const expectedRouteDecision = scenario?.expectedRouteDecision || null;
  const requiredCapabilities = Array.isArray(scenario?.requiredCapabilities) ? scenario.requiredCapabilities : [];
  const actualSignals = flattenPolicySignals(evaluation?.policy || {});
  const routeDecision = evaluation?.routeDecision || {};
  const capabilities = new Set(['structured-native-context', 'provider-aware-profile']);
  const providerFamily = evaluation?.contextSummary?.providerFamily || 'unknown';
  const providerVariant = evaluation?.contextSummary?.providerVariant || 'unknown';

  if (evaluation?.providerTuning?.recommended_profile) capabilities.add('provider-aware-tuning');
  if (providerFamily === 'openai-compatible' || providerVariant === 'proxy-openai-gateway' || providerVariant === 'dashscope-openai' || providerVariant === 'anthropic-official') {
    capabilities.add('provider-specific-guardrails');
  }
  if (routeDecision.workflow_mode || routeDecision.delegation_mode || routeDecision.guardrail_mode || routeDecision.response_mode || routeDecision.context_mode) {
    capabilities.add('dynamic-task-routing');
  }
  if (
    routeDecision.context_mode === 'reuse-session-context'
    || routeDecision.context_mode === 'followup-after-research'
    || routeDecision.context_mode === 'followup-after-plan'
    || routeDecision.context_mode === 'followup-after-implement'
    || routeDecision.context_mode === 'followup-after-verify'
  ) {
    capabilities.add('session-aware-guidance');
  }
  if (evaluation?.context?.long_horizon_session === true || (evaluation?.context?.session_trajectory || []).length >= 3) {
    capabilities.add('long-horizon-session-stability');
  }
  if (actualSignals.includes('require-verify-closeout-transition')) {
    capabilities.add('verify-closeout-transition');
  }
  if (routeDecision.context_mode === 'followup-after-verify') {
    capabilities.add('verify-closeout-transition');
  }
  if (actualSignals.includes('require-verify-reentry-handling')) {
    capabilities.add('verify-reentry-handling');
  }
  if (evaluation?.context?.subagent_quality_gate?.enabled || actualSignals.includes('dynamic-subagent-quality-gate')) {
    capabilities.add('subagent-quality-gate');
  }
  if (actualSignals.includes('require-subagent-evidence-richness')) {
    capabilities.add('subagent-evidence-richness');
  }
  if (actualSignals.includes('require-subagent-conflict-resolution')) {
    capabilities.add('subagent-evidence-conflict-resolution');
  }
  if (evaluation?.context?.task_quality_gate?.enabled || actualSignals.includes('dynamic-task-quality-gate')) {
    capabilities.add('task-quality-gate');
  }
  if (actualSignals.includes('require-provider-fallback-finesse')) {
    capabilities.add('provider-fallback-finesse');
  }
  if (actualSignals.includes('require-provider-midrun-drift-handling')) {
    capabilities.add('provider-midrun-drift-handling');
  }
  if (actualSignals.includes('prefer-local-fallback-after-provider-drift')) {
    capabilities.add('provider-midrun-drift-handling');
  }

  const matchedSignals = expectedSignals.filter((signal) => actualSignals.includes(signal));
  const matchedProfile = expectedProfiles.includes(evaluation?.nativeProfile);
  const matchedCapabilities = requiredCapabilities.filter((capability) => capabilities.has(capability));
  const routeDecisionMatched = !expectedRouteDecision || Object.entries(expectedRouteDecision).every(([key, value]) => routeDecision?.[key] === value);

  const profileScore = expectedProfiles.length === 0 ? 1 : (matchedProfile ? 1 : 0);
  const signalScore = expectedSignals.length === 0 ? 1 : matchedSignals.length / expectedSignals.length;
  const capabilityScore = requiredCapabilities.length === 0 ? 1 : matchedCapabilities.length / requiredCapabilities.length;
  const decisionScore = !expectedRouteDecision ? 1 : (routeDecisionMatched ? 1 : 0);
  const rawScore = (profileScore * 0.25) + (signalScore * 0.3) + (capabilityScore * 0.2) + (decisionScore * 0.25);

  return {
    matchedProfile,
    matchedSignals,
    missingSignals: expectedSignals.filter((signal) => !actualSignals.includes(signal)),
    matchedCapabilities,
    missingCapabilities: requiredCapabilities.filter((capability) => !capabilities.has(capability)),
    routeDecisionMatched,
    expectedRouteDecision,
    actualRouteDecision: routeDecision,
    score: rawScore,
    passed: matchedProfile && signalScore >= 1 && capabilityScore >= 1 && decisionScore >= 1
  };
}

function summarizeRecommendation(evaluations, category, scenarioType = 'signal') {
  const scoreKey = scenarioType === 'real-task' ? 'realTaskCheck' : 'signalCheck';
  const sorted = [...evaluations].sort((a, b) => (b[scoreKey]?.weightedScore || b[scoreKey]?.score || 0) - (a[scoreKey]?.weightedScore || a[scoreKey]?.score || 0));
  const best = sorted[0];
  const bestScore = best?.[scoreKey]?.weightedScore || best?.[scoreKey]?.score || 0;
  const ties = sorted
    .filter((item) => ((item[scoreKey]?.weightedScore || item[scoreKey]?.score || 0) === bestScore))
    .map((item) => item.nativeProfile);
  const categoryGate = criticalCategories.has(category);
  const passedGate = scenarioType === 'real-task'
    ? Boolean(best?.realTaskCheck?.passed)
    : (categoryGate ? best.signalCheck.score >= 1 : true);
  return {
    recommendedProfile: best.nativeProfile,
    score: best?.[scoreKey]?.score || 0,
    weightedScore: best?.[scoreKey]?.weightedScore || best?.[scoreKey]?.score || 0,
    ties,
    categoryGate,
    passedGate
  };
}

function buildScenarioChecks(scenario, evaluation) {
  const signalCheck = scoreSignals(scenario.expectedSignals || [], evaluation.policy, scenario.weight || 1);
  if (scenario?.scenarioType !== 'real-task') {
    return { signalCheck, realTaskCheck: null };
  }

  const realTaskCheck = scoreRealTask(scenario, evaluation);
  return {
    signalCheck,
    realTaskCheck: {
      ...realTaskCheck,
      weightedScore: realTaskCheck.score * (scenario.weight || 1),
      weight: scenario.weight || 1
    }
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
        const taskSignals = classifyPromptSignals(scenario.prompt || '');
        const previousSessionState = scenario.previousSessionState || null;
        const preliminaryRouteDecision = buildRouteDecision({
          taskSignals,
          providerProfile,
          nativeProfile
        });
        const sessionContext = buildSessionContext({
          taskSignals,
          routeDecision: preliminaryRouteDecision,
          previousState: previousSessionState
        });
        const routeDecision = buildRouteDecision({
          taskSignals,
          providerProfile,
          nativeProfile,
          sessionContext
        });
        const routeGuidance = buildDynamicRouteGuidance({
          taskSignals,
          providerProfile,
          nativeProfile,
          sessionContext
        });
        const subagentQualityGate = buildSubagentQualityGate({
          taskSignals,
          routeDecision,
          nativeProfile
        });
        const subagentQualityGuidance = buildSubagentQualityGuidance(subagentQualityGate);
        const taskQualityGate = buildTaskQualityGate({
          taskSignals,
          routeDecision,
          nativeProfile
        });
        const taskQualityGuidance = buildTaskQualityGuidance(taskQualityGate);
        const policy = buildAlignmentPolicy({
          nativeProfile,
          providerProfile,
          policyPack,
          taskSignals,
          sessionContext,
          subagentQualityGate,
          taskQualityGate,
          routeDecision
        });
        const context = buildNativeContext({ enabled: true, profile: nativeProfile }, {
          providerName: sampleProvider.providerName,
          settingsFile: '~/.claude/settings.benchmark.json',
          protocolMode: sampleProvider.protocolMode,
          slotMapping: sampleProvider.slotMapping,
          compatibilityHints: providerProfile.compatibility_hints,
          taskSignals,
          routeDecision,
          routeGuidance,
          recentStepKind: sessionContext.recentStepKind,
          sessionState: previousSessionState,
          sessionGuidance: sessionContext.sessionGuidance,
          sessionTrajectory: sessionContext.sessionTrajectory,
          longHorizonSession: sessionContext.longHorizonSession,
          longHorizonGuidance: sessionContext.longHorizonGuidance,
          subagentQualityGate,
          subagentQualityGuidance,
          taskQualityGate,
          taskQualityGuidance,
          providerProfile,
          alignmentPolicy: policy,
          providerTuning
        });

        const checks = buildScenarioChecks(scenario, {
          taskSignals,
          routeDecision,
          routeGuidance,
          providerTuning,
          providerProfile,
          nativeProfile,
          context,
          policy,
          contextSummary: {
            protocolMode: context.protocol_mode,
            providerFamily: context.provider_profile?.provider_family,
            providerVariant: context.provider_profile?.provider_variant,
            apiSurface: context.provider_profile?.api_surface
          }
        });

        scenarioResult.evaluations.push({
          nativeProfile,
          policy,
          policyPack,
          providerTuning,
          taskSignals,
          routeDecision,
          routeGuidance,
          context,
          contextSummary: {
            protocolMode: context.protocol_mode,
            providerFamily: context.provider_profile?.provider_family,
            providerVariant: context.provider_profile?.provider_variant,
            apiSurface: context.provider_profile?.api_surface
          },
          signalCheck: checks.signalCheck,
          realTaskCheck: checks.realTaskCheck,
          sourceCheck: classifySignalSources(scenario.expectedSignals || [], policy, policyPack)
        });
      }

      scenarioResult.scenarioType = scenario.scenarioType || 'signal';
      scenarioResult.recommendation = summarizeRecommendation(scenarioResult.evaluations, scenario.category, scenarioResult.scenarioType);
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
