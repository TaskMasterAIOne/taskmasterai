/**
 * Configuration Manager for TaskMaster AI
 * Handles project and global configuration
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { getSyncedApiKey, getSyncedModels, readCachedConfig } from './license.js';

const VERSION = '1.0.0';

/**
 * Get the CLI version
 */
export function getVersion() {
  return VERSION;
}

/**
 * Get the global config directory path
 */
export function getGlobalConfigDir() {
  return path.join(os.homedir(), '.taskmaster-ai');
}

/**
 * Get the project config directory path
 */
export function getProjectConfigDir(projectRoot = process.cwd()) {
  return path.join(projectRoot, '.taskmaster');
}

/**
 * Ensure project config directory exists
 */
export function ensureProjectConfigDir(projectRoot = process.cwd()) {
  const configDir = getProjectConfigDir(projectRoot);
  const dirs = [
    configDir,
    path.join(configDir, 'tasks'),
    path.join(configDir, 'docs'),
    path.join(configDir, 'reports'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return configDir;
}

/**
 * Get the tasks file path
 */
export function getTasksFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'tasks', 'tasks.json');
}

/**
 * Get the config file path
 */
export function getConfigFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'config.json');
}

/**
 * Find project root by looking for .taskmaster directory
 */
export function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const configDir = path.join(currentDir, '.taskmaster');
    if (fs.existsSync(configDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Read project config
 * Merges: 1. Default config, 2. Project config file, 3. Synced config from dashboard
 */
export function readProjectConfig(projectRoot = process.cwd()) {
  const configPath = getConfigFilePath(projectRoot);
  let config = getDefaultConfig();
  
  // Read project config file if exists
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      config = { ...config, ...JSON.parse(data) };
    } catch (error) {
      console.warn(`Warning: Could not read config: ${error.message}`);
    }
  }

  // Merge synced models from dashboard (if available)
  try {
    const syncedModels = getSyncedModels();
    if (syncedModels) {
      // Map dashboard model config format to CLI format
      if (syncedModels.main) {
        config.models.main = mapDashboardModel(syncedModels.main, config.models.main);
      }
      if (syncedModels.research) {
        config.models.research = mapDashboardModel(syncedModels.research, config.models.research);
      }
      if (syncedModels.fallback) {
        config.models.fallback = mapDashboardModel(syncedModels.fallback, config.models.fallback);
      }
    }
  } catch (error) {
    // Ignore errors from synced config
  }

  return config;
}

/**
 * Map dashboard model ID to CLI model config
 */
function mapDashboardModel(dashboardModelId, existingConfig) {
  // Model ID to provider mapping
  const modelToProvider = {
    // Anthropic
    'claude-sonnet-4-20250514': 'anthropic',
    'claude-3-5-sonnet-20241022': 'anthropic',
    'claude-3-5-haiku-20241022': 'anthropic',
    // OpenAI
    'gpt-4o': 'openai',
    'gpt-4o-mini': 'openai',
    // Google
    'gemini-2.0-flash': 'google',
    'gemini-1.5-pro': 'google',
    // Perplexity
    'llama-3.1-sonar-large-128k-online': 'perplexity',
    'llama-3.1-sonar-small-128k-online': 'perplexity',
  };

  const provider = modelToProvider[dashboardModelId];
  if (!provider) {
    return existingConfig; // Unknown model, keep existing
  }

  return {
    ...existingConfig,
    provider,
    modelId: dashboardModelId,
  };
}

/**
 * Write project config
 */
