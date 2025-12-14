#!/usr/bin/env node

/**
 * TaskMaster AI CLI
 * Copyright (c) 2025 TaskMaster AI LLC
 * All rights reserved.
 * 
 * This software is proprietary and requires a valid license to use.
 * Get your license at: https://taskmaster.one/pricing
 */

// Force chalk to use colors
// Some environments (like Cursor IDE) set NO_COLOR=1 which disables colors
// We want colors in our CLI for a better user experience
// This must be set BEFORE chalk is imported
if (process.stdout.isTTY || process.env.TERM || process.env.COLORTERM || process.env.TERM_PROGRAM) {
  // Enable colors for TTY or known terminal environments
  delete process.env.NO_COLOR;
  process.env.FORCE_COLOR = '1';
}

import { runCLI } from '../src/index.js';

runCLI();
