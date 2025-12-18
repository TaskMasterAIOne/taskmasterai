
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getSyncedApiKey, getSyncedModels, readCachedConfig, getHostedApiKey, canUseHostedApiKeys } from './license.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

export function getVersion() {
  return packageJson.version;
}

export function getGlobalConfigDir() {
  return path.join(os.homedir(), '.taskmaster-ai');
}

export function getProjectConfigDir(projectRoot = process.cwd()) {
  return path.join(projectRoot, '.taskmaster-ai');
}

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

export function getTasksFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'tasks', 'tasks.json');
}

export function getConfigFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'config.json');
}

export function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const configDir = path.join(currentDir, '.taskmaster-ai');
    if (fs.existsSync(configDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

export function readProjectConfig(projectRoot = process.cwd()) {
  const configPath = getConfigFilePath(projectRoot);
  let config = getDefaultConfig();
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

function mapDashboardModel(dashboardModelId, existingConfig) {
  if (!dashboardModelId || typeof dashboardModelId !== 'string') {
    return existingConfig;
  }

  const modelId = dashboardModelId.toLowerCase();
  let provider = null;

  // Pattern-based provider detection
  // Anthropic: claude-* models
  if (modelId.startsWith('claude-')) {
    provider = 'anthropic';
  }
  // OpenAI: gpt-*, o3-*, o4-* models
  else if (modelId.startsWith('gpt-') || modelId.startsWith('o3-') || modelId.startsWith('o4-')) {
    provider = 'openai';
  }
  // Google: gemini-* models
  else if (modelId.startsWith('gemini-')) {
    provider = 'google';
  }
  // DeepSeek: deepseek-* models
  else if (modelId.startsWith('deepseek-')) {
    provider = 'deepseek';
  }
  // xAI: grok-* models
  else if (modelId.startsWith('grok-')) {
    provider = 'xai';
  }
  // Meta: llama-* models (Meta's LLaMA API)
  else if (modelId.startsWith('llama-')) {
    provider = 'meta';
  }
  // Zhipu: glm-* models
  else if (modelId.startsWith('glm-')) {
    provider = 'zhipu';
  }
  // Moonshot: kimi-* and moonshot-* models
  else if (modelId.startsWith('kimi-') || modelId.startsWith('moonshot-')) {
    provider = 'moonshot';
  }
  // Perplexity: sonar-* models
  else if (modelId.includes('sonar')) {
    provider = 'perplexity';
  }

  if (!provider) {
    console.warn(`Unknown model provider for: ${dashboardModelId}, using existing config`);
    return existingConfig;
  }

  return {
    ...existingConfig,
    provider,
    modelId: dashboardModelId,
  };
}

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

export function getDefaultConfig() {
  return {
    projectName: 'My Project',
    projectDescription: '',
    version: '0.1.0',
    models: {
      main: {
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-5-20250929', // Best balance of capability and speed
        maxTokens: 8192,
        temperature: 0.7,
      },
      research: {
        provider: 'perplexity',
        modelId: 'sonar-pro', // Advanced search with grounding for research
        maxTokens: 8192,
        temperature: 0.5,
      },
      fallback: {
        provider: 'google',
        modelId: 'gemini-2.5-flash', // Fast and capable fallback
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

export function getApiKey(provider) {
  const keyMap = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    xai: 'XAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    zhipu: 'ZHIPU_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    meta: 'META_API_KEY',
  };

  const providerLower = provider.toLowerCase();
  const envVar = keyMap[providerLower];
  
  // First check environment variable (takes priority - user's own key)
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Then check synced config from dashboard (user's own key stored in dashboard)
  try {
    const syncedKey = getSyncedApiKey(providerLower);
    if (syncedKey) {
      return syncedKey;
    }
  } catch (error) {
    // License module might not be loaded yet, ignore
  }

  // Finally, check hosted API keys (PRO/Enterprise plan only)
  // This allows PRO/Enterprise users to use TaskMaster AI's hosted keys if they don't have their own
  try {
    if (canUseHostedApiKeys()) {
      const hostedKey = getHostedApiKey(providerLower);
      if (hostedKey) {
        return hostedKey;
      }
    }
  } catch (error) {
    // Ignore errors from hosted keys check
  }

  return null;
}

export function isApiKeySet(provider) {
  return !!getApiKey(provider);
}

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

export function getStateFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'state.json');
}

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

export function getWorkflowStateFilePath(projectRoot = process.cwd()) {
  return path.join(getProjectConfigDir(projectRoot), 'workflow-state.json');
}

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
