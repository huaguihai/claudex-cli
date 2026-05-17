#!/usr/bin/env node
import { main } from '../src/codex/cli.js';

main()
  .then((code) => process.exit(code || 0))
  .catch((err) => {
    process.stderr.write(`Error: ${err.message || err}\n`);
    process.exit(1);
  });
