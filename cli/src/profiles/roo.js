/**
 * Roo Code Profile
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import { COMMON_TOOL_MAPPINGS, createProfile } from './base-profile.js';
import { ROO_MODES } from '../constants/profiles.js';
import { formatJSONWithTabs } from '../utils/create-mcp-config.js';

// Roo-specific MCP configuration enhancements
function enhanceRooMCPConfiguration(mcpPath) {
  if (!fs.existsSync(mcpPath)) {
    return;
  }

  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));

    if (mcpConfig.mcpServers && mcpConfig.mcpServers['taskmaster-ai']) {
      const server = mcpConfig.mcpServers['taskmaster-ai'];
      server.timeout = 300;
      fs.writeFileSync(mcpPath, formatJSONWithTabs(mcpConfig) + '\n');
    }
  } catch (error) {
    console.error(`[Roo] Failed to enhance MCP configuration: ${error.message}`);
  }
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Lifecycle functions for Roo profile
function onAddRulesProfile(targetDir, assetsDir) {
  const sourceDir = path.join(assetsDir, 'roocode');

  if (!fs.existsSync(sourceDir)) {
    console.error(`[Roo] Source directory does not exist: ${sourceDir}`);
    return;
  }

  copyRecursiveSync(sourceDir, targetDir);

  const rooModesDir = path.join(sourceDir, '.roo');

  // Copy .roomodes to project root
  const roomodesSrc = path.join(sourceDir, '.roomodes');
  const roomodesDest = path.join(targetDir, '.roomodes');
  if (fs.existsSync(roomodesSrc)) {
    try {
      fs.copyFileSync(roomodesSrc, roomodesDest);
    } catch (err) {
      console.error(`[Roo] Failed to copy .roomodes: ${err.message}`);
    }
  }

  for (const mode of ROO_MODES) {
    const src = path.join(rooModesDir, `rules-${mode}`, `${mode}-rules`);
    const dest = path.join(targetDir, '.roo', `rules-${mode}`, `${mode}-rules`);
    if (fs.existsSync(src)) {
      try {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      } catch (err) {
        console.error(`[Roo] Failed to copy ${src} to ${dest}: ${err.message}`);
      }
    }
  }
}

function onRemoveRulesProfile(targetDir) {
  const roomodesPath = path.join(targetDir, '.roomodes');
  if (fs.existsSync(roomodesPath)) {
    try {
      fs.rmSync(roomodesPath, { force: true });
    } catch (err) {
      console.error(`[Roo] Failed to remove .roomodes: ${err.message}`);
    }
  }

  const rooDir = path.join(targetDir, '.roo');
  if (fs.existsSync(rooDir)) {
    const mcpPath = path.join(rooDir, 'mcp.json');
    try {
      fs.rmSync(mcpPath, { force: true });
    } catch (err) {}

    fs.readdirSync(rooDir).forEach((entry) => {
      if (entry.startsWith('rules-')) {
        const modeDir = path.join(rooDir, entry);
        try {
          fs.rmSync(modeDir, { recursive: true, force: true });
        } catch (err) {}
      }
    });
    if (fs.readdirSync(rooDir).length === 0) {
      try {
        fs.rmSync(rooDir, { recursive: true, force: true });
      } catch (err) {}
    }
  }
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
  const mcpPath = path.join(targetDir, '.roo', 'mcp.json');
  try {
    enhanceRooMCPConfiguration(mcpPath);
  } catch (err) {
    console.error(`[Roo] Failed to enhance MCP configuration: ${err.message}`);
  }
}

export const rooProfile = createProfile({
  name: 'roo',
  displayName: 'Roo Code',
  url: 'roocode.com',
  docsUrl: 'docs.roocode.com',
  toolMappings: COMMON_TOOL_MAPPINGS.ROO_STYLE,
  mcpConfig: true,
  onAdd: onAddRulesProfile,
  onRemove: onRemoveRulesProfile,
  onPostConvert: onPostConvertRulesProfile
});

export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
