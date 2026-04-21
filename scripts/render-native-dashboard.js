#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const reportPath = path.join(repoRoot, 'tests', 'native-benchmarks', 'last-report.json');
const summaryPath = path.join(repoRoot, 'tests', 'native-benchmarks', 'last-summary.md');
const autotunePath = path.join(repoRoot, 'tests', 'native-benchmarks', 'last-autotune.json');
const outputPath = path.join(repoRoot, 'tests', 'native-benchmarks', 'dashboard.html');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const autotune = JSON.parse(await fs.readFile(autotunePath, 'utf8'));
  const summary = await fs.readFile(summaryPath, 'utf8');

  const providerCards = (autotune.providers || []).map((provider) => `
    <section class="card">
      <h2>${escapeHtml(provider.providerName)}</h2>
      <ul>
        <li><strong>family:</strong> ${escapeHtml(provider.providerFamily)}</li>
        <li><strong>surface:</strong> ${escapeHtml(provider.apiSurface)}</li>
        <li><strong>recommended profile:</strong> ${escapeHtml(provider.recommendedProfile)}</li>
        <li><strong>weighted score:</strong> ${escapeHtml(provider.weightedScore)}</li>
        <li><strong>total scenarios:</strong> ${escapeHtml(provider.totalScenarios)}</li>
      </ul>
      <p>${escapeHtml((provider.rationale || []).join(' | '))}</p>
    </section>
  `).join('\n');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>Claudex Native Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; background: #0b1020; color: #e8ecf3; }
    h1, h2 { margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
    .card { background: #151b2f; border: 1px solid #2a3355; border-radius: 12px; padding: 20px; }
    pre { background: #0f1426; padding: 16px; border-radius: 10px; overflow: auto; }
    code { color: #9bd1ff; }
  </style>
</head>
<body>
  <h1>Claudex Native Dashboard</h1>
  <p><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</p>
  <div class="grid">
    ${providerCards}
  </div>

  <section class="card" style="margin-top: 24px;">
    <h2>Benchmark Summary</h2>
    <pre>${escapeHtml(summary)}</pre>
  </section>
</body>
</html>`;

  await fs.writeFile(outputPath, html, 'utf8');
  console.log(`Wrote native dashboard: ${outputPath}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
