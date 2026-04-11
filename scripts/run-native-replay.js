#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildRouteDecision } from '../src/route-guidance.js';
import { buildSessionContext, inferStepKind, appendSessionStep } from '../src/session-guidance.js';
import { classifyPromptSignals } from '../src/prompt-signals.js';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const replayPath = process.argv[2] || path.join(repoRoot, 'tests', 'native-benchmarks', 'replay.json');
const outputPath = process.argv[3] || path.join(repoRoot, 'tests', 'native-benchmarks', 'last-replay.json');

function scoreReplayCase(steps = []) {
  let state = null;
  const observations = [];
  let passed = 0;

  for (const [index, step] of steps.entries()) {
    const taskSignals = classifyPromptSignals(step.prompt || '');
    const previousState = index === 0 ? null : state;
    const preliminary = buildRouteDecision({ taskSignals, sessionContext: previousState });
    const sessionContext = buildSessionContext({ taskSignals, routeDecision: preliminary, previousState });
    const routeDecision = buildRouteDecision({ taskSignals, sessionContext });
    const nextStepKind = inferStepKind({ taskSignals, routeDecision });
    const nextState = {
      last_step_kind: nextStepKind,
      last_task_signals: Array.isArray(taskSignals.signalList) ? taskSignals.signalList : [],
      last_route_decision: routeDecision,
      source_prompt_excerpt: step.prompt,
      recent_steps: appendSessionStep(previousState, {
        step_kind: nextStepKind,
        task_signals: Array.isArray(taskSignals.signalList) ? taskSignals.signalList : [],
        route_decision: routeDecision,
        prompt_excerpt: step.prompt,
        updated_at: new Date().toISOString()
      })
    };
    const actual = {
      recentStepKind: nextStepKind,
      context_mode: routeDecision.context_mode || '',
      trajectory: sessionContext.sessionTrajectory || [],
      verifyReady: Boolean(sessionContext.verifyReady),
      verifyObserved: Boolean(sessionContext.verifyObserved)
    };
    const expected = step.expected || {};
    const ok = Object.entries(expected).every(([key, value]) => {
      if (Array.isArray(value)) {
        return JSON.stringify(actual[key] || []) === JSON.stringify(value);
      }
      return actual[key] === value;
    });
    if (ok) passed += 1;
    observations.push({ prompt: step.prompt, actual, expected, passed: ok });
    state = nextState;
  }

  return {
    passed,
    total: steps.length,
    observations
  };
}

async function main() {
  const replay = JSON.parse(await fs.readFile(replayPath, 'utf8'));
  const result = {
    generatedAt: new Date().toISOString(),
    sourceReplay: replayPath,
    cases: (replay.cases || []).map((item) => ({
      id: item.id,
      summary: item.summary,
      ...scoreReplayCase(item.steps || [])
    }))
  };
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  const allPassed = result.cases.every((item) => item.passed === item.total);
  console.log(`Wrote replay report: ${outputPath}`);
  if (!allPassed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
