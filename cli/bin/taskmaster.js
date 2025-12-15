#!/usr/bin/env node

if (process.stdout.isTTY || process.env.TERM || process.env.COLORTERM || process.env.TERM_PROGRAM) {
  delete process.env.NO_COLOR;
  process.env.FORCE_COLOR = '1';
}

import { runCLI } from '../src/index.js';

runCLI();
