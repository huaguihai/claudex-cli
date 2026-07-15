#!/usr/bin/env node
import { closeReadline, main } from '../src/cli.js';

main()
  .finally(closeReadline)
  .catch((err) => {
    console.error(`Error: ${err.message || err}`);
    process.exit(1);
  });
