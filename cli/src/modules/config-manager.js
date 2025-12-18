
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import {
  log,
  findProjectRoot,
  getConfigDir
} from './utils.js';
import { syncUserConfig, pushModelConfigToCloud } from '../lib/license.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MODEL_MAP = require('./supported-models.json');

// Default configuration values
const DEFAULTS = {
  models: {
    main: {
      provider: 'anthropic',
      modelId: 'claude-sonnet-4.5',
      maxTokens: 64000,
      temperature: 0.2
    },
    research: {
      provider: 'perplexity',
      modelId: 'sonar-pro',
      maxTokens: 8700,
      temperature: 0.1
    },
    fallback: {
      provider: 'google',
      modelId: 'gemini-2.5-flash',
      maxTokens: 1048000,
      temperature: 0.2
    }
  },
  global: {
    logLevel: 'info',
    debug: false,
    defaultNumTasks: 10,
    defaultSteps: 5,  // Our terminology
    defaultSubtasks: 5, // Backward compatibility
    defaultPriority: 'medium',
    projectName: 'TaskMaster AI',
    responseLanguage: 'English',
    enableCodebaseAnalysis: true
  }
};

// Valid providers
const ALL_PROVIDERS = [
  'anthropic',
  'openai',
  'google',
  'deepseek',
  'xai',
  'meta',
  'zhipu',
  'moonshot',
  'perplexity',
  'openrouter',
  'ollama'
];

// Internal config cache
let loadedConfig = null;
let loadedConfigRoot = null;

function getSupportedModels() {
  return MODEL_MAP;
}

function getAllModelIds() {
  const ids = [];
  for (const provider of Object.values(MODEL_MAP)) {
    for (const model of provider) {
      ids.push(model.id);
    }
  }
  return ids;
}

function findModelById(modelId) {
  for (const [providerName, models] of Object.entries(MODEL_MAP)) {
    const model = models.find(m => m.id === modelId);
    if (model) {
      return { ...model, provider: providerName };
    }
  }
  return null;
}

function validateProvider(provider) {
  return ALL_PROVIDERS.includes(provider?.toLowerCase());
}

function validateModelId(modelId) {
  return findModelById(modelId) !== null;
}

function loadConfig(explicitRoot = null) {
  const projectRoot = explicitRoot || findProjectRoot() || process.cwd();

  if (loadedConfig && loadedConfigRoot === projectRoot) {
    return loadedConfig;
  }
  
  const configPath = path.join(getConfigDir(projectRoot), 'config.json');
  let config = { ...DEFAULTS };
  
  try {
    if (fs.existsSync(configPath)) {
      const rawData = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(rawData);
      
      // Deep merge
      config = {
        models: {
          main: { ...DEFAULTS.models.main, ...parsedConfig?.models?.main },
          research: { ...DEFAULTS.models.research, ...parsedConfig?.models?.research },
          fallback: { ...DEFAULTS.models.fallback, ...parsedConfig?.models?.fallback }
        },
        global: { ...DEFAULTS.global, ...parsedConfig?.global }
      };
      
      log('debug', `Loaded config from ${configPath}`);
    } else {
      log('debug', 'No config file found, using defaults');
    }
  } catch (error) {
    log('warn', `Error loading config: ${error.message}. Using defaults.`);
  }
  
  // Cache config
  loadedConfig = config;
  loadedConfigRoot = projectRoot;
  
  return config;
}

