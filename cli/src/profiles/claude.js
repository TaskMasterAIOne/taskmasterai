/**
 * Claude Code Profile
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import { createProfile } from './base-profile.js';

// Helper function to recursively copy directory
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

// Lifecycle functions for Claude Code profile
function onAddRulesProfile(targetDir, assetsDir) {
  console.log('[Claude] Commands and agents are now available via the TaskMaster plugin');
  console.log('[Claude] Install with: /plugin marketplace add taskmaster');
  console.log('[Claude] Then: /plugin install taskmaster@taskmaster');

  // Handle CLAUDE.md import for non-destructive integration
  const sourceFile = path.join(assetsDir, 'AGENTS.md');
  const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
  const taskMasterClaudeFile = path.join(targetDir, '.taskmaster-ai', 'CLAUDE.md');
  const importLine = '@./.taskmaster-ai/CLAUDE.md';
  const importSection = `\n## TaskMaster AI Instructions\n**Import TaskMaster's development workflow commands and guidelines.**\n${importLine}`;

  if (fs.existsSync(sourceFile)) {
    try {
      const taskMasterDir = path.join(targetDir, '.taskmaster-ai');
      if (!fs.existsSync(taskMasterDir)) {
        fs.mkdirSync(taskMasterDir, { recursive: true });
      }

      fs.copyFileSync(sourceFile, taskMasterClaudeFile);

      if (fs.existsSync(userClaudeFile)) {
        const content = fs.readFileSync(userClaudeFile, 'utf8');
        if (!content.includes(importLine)) {
          const updatedContent = content.trim() + '\n' + importSection + '\n';
          fs.writeFileSync(userClaudeFile, updatedContent);
          console.log(`[Claude] Added TaskMaster import to existing ${userClaudeFile}`);
        } else {
          console.log(`[Claude] TaskMaster import already present in ${userClaudeFile}`);
        }
      } else {
        const minimalContent = `# Claude Code Instructions\n${importSection}\n`;
        fs.writeFileSync(userClaudeFile, minimalContent);
        console.log(`[Claude] Created ${userClaudeFile} with TaskMaster import`);
      }
    } catch (err) {
      console.error(`[Claude] Failed to set up Claude instructions: ${err.message}`);
    }
  }
}

function onRemoveRulesProfile(targetDir) {
  console.log('[Claude] To remove TaskMaster commands/agents, uninstall the plugin with: /plugin uninstall taskmaster');

  const userClaudeFile = path.join(targetDir, 'CLAUDE.md');
  const taskMasterClaudeFile = path.join(targetDir, '.taskmaster-ai', 'CLAUDE.md');
  const importLine = '@./.taskmaster-ai/CLAUDE.md';

  try {
    if (fs.existsSync(taskMasterClaudeFile)) {
      fs.rmSync(taskMasterClaudeFile, { force: true });
    }

    if (fs.existsSync(userClaudeFile)) {
      const content = fs.readFileSync(userClaudeFile, 'utf8');
      const lines = content.split('\n');
      const filteredLines = [];
      let skipNextLines = 0;

      for (let i = 0; i < lines.length; i++) {
        if (skipNextLines > 0) {
          skipNextLines--;
          continue;
        }

        if (lines[i].includes('## TaskMaster AI Instructions')) {
          skipNextLines = 2;
          continue;
        }

        if (lines[i].trim() === importLine) {
          continue;
        }

        filteredLines.push(lines[i]);
      }

      let updatedContent = filteredLines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (
        updatedContent === '# Claude Code Instructions' ||
        updatedContent === ''
      ) {
        fs.rmSync(userClaudeFile, { force: true });
      } else {
        fs.writeFileSync(userClaudeFile, updatedContent + '\n');
      }
    }
  } catch (err) {
    console.error(`[Claude] Failed to remove Claude instructions: ${err.message}`);
  }
}

function transformToClaudeFormat(mcpConfig) {
  const claudeConfig = {};

  if (mcpConfig.mcpServers) {
    claudeConfig.mcpServers = {};

    for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
      const reorderedServer = {};
      reorderedServer.type = 'stdio';

      if (serverConfig.command) reorderedServer.command = serverConfig.command;
      if (serverConfig.args) reorderedServer.args = serverConfig.args;
      if (serverConfig.env) reorderedServer.env = serverConfig.env;

      Object.keys(serverConfig).forEach((key) => {
        if (!['command', 'args', 'env', 'type'].includes(key)) {
          reorderedServer[key] = serverConfig[key];
        }
      });

      claudeConfig.mcpServers[serverName] = reorderedServer;
    }
  }

  return claudeConfig;
}

function onPostConvertRulesProfile(targetDir, assetsDir) {
  onAddRulesProfile(targetDir, assetsDir);

  const mcpConfigPath = path.join(targetDir, '.mcp.json');
  if (fs.existsSync(mcpConfigPath)) {
    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
      const claudeConfig = transformToClaudeFormat(mcpConfig);
      fs.writeFileSync(mcpConfigPath, JSON.stringify(claudeConfig, null, '\t') + '\n');
    } catch (err) {
      console.error(`[Claude] Failed to transform MCP configuration: ${err.message}`);
    }
  }
}

export const claudeProfile = createProfile({
  name: 'claude',
  displayName: 'Claude Code',
  url: 'claude.ai',
  docsUrl: 'docs.anthropic.com/en/docs/claude-code',
  profileDir: '.',
  rulesDir: '.',
  mcpConfigName: '.mcp.json',
  includeDefaultRules: false,
  fileMap: {
    'AGENTS.md': '.taskmaster-ai/CLAUDE.md'
  },
  onAdd: onAddRulesProfile,
  onRemove: onRemoveRulesProfile,
  onPostConvert: onPostConvertRulesProfile
});

export { onAddRulesProfile, onRemoveRulesProfile, onPostConvertRulesProfile };
