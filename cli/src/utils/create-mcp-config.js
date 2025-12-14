/**
 * MCP Configuration Utility
 * Handles creation and management of MCP configuration files
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';

/**
 * Log utility wrapper
 * @param {string} level - Log level
 * @param {string} message - Log message
 */
function log(level, message) {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    debug: '\x1b[90m⋯\x1b[0m'
  };
  if (level !== 'debug' || process.env.TASKMASTER_LOG_LEVEL === 'debug') {
    console.log(`${prefix[level] || ''} ${message}`);
  }
}

/**
 * Format JSON with tabs for mcp.json style formatting
 * @param {Object} obj - Object to format
 * @returns {string} Formatted JSON string
 */
export function formatJSONWithTabs(obj) {
  let json = JSON.stringify(obj, null, '\t');

  json = json.replace(
    /(\[\n\t+)([^[\]]+?)(\n\t+\])/g,
    (match, openBracket, content, closeBracket) => {
      // Only convert to single line if content doesn't contain nested objects/arrays
      if (!content.includes('{') && !content.includes('[')) {
        const singleLineContent = content
          .replace(/\n\t+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return `[${singleLineContent}]`;
      }
      return match;
    }
  );

  return json;
}

/**
 * Setup MCP configuration for a profile
 * @param {string} projectRoot - Target project directory
 * @param {string} mcpConfigPath - Relative path to MCP config file
 */
export function setupMCPConfiguration(projectRoot, mcpConfigPath) {
  // Handle null mcpConfigPath (e.g., for Claude/Codex profiles)
  if (!mcpConfigPath) {
    log('debug', '[MCP Config] No mcpConfigPath provided, skipping MCP configuration setup');
    return;
  }

  // Build the full path to the MCP config file
  const mcpPath = path.join(projectRoot, mcpConfigPath);
  const configDir = path.dirname(mcpPath);

  log('info', `Setting up MCP configuration at ${mcpPath}...`);

  // New MCP config to be added - references the installed package
  const newMCPServer = {
    'taskmaster-ai': {
      command: 'npx',
      args: ['-y', '@taskmasterai/cli'],
      env: {
        ANTHROPIC_API_KEY: 'YOUR_ANTHROPIC_API_KEY_HERE',
        PERPLEXITY_API_KEY: 'YOUR_PERPLEXITY_API_KEY_HERE',
        OPENAI_API_KEY: 'YOUR_OPENAI_KEY_HERE',
        GOOGLE_API_KEY: 'YOUR_GOOGLE_KEY_HERE',
        XAI_API_KEY: 'YOUR_XAI_KEY_HERE',
        OPENROUTER_API_KEY: 'YOUR_OPENROUTER_KEY_HERE',
        MISTRAL_API_KEY: 'YOUR_MISTRAL_KEY_HERE',
        AZURE_OPENAI_API_KEY: 'YOUR_AZURE_KEY_HERE',
        OLLAMA_API_KEY: 'YOUR_OLLAMA_API_KEY_HERE'
      }
    }
  };

  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (fs.existsSync(mcpPath)) {
    log('info', 'MCP configuration file already exists, checking for existing taskmaster-ai...');
    try {
      // Read existing config
      const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      // Initialize mcpServers if it doesn't exist
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }
      // Check if any existing server configuration already has taskmaster-ai in its args
      const hasMCPString = Object.values(mcpConfig.mcpServers).some(
        (server) =>
          server.args &&
          Array.isArray(server.args) &&
          server.args.some(
            (arg) => typeof arg === 'string' && (arg.includes('taskmaster') || arg.includes('@taskmasterai'))
          )
      );
      if (hasMCPString) {
        log('info', 'Found existing TaskMaster AI MCP configuration in mcp.json, leaving untouched');
        return;
      }
      // Add the taskmaster-ai server if it doesn't exist
      if (!mcpConfig.mcpServers['taskmaster-ai']) {
        mcpConfig.mcpServers['taskmaster-ai'] = newMCPServer['taskmaster-ai'];
        log('info', 'Added taskmaster-ai server to existing MCP configuration');
      } else {
        log('info', 'taskmaster-ai server already configured in mcp.json');
      }
      // Write the updated configuration
      fs.writeFileSync(mcpPath, formatJSONWithTabs(mcpConfig) + '\n');
      log('success', 'Updated MCP configuration file');
    } catch (error) {
      log('error', `Failed to update MCP configuration: ${error.message}`);
      // Create a backup before potentially modifying
      const backupPath = `${mcpPath}.backup-${Date.now()}`;
      if (fs.existsSync(mcpPath)) {
        fs.copyFileSync(mcpPath, backupPath);
        log('info', `Created backup of existing mcp.json at ${backupPath}`);
      }
      // Create new configuration
      const newMCPConfig = {
        mcpServers: newMCPServer
      };
      fs.writeFileSync(mcpPath, formatJSONWithTabs(newMCPConfig) + '\n');
      log('warn', 'Created new MCP configuration file (backup of original file was created if it existed)');
    }
  } else {
    // If mcp.json doesn't exist, create it
    const newMCPConfig = {
      mcpServers: newMCPServer
    };
    fs.writeFileSync(mcpPath, formatJSONWithTabs(newMCPConfig) + '\n');
    log('success', `Created MCP configuration file at ${mcpPath}`);
  }

  // Add note to console about MCP integration
  log('info', 'MCP server will use the installed @taskmasterai/cli package');
}

