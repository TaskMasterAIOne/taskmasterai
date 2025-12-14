/**
 * VS Code Profile (with GitHub Copilot)
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import { createProfile } from './base-profile.js';

export const vscodeProfile = createProfile({
  name: 'vscode',
  displayName: 'VS Code',
  url: 'code.visualstudio.com',
  docsUrl: 'code.visualstudio.com/docs',
  profileDir: '.vscode',
  rulesDir: '.vscode/rules',
  mcpConfig: false
});
