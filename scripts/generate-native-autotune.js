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

  for (const scenario of provider.results || []) {
    const profile = scenario.recommendation?.recommendedProfile || 'balanced';
    const score = scenario.recommendation?.weightedScore || 0;
    weighted.set(profile, (weighted.get(profile) || 0) + score);
    profileWins.set(profile, (profileWins.get(profile) || 0) + 1);

    if (criticalCategories.has(scenario.category) && scenario.recommendation?.passedGate === false) {
      gateFailures.set(profile, (gateFailures.get(profile) || 0) + 1);
    }
  }

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

  return {
    providerName: provider.providerName,
    providerFamily: provider.providerProfile?.provider_family || 'unknown',
    providerVariant: provider.providerProfile?.provider_variant || 'unknown',
    apiSurface: provider.providerProfile?.api_surface || 'unknown',
    recommendedProfile,
    weightedScore,
    totalScenarios: (provider.results || []).length,
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
      ...decisionNotes
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
