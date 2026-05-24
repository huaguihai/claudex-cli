#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const inputPath = process.argv[2] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-report.json');
const outputPath = process.argv[3] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-summary.md');

function topMissingSignals(results) {
  const counts = new Map();
  for (const scenario of results) {
    const picked = (scenario.evaluations || []).find((item) => item.nativeProfile === scenario.recommendation?.recommendedProfile) || null;
    for (const signal of picked?.signalCheck?.missing || []) {
      counts.set(signal, (counts.get(signal) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

function recommendationSummary(results) {
  const counts = new Map();
  for (const scenario of results) {
    const key = scenario.recommendation?.recommendedProfile || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function realTaskPassSummary(results) {
  const realTasks = (results || []).filter((scenario) => scenario.scenarioType === 'real-task');
  if (realTasks.length === 0) {
    return { total: 0, passed: 0, weightedPassed: 0, weightedTotal: 0 };
  }

  let passed = 0;
  let weightedPassed = 0;
  let weightedTotal = 0;
  for (const scenario of realTasks) {
    weightedTotal += scenario.weight || 1;
    if (scenario.recommendation?.passedGate) {
      passed += 1;
      weightedPassed += scenario.weight || 1;
    }
  }

  return { total: realTasks.length, passed, weightedPassed, weightedTotal };
}

function packContributionSummary(results) {
  let fromPack = 0;
  let fromBasePolicy = 0;
  for (const scenario of results) {
    for (const evaluation of scenario.evaluations || []) {
      fromPack += (evaluation.sourceCheck?.matchedFromPack || []).length;
      fromBasePolicy += (evaluation.sourceCheck?.matchedFromBasePolicy || []).length;
    }
  }
  return { fromPack, fromBasePolicy };
}

async function main() {
  const report = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const lines = [];
  lines.push('# Native Benchmark Summary');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Source: ${inputPath}`);
  lines.push('');

  for (const provider of report.providerResults || []) {
    lines.push(`## ${provider.providerName}`);
    lines.push('');
    lines.push(`- Provider family: ${provider.providerProfile?.provider_family}`);
    lines.push(`- API surface: ${provider.providerProfile?.api_surface}`);
    lines.push(`- Native reliability: ${provider.providerProfile?.native_reliability}`);
    lines.push(`- Workflow bias: ${provider.providerProfile?.workflow_bias}`);
    lines.push('');

    const recs = recommendationSummary(provider.results || []);
    lines.push('### Recommended mode frequency');
    for (const [profile, count] of recs) {
      lines.push(`- ${profile}: ${count}`);
    }
    lines.push('');

    const realTask = realTaskPassSummary(provider.results || []);
    lines.push('### Real-task pass rate');
    if (realTask.total === 0) {
      lines.push('- none');
    } else {
      lines.push(`- passed: ${realTask.passed}/${realTask.total}`);
      lines.push(`- weighted: ${realTask.weightedPassed}/${realTask.weightedTotal}`);
    }
    lines.push('');

    const missing = topMissingSignals(provider.results || []);
    lines.push('### Top missing signals');
    if (missing.length === 0) {
      lines.push('- none');
    } else {
      for (const [signal, count] of missing) {
        lines.push(`- ${signal}: ${count}`);
      }
    }
    lines.push('');

    const contribution = packContributionSummary(provider.results || []);
    lines.push('### Signal source contribution');
    lines.push(`- from policy pack: ${contribution.fromPack}`);
    lines.push(`- from base policy: ${contribution.fromBasePolicy}`);
    lines.push('');

    lines.push('### Scenario recommendations');
    for (const scenario of provider.results || []) {
      const picked = (scenario.evaluations || []).find((item) => item.nativeProfile === scenario.recommendation?.recommendedProfile) || null;
      const packHits = picked?.sourceCheck?.matchedFromPack?.length || 0;
      const baseHits = picked?.sourceCheck?.matchedFromBasePolicy?.length || 0;
      const scenarioType = scenario.scenarioType || 'signal';
      const capabilityMisses = picked?.realTaskCheck?.missingCapabilities?.length || 0;
      lines.push(`- ${scenario.id} [${scenario.category}, type=${scenarioType}, w=${scenario.weight}]: ${scenario.recommendation?.recommendedProfile} (score=${scenario.recommendation?.score}, weighted=${scenario.recommendation?.weightedScore}, gate=${scenario.recommendation?.passedGate}, pack_hits=${packHits}, base_hits=${baseHits}, missing_caps=${capabilityMisses})`);
    }
    lines.push('');
  }

  await fs.writeFile(outputPath, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote benchmark summary: ${outputPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
