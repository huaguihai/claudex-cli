#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildRouteDecision, buildDynamicRouteGuidance } from '../src/route-guidance.js';
import { buildSessionContext } from '../src/session-guidance.js';
import { classifyPromptSignals } from '../src/prompt-signals.js';
import { buildAlignmentPolicy } from '../src/alignment-policy.js';
import { buildSubagentQualityGate, buildSubagentQualityGuidance } from '../src/subagent-quality.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const smokePath = process.argv[2] || path.join(repoRoot, 'tests', 'native-benchmarks', 'smoke.json');
const outputPath = process.argv[3] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-smoke.json');

function evaluateSmokeCase(item) {
  const taskSignals = classifyPromptSignals(item.prompt || '');
  const previousState = item.previousState || null;
  const providerProfile = item.providerProfile || null;
  const nativeProfile = item.nativeProfile || 'native';
  const preliminary = buildRouteDecision({ taskSignals, providerProfile, nativeProfile, sessionContext: previousState });
  const sessionContext = buildSessionContext({ taskSignals, routeDecision: preliminary, previousState });
  const routeDecision = buildRouteDecision({ taskSignals, providerProfile, nativeProfile, sessionContext });
  const routeGuidance = buildDynamicRouteGuidance({ taskSignals, providerProfile, nativeProfile, sessionContext });
  const alignmentPolicy = buildAlignmentPolicy({ nativeProfile, providerProfile, taskSignals, sessionContext, routeDecision });
  const subagentQualityGate = buildSubagentQualityGate({ taskSignals, routeDecision });
  const subagentQualityGuidance = buildSubagentQualityGuidance(subagentQualityGate);

  const expectedSignals = item.expectedSignals || [];
  const actualSignals = [
    ...(routeGuidance || []),
    ...(sessionContext.sessionGuidance || []),
    ...(subagentQualityGuidance || []),
    ...(alignmentPolicy.response_style_hints || []),
    ...(alignmentPolicy.routing_hints || []),
    ...(alignmentPolicy.delegation_hints || []),
    ...(alignmentPolicy.safety_hints || []),
    routeDecision.context_mode || '',
    routeDecision.provider_drift_mode || ''
  ].filter(Boolean).join('\n');

  const passedSignals = expectedSignals.every((text) => actualSignals.includes(text));
  return {
    id: item.id,
    summary: item.summary,
    passed: passedSignals,
    routeDecision,
    routeGuidance,
    sessionGuidance: sessionContext.sessionGuidance || [],
    alignmentPolicy,
    subagentQualityGuidance,
    expectedSignals
  };
}

async function main() {
  const smoke = JSON.parse(await fs.readFile(smokePath, 'utf8'));
  const result = {
    generatedAt: new Date().toISOString(),
    sourceSmoke: smokePath,
    cases: (smoke.cases || []).map(evaluateSmokeCase)
  };
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  const allPassed = result.cases.every((item) => item.passed);
  console.log(`Wrote smoke report: ${outputPath}`);
  if (!allPassed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
