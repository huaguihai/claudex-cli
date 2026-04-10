#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const reportPath = process.argv[2] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-report.json');
const outputPath = process.argv[3] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-autotune.json');
const criticalCategories = new Set(['routing-sensitive', 'provider-sensitive', 'workflow-sensitive']);
const variantScenarioMap = {
  'proxy-openai-gateway': ['provider-proxy-gateway-01', 'provider-proxy-gateway-02'],
  'dashscope-openai': ['provider-dashscope-01', 'provider-dashscope-02'],
  'anthropic-official': ['provider-anthropic-official-01', 'provider-anthropic-official-02']
};

function variantScenarioSummary(provider, variant) {
  const scenarioIds = variantScenarioMap[variant] || [];
  const variantResults = (provider.results || []).filter((scenario) => scenarioIds.includes(scenario.id));
  const recommendedCounts = new Map();
  const weightedByProfile = new Map();
  let variantGateFailures = 0;

  for (const scenario of variantResults) {
    const profile = scenario.recommendation?.recommendedProfile || 'balanced';
    const weighted = scenario.recommendation?.weightedScore || 0;
    recommendedCounts.set(profile, (recommendedCounts.get(profile) || 0) + 1);
    weightedByProfile.set(profile, (weightedByProfile.get(profile) || 0) + weighted);
    if (scenario.recommendation?.passedGate === false) {
      variantGateFailures += 1;
    }
  }

  const dominantVariantProfile = [...weightedByProfile.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || [...recommendedCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return {
    scenarioCount: variantResults.length,
    dominantVariantProfile,
    variantGateFailures
  };
}

function summarizeProvider(provider) {
  const weighted = new Map();
  const gateFailures = new Map();
  const profileWins = new Map();
  const variant = provider.providerProfile?.provider_variant || 'unknown';
  const variantSummary = variantScenarioSummary(provider, variant);
  const decisionNotes = [];
  const realTasks = (provider.results || []).filter((scenario) => scenario.scenarioType === 'real-task');
  let realTaskPassed = 0;
  let realTaskTotal = 0;

  for (const scenario of provider.results || []) {
    const profile = scenario.recommendation?.recommendedProfile || 'balanced';
    const score = scenario.recommendation?.weightedScore || 0;
    weighted.set(profile, (weighted.get(profile) || 0) + score);
    profileWins.set(profile, (profileWins.get(profile) || 0) + 1);

    if (scenario.scenarioType === 'real-task') {
      realTaskTotal += 1;
      if (scenario.recommendation?.passedGate) realTaskPassed += 1;
    }

    if (criticalCategories.has(scenario.category) && scenario.recommendation?.passedGate === false) {
      gateFailures.set(profile, (gateFailures.get(profile) || 0) + 1);
    }
  }

  const missingCapabilityCounts = new Map();
  for (const scenario of realTasks) {
    const picked = (scenario.evaluations || []).find((item) => item.nativeProfile === scenario.recommendation?.recommendedProfile) || null;
    for (const capability of picked?.realTaskCheck?.missingCapabilities || []) {
      missingCapabilityCounts.set(capability, (missingCapabilityCounts.get(capability) || 0) + 1);
    }
  }
  const topMissingCapabilities = [...missingCapabilityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([capability, count]) => `${capability}:${count}`);

  const sorted = [...weighted.entries()].sort((a, b) => b[1] - a[1]);
  let [recommendedProfile, weightedScore] = sorted[0] || ['balanced', 0];
  const failures = gateFailures.get(recommendedProfile) || 0;
  decisionNotes.push(`global weighted leader=${recommendedProfile}`);

  if (provider.providerProfile?.api_surface === 'anthropic') {
    const nativeFirstWins = profileWins.get('native-first') || 0;
    const balancedWins = profileWins.get('balanced') || 0;
    if (nativeFirstWins >= balancedWins / 2 && failures === 0) {
      recommendedProfile = 'native-first';
      decisionNotes.push('global anthropic override=native-first');
    }
  }

  if ((variant === 'proxy-openai-gateway' || variant === 'dashscope-openai') && variantSummary.scenarioCount > 0) {
    recommendedProfile = variantSummary.dominantVariantProfile || recommendedProfile;
    decisionNotes.push(`variant-local override=${variantSummary.dominantVariantProfile || 'none'}`);
    if (recommendedProfile === 'cost-first') {
      recommendedProfile = 'balanced';
      decisionNotes.push('variant guardrail override=balanced');
    }
  }

  if (variant === 'anthropic-official' && variantSummary.scenarioCount > 0 && variantSummary.variantGateFailures === 0) {
    if (variantSummary.dominantVariantProfile === 'native-first') {
      recommendedProfile = 'native-first';
      decisionNotes.push('variant-local anthropic-official confirms native-first');
    } else {
      decisionNotes.push(`variant-local signal=${variantSummary.dominantVariantProfile || 'none'}`);
      if (provider.providerProfile?.api_surface === 'anthropic' && failures === 0) {
        recommendedProfile = 'native-first';
        decisionNotes.push('global anthropic reliability override keeps native-first');
      }
    }
  }

  if (failures > 0 || variantSummary.variantGateFailures > 0) {
    recommendedProfile = 'balanced';
    decisionNotes.push('gate-failure fallback=balanced');
  }

  if (realTaskTotal > 0) {
    decisionNotes.push(`real-task pass=${realTaskPassed}/${realTaskTotal}`);
    decisionNotes.push(`real-task scenarios=${realTaskTotal}`);
  }

  if (topMissingCapabilities.length > 0) {
    decisionNotes.push(`missing capabilities=${topMissingCapabilities.join(',')}`);
    decisionNotes.push('do not claim parity with hello2cc yet');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('dynamic-task-routing:'))) {
    decisionNotes.push('dynamic task routing is now the main gap');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('session-aware-guidance:'))) {
    decisionNotes.push('session-aware guidance remains missing');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('subagent-quality-gate:')) || topMissingCapabilities.some((item) => item.startsWith('task-quality-gate:'))) {
    decisionNotes.push('quality gate layer remains missing');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('long-horizon-session-stability:'))) {
    decisionNotes.push('single-step followup is no longer enough; long-horizon session stability is the next gap');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('provider-fallback-finesse:'))) {
    decisionNotes.push('provider fallback finesse is now the differentiator beyond basic guardrails');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('provider-midrun-drift-handling:'))) {
    decisionNotes.push('pre-run guardrails are solved; mid-run drift handling is now the next frontier');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-richness:'))) {
    decisionNotes.push('baseline evidence presence is solved; evidence richness is now the next frontier');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-conflict-resolution:'))) {
    decisionNotes.push('evidence richness is solved; conflict resolution is now the next frontier');
  }

  if (topMissingCapabilities.length === 0 && realTaskTotal > 0 && realTaskPassed === realTaskTotal) {
    decisionNotes.push('current benchmark no longer shows a parity gap with hello2cc');
    decisionNotes.push('next step is to add higher-order benchmark scenarios that can prove experience leadership');
  }

  if (topMissingCapabilities.length > 0 && !topMissingCapabilities.some((item) => item.startsWith('session-aware-guidance:')) && !topMissingCapabilities.some((item) => item.startsWith('subagent-quality-gate:')) && !topMissingCapabilities.some((item) => item.startsWith('task-quality-gate:'))) {
    decisionNotes.push('current parity gaps now live above the Session / Quality Layer');
  }

  if (topMissingCapabilities.length > 0) {
    decisionNotes.push('do not claim experience leadership yet');
  }

  if (topMissingCapabilities.length === 0) {
    decisionNotes.push('baseline parity claims are now benchmark-supported');
  }

  if (topMissingCapabilities.length > 0) {
    decisionNotes.push('do not claim parity with hello2cc yet');
  }

  if (topMissingCapabilities.length === 0) {
    decisionNotes.push('hello2cc parity is no longer blocked by the current benchmark set');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('long-horizon-session-stability:')) || topMissingCapabilities.some((item) => item.startsWith('provider-fallback-finesse:')) || topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-richness:'))) {
    decisionNotes.push('the remaining benchmark gaps are now in higher-order runtime maturity, not basic parity layers');
  }

  if (topMissingCapabilities.length === 0) {
    decisionNotes.push('to claim superiority, extend the benchmark beyond static pre-run decisions');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('long-horizon-session-stability:')) || topMissingCapabilities.some((item) => item.startsWith('provider-fallback-finesse:')) || topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-richness:'))) {
    decisionNotes.push('the path from parity to leadership now depends on higher-order benchmark coverage');
  }

  if (topMissingCapabilities.length === 0) {
    decisionNotes.push('the current benchmark set has become a parity floor, not a leadership ceiling');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('provider-fallback-finesse:')) && provider.providerProfile?.api_surface === 'openai-compatible') {
    decisionNotes.push('openai-compatible differentiation now depends on finer-grained fallback behavior');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('long-horizon-session-stability:'))) {
    decisionNotes.push('multi-turn continuity should become the next benchmark frontier');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-richness:'))) {
    decisionNotes.push('subagent evaluation should move from evidence presence to evidence quality');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('subagent-evidence-conflict-resolution:'))) {
    decisionNotes.push('subagent evaluation should move from evidence richness to conflict resolution');
  }

  if (topMissingCapabilities.some((item) => item.startsWith('provider-fallback-finesse:'))) {
    decisionNotes.push('provider evaluation should move from guardrails presence to adaptive fallback finesse');
  }
  if (topMissingCapabilities.some((item) => item.startsWith('provider-midrun-drift-handling:'))) {
    decisionNotes.push('provider evaluation should move from pre-run guardrails to mid-run drift handling');
  }

  if (topMissingCapabilities.length === 0) {
    decisionNotes.push('the next benchmark wave should target long-horizon, richer-evidence, and finer-fallback scenarios');
  }

  if (topMissingCapabilities.length > 0 && realTaskTotal > 0 && realTaskPassed < realTaskTotal) {
    decisionNotes.push('real-task underfit suggests static policy is not enough yet');
  }

  if (topMissingCapabilities.length === 0 && realTaskTotal > 0 && realTaskPassed === realTaskTotal) {
    decisionNotes.push('current real-task benchmark is saturated; raise the bar instead of polishing the same layer');
  }

  if (realTaskTotal > 0 && realTaskPassed < realTaskTotal) {
    decisionNotes.push('real-task underfit suggests static policy is not enough yet');
  }

  if (realTaskTotal > 0 && realTaskPassed === realTaskTotal) {
    decisionNotes.push('current real-task set no longer differentiates parity from leadership');
  }

  if (realTaskTotal > 0 && recommendedProfile === 'balanced' && provider.providerProfile?.api_surface === 'openai-compatible') {
    decisionNotes.push('openai-compatible keeps balanced while real-task gaps are measured separately');
  }

  if (realTaskTotal > 0 && realTaskPassed < realTaskTotal) {
    decisionNotes.push('real-task underfit suggests static policy is not enough yet');
  }

  if (realTaskTotal > 0 && recommendedProfile === 'balanced' && provider.providerProfile?.api_surface === 'openai-compatible') {
    decisionNotes.push('openai-compatible keeps balanced while real-task gaps are measured separately');
  }
  if (realTaskTotal > 0 && recommendedProfile === 'native-first' && provider.providerProfile?.api_surface === 'anthropic') {
    decisionNotes.push('anthropic keeps native-first while real-task gaps are measured separately');
  }

  return {
    providerName: provider.providerName,
    providerFamily: provider.providerProfile?.provider_family || 'unknown',
    providerVariant: provider.providerProfile?.provider_variant || 'unknown',
    apiSurface: provider.providerProfile?.api_surface || 'unknown',
    recommendedProfile,
    weightedScore,
    totalScenarios: (provider.results || []).length,
    realTaskPassed,
    realTaskTotal,
    gateFailures: failures,
    rationale: [
      `benchmark weighted score=${weightedScore}`,
      `total scenarios=${(provider.results || []).length}`,
      `provider family=${provider.providerProfile?.provider_family || 'unknown'}`,
      `provider variant=${provider.providerProfile?.provider_variant || 'unknown'}`,
      `api surface=${provider.providerProfile?.api_surface || 'unknown'}`,
      `variant scenarios=${variantSummary.scenarioCount}`,
      `variant dominant profile=${variantSummary.dominantVariantProfile || 'none'}`,
      `critical gate failures=${failures}`,
      `variant gate failures=${variantSummary.variantGateFailures}`,
      ...[...new Set(decisionNotes)]
    ]
  };
}

async function main() {
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const autotune = {
    generatedAt: new Date().toISOString(),
    sourceReport: reportPath,
    providers: (report.providerResults || []).map(summarizeProvider)
  };
  await fs.writeFile(outputPath, JSON.stringify(autotune, null, 2) + '\n', 'utf8');
  console.log(`Wrote autotune recommendations: ${outputPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