/**
 * Remove TaskMaster MCP server configuration from an existing mcp.json file
 * @param {string} projectRoot - Target project directory
 * @param {string} mcpConfigPath - Relative path to MCP config file
 * @returns {Object} Result object with success status and details
 */
export function removeTaskMasterMCPConfiguration(projectRoot, mcpConfigPath) {
  // Handle null mcpConfigPath (e.g., for Claude/Codex profiles)
  if (!mcpConfigPath) {
    return {
      success: true,
      removed: false,
      deleted: false,
      error: null,
      hasOtherServers: false
    };
  }

  const mcpPath = path.join(projectRoot, mcpConfigPath);

  const result = {
    success: false,
    removed: false,
    deleted: false,
    error: null,
    hasOtherServers: false
  };

  if (!fs.existsSync(mcpPath)) {
    result.success = true;
    result.removed = false;
    log('debug', `[MCP Config] MCP config file does not exist: ${mcpPath}`);
    return result;
  }

  try {
    // Read existing config
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));

    if (!mcpConfig.mcpServers) {
      result.success = true;
      result.removed = false;
      log('debug', `[MCP Config] No mcpServers section found in: ${mcpPath}`);
      return result;
    }

    // Check if TaskMaster is configured
    const hasTaskMaster =
      mcpConfig.mcpServers['taskmaster-ai'] ||
      Object.values(mcpConfig.mcpServers).some(
        (server) =>
          server.args &&
          Array.isArray(server.args) &&
          server.args.some(
            (arg) => typeof arg === 'string' && (arg.includes('taskmaster') || arg.includes('@taskmasterai'))
          )
      );

    if (!hasTaskMaster) {
      result.success = true;
      result.removed = false;
      log('debug', `[MCP Config] TaskMaster not found in MCP config: ${mcpPath}`);
      return result;
    }

    // Remove taskmaster-ai server
    delete mcpConfig.mcpServers['taskmaster-ai'];

    // Also remove any servers that have taskmaster in their args
    Object.keys(mcpConfig.mcpServers).forEach((serverName) => {
      const server = mcpConfig.mcpServers[serverName];
      if (
        server.args &&
        Array.isArray(server.args) &&
        server.args.some(
          (arg) => typeof arg === 'string' && (arg.includes('taskmaster') || arg.includes('@taskmasterai'))
        )
      ) {
        delete mcpConfig.mcpServers[serverName];
        log('debug', `[MCP Config] Removed server '${serverName}' containing taskmaster`);
      }
    });

    // Check if there are other MCP servers remaining
    const remainingServers = Object.keys(mcpConfig.mcpServers);
    result.hasOtherServers = remainingServers.length > 0;

    if (result.hasOtherServers) {
      // Write back the modified config with remaining servers
      fs.writeFileSync(mcpPath, formatJSONWithTabs(mcpConfig) + '\n');
      result.success = true;
      result.removed = true;
      result.deleted = false;
      log('info', `[MCP Config] Removed TaskMaster from MCP config, preserving other servers: ${remainingServers.join(', ')}`);
    } else {
      // No other servers, delete the entire file
      fs.rmSync(mcpPath, { force: true });
      result.success = true;
      result.removed = true;
      result.deleted = true;
      log('info', `[MCP Config] Removed MCP config file (no other servers remaining): ${mcpPath}`);
    }
  } catch (error) {
    result.error = error.message;
    log('error', `[MCP Config] Failed to remove TaskMaster from MCP config: ${error.message}`);
  }

  return result;
}