export function writeProjectConfig(config, projectRoot = process.cwd()) {
  ensureProjectConfigDir(projectRoot);
  const configPath = getConfigFilePath(projectRoot);
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write config: ${error.message}`);
  }
}

/**
 * Get default configuration
 */
export function getDefaultConfig() {
  return {
    projectName: 'My Project',
    projectDescription: '',
    version: '0.1.0',
    models: {
      main: {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-20250514',
        maxTokens: 8192,
        temperature: 0.7,
      },
      research: {
        provider: 'perplexity',
        modelId: 'sonar-pro',
        maxTokens: 8192,
        temperature: 0.5,
      },
      fallback: {
        provider: 'openai',
        modelId: 'gpt-4o-mini',
        maxTokens: 4096,
        temperature: 0.7,
      },
    },
    defaults: {
      numTasks: 10,
      numSubtasks: 5,
      priority: 'medium',
    },
    global: {
      defaultTag: 'master',
      logLevel: 'info',
    },
  };
}

/**
 * Get API key for a provider
 * Priority: 1. Environment variable, 2. Synced from dashboard
 */
export function getApiKey(provider) {
  const keyMap = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    xai: 'XAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  };

  const envVar = keyMap[provider.toLowerCase()];
  
  // First check environment variable (takes priority)
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Then check synced config from dashboard
  try {
    const syncedKey = getSyncedApiKey(provider.toLowerCase());
    if (syncedKey) {
      return syncedKey;
    }
  } catch (error) {
    // License module might not be loaded yet, ignore
  }

  return null;
}

/**
 * Check if an API key is set for a provider
 */
export function isApiKeySet(provider) {
  return !!getApiKey(provider);
}

/**
 * Read tasks from the tasks file
 */
export function readTasks(projectRoot = process.cwd()) {
  const tasksPath = getTasksFilePath(projectRoot);
  
  if (!fs.existsSync(tasksPath)) {
    return { tags: { master: { tasks: [], metadata: { createdAt: new Date().toISOString() } } } };
  }

  try {
    const data = fs.readFileSync(tasksPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle legacy format (array of tasks)
    if (Array.isArray(parsed)) {
      return {
        tags: {
          master: {
            tasks: parsed,
            metadata: { createdAt: new Date().toISOString() }
          }
        }
      };
    }
    
    // Handle legacy format (object with tasks array)
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return {
        tags: {
          master: {
            tasks: parsed.tasks,
            metadata: parsed.metadata || { createdAt: new Date().toISOString() }
          }
        }
      };
    }
    
    return parsed;
  } catch (error) {
    console.warn(`Warning: Could not read tasks: ${error.message}`);
    return { tags: { master: { tasks: [], metadata: { createdAt: new Date().toISOString() } } } };
  }
}

/**
 * Write tasks to the tasks file
 */
export function writeTasks(tasksData, projectRoot = process.cwd()) {
  ensureProjectConfigDir(projectRoot);
  const tasksPath = getTasksFilePath(projectRoot);
  
  try {
    fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2), 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write tasks: ${error.message}`);
  }
}

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Get the state file path
 */
export function getStateFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'state.json');
}

/**
 * Read state from state.json
 */
export function readState(projectRoot = process.cwd()) {
  const statePath = getStateFilePath(projectRoot);
  
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch (error) {
      console.warn(`Warning: Could not read state: ${error.message}`);
    }
  }
  
  return { currentTag: 'master' };
}

/**
 * Write state to state.json
 */
export function writeState(state, projectRoot = process.cwd()) {
  ensureProjectConfigDir(projectRoot);
  const statePath = getStateFilePath(projectRoot);
  
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write state: ${error.message}`);
  }
}

/**
 * Get the workflow state file path
 */
export function getWorkflowStateFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'workflow-state.json');
}

/**
 * Read workflow state (for autopilot)
 */
export function readWorkflowState(projectRoot = process.cwd()) {
  const statePath = getWorkflowStateFilePath(projectRoot);
  
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    } catch (error) {
      return null;
    }
  }
  
  return null;
}

/**
 * Write workflow state (for autopilot)
 */
export function writeWorkflowState(state, projectRoot = process.cwd()) {
  ensureProjectConfigDir(projectRoot);
  const statePath = getWorkflowStateFilePath(projectRoot);
  
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    return true;
  } catch (error) {
    throw new Error(`Failed to write workflow state: ${error.message}`);
  }
}

/**
 * Delete workflow state file
 */
export function deleteWorkflowState(projectRoot = process.cwd()) {
  const statePath = getWorkflowStateFilePath(projectRoot);
  
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
    return true;
  }
  
  return false;
}

export default {
  getVersion,
  getGlobalConfigDir,
  getProjectConfigDir,
  ensureProjectConfigDir,
  getTasksFilePath,
  getConfigFilePath,
  findProjectRoot,
  readProjectConfig,
  writeProjectConfig,
  getDefaultConfig,
  getApiKey,
  isApiKeySet,
  readTasks,
  writeTasks,
  getStateFilePath,
  readState,
  writeState,
  getWorkflowStateFilePath,
  readWorkflowState,
  writeWorkflowState,
  deleteWorkflowState,
};
