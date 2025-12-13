/**
 * Configuration Manager for TaskMaster AI
 * Handles project and global configuration
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

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
 */
export function readProjectConfig(projectRoot = process.cwd()) {
  const configPath = getConfigFilePath(projectRoot);
  
  if (!fs.existsSync(configPath)) {
    return getDefaultConfig();
  }

  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return { ...getDefaultConfig(), ...JSON.parse(data) };
  } catch (error) {
    console.warn(`Warning: Could not read config: ${error.message}`);
    return getDefaultConfig();
  }
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
 * Get API key for a provider from environment
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
  if (!envVar) return null;

  return process.env[envVar] || null;
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
};
