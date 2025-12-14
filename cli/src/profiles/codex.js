/**
 * Codex Profile
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import { createProfile } from './base-profile.js';

export const codexProfile = createProfile({
  name: 'codex',
  displayName: 'Codex',
  url: 'openai.com/codex',
  docsUrl: 'platform.openai.com/docs',
  profileDir: '.codex',
  rulesDir: '.codex/rules',
  mcpConfig: false
});