async function syncConfigFromCloud(projectRoot = null) {
  try {
    const syncResult = await syncUserConfig(false);
    
    if (syncResult.success && syncResult.models) {
      const config = loadConfig(projectRoot);
      let hasChanges = false;
      
      // Merge synced models with local config
      for (const role of ['main', 'research', 'fallback']) {
        if (syncResult.models[role] && syncResult.models[role] !== config.models[role].modelId) {
          const model = findModelById(syncResult.models[role]);
          if (model) {
            config.models[role].modelId = model.id;
            config.models[role].provider = model.provider;
            hasChanges = true;
          }
        }
      }
      
      // Save if there were changes from cloud
      if (hasChanges) {
        saveConfig(config, projectRoot);
        log('info', 'Synced model configuration from dashboard');
        return { success: true, synced: true, changes: true };
      }
      
      return { success: true, synced: true, changes: false };
    }
    
    return { success: false, error: syncResult.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function saveConfig(config, projectRoot = null) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const configDir = getConfigDir(root);
  const configPath = path.join(configDir, 'config.json');
  
  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  loadedConfig = config;
  loadedConfigRoot = root;
  
  log('info', `Configuration saved to ${configPath}`);
}

function getConfigValue(key, projectRoot = null) {
  const config = loadConfig(projectRoot);
  
  return key.split('.').reduce((obj, k) => obj?.[k], config);
}

function setConfigValue(key, value, projectRoot = null) {
  const config = loadConfig(projectRoot);
  
  const keys = key.split('.');
  let obj = config;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  
  obj[keys[keys.length - 1]] = value;
  
  saveConfig(config, projectRoot);
}

function getModelConfig(role, projectRoot = null) {
  const config = loadConfig(projectRoot);
  return config.models?.[role] || DEFAULTS.models[role];
}

function setModelForRole(role, modelId, projectRoot = null) {
  const model = findModelById(modelId);
  
  if (!model) {
    log('error', `Model "${modelId}" not found`);
    return false;
  }
  
  const config = loadConfig(projectRoot);
  
  config.models[role] = {
    ...config.models[role],
    provider: model.provider,
    modelId: model.id,
    maxTokens: model.max_tokens || config.models[role].maxTokens
  };
  
  saveConfig(config, projectRoot);
  log('success', `Set ${role} model to ${modelId} (${model.provider})`);
  
  // Push to cloud for dashboard sync
  pushModelConfigToCloud({
    main: config.models.main.modelId,
    research: config.models.research.modelId,
    fallback: config.models.fallback.modelId
  }).catch(() => {
    // Silently ignore push errors
  });
  
  return true;
}

function getDebugFlag(projectRoot = null) {
  return getConfigValue('global.debug', projectRoot) === true;
}

function getLogLevel(projectRoot = null) {
  return getConfigValue('global.logLevel', projectRoot) || 'info';
}

function getProjectName(projectRoot = null) {
  return getConfigValue('global.projectName', projectRoot) || 'TaskMaster AI';
}

function getDefaultPriority(projectRoot = null) {
  return getConfigValue('global.defaultPriority', projectRoot) || 'medium';
}

function getDefaultSteps(projectRoot = null) {
  return getConfigValue('global.defaultSteps', projectRoot) || 
         getConfigValue('global.defaultSubtasks', projectRoot) || 5;
}

function hasCodebaseAnalysis(projectRoot = null) {
  return getConfigValue('global.enableCodebaseAnalysis', projectRoot) !== false;
}

function isApiKeySet(provider) {
  const envVars = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    xai: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };
  
  const envVar = envVars[provider?.toLowerCase()];
  return envVar ? !!process.env[envVar] : false;
}

function getApiKey(provider) {
  const envVars = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    xai: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openrouter: 'OPENROUTER_API_KEY'
  };
  
  const envVar = envVars[provider?.toLowerCase()];
  return envVar ? process.env[envVar] : null;
}

function clearConfigCache() {
  loadedConfig = null;
  loadedConfigRoot = null;
}

function resetToDefaults(projectRoot = null) {
  saveConfig(DEFAULTS, projectRoot);
  log('info', 'Configuration reset to defaults');
}

export {
  // Config operations
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  clearConfigCache,
  resetToDefaults,
  syncConfigFromCloud,
  
  // Model operations
  getSupportedModels,
  getAllModelIds,
  findModelById,
  validateProvider,
  validateModelId,
  getModelConfig,
  setModelForRole,
  getDebugFlag,
  getLogLevel,
  getProjectName,
  getDefaultPriority,
  getDefaultSteps,
  hasCodebaseAnalysis,
  isApiKeySet,
  getApiKey,

  DEFAULTS,
  ALL_PROVIDERS,
  MODEL_MAP
};

export default {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  getSupportedModels,
  findModelById,
  getModelConfig,
  setModelForRole,
  getDebugFlag,
  getLogLevel,
  getProjectName,
  getDefaultPriority,
  getDefaultSteps,
  hasCodebaseAnalysis,
  isApiKeySet,
  getApiKey,
  DEFAULTS,
  ALL_PROVIDERS
};
