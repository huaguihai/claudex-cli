import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const cliPath = path.resolve(fileURLToPath(import.meta.url), '../../../src/cli.js');

// Importing cli.js must not attach stdin listeners at module load: a 'data'
// listener refs the stream, and under `node --test` the child's stdin is a
// pipe the runner keeps open forever — the process then never exits and the
// whole suite hangs. Piped-input preloading has to start lazily (first ask()).
test('importing cli.js exits cleanly even when stdin is a never-closing pipe', async () => {
  const child = spawn(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(cliPath).href)})`],
    { stdio: ['pipe', 'ignore', 'inherit'] }
  );
  // Deliberately keep child.stdin open — the child must exit anyway.
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve('timeout');
    }, 5000);
    child.on('exit', (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
  assert.equal(code, 0, 'process did not exit — import-time stdin listener holds the event loop');
});
