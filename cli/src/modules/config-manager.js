/**
 * Configuration Manager for TaskMaster AI
 * Manages project configuration, AI models, and settings
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import {
  log,
  findProjectRoot,
  getConfigDir
} from './utils.js';

// Calculate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load supported models
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

/**
 * Get all supported models organized by provider
 * @returns {Object} Model map by provider
 */
function getSupportedModels() {
  return MODEL_MAP;
}

/**
 * Get all model IDs as a flat list
 * @returns {Array<string>} List of model IDs
 */
function getAllModelIds() {
  const ids = [];
  for (const provider of Object.values(MODEL_MAP)) {
    for (const model of provider) {
      ids.push(model.id);
    }
  }
  return ids;
}

/**
 * Find a model by ID across all providers
 * @param {string} modelId - Model ID to find
 * @returns {Object|null} Model info or null
 */
function findModelById(modelId) {
  for (const [providerName, models] of Object.entries(MODEL_MAP)) {
    const model = models.find(m => m.id === modelId);
    if (model) {
      return { ...model, provider: providerName };
    }
  }
  return null;
}

/**
 * Validate a provider name
 * @param {string} provider - Provider to validate
 * @returns {boolean} True if valid
 */
function validateProvider(provider) {
  return ALL_PROVIDERS.includes(provider?.toLowerCase());
}

/**
 * Validate a model ID
 * @param {string} modelId - Model ID to validate
 * @returns {boolean} True if valid
 */
function validateModelId(modelId) {
  return findModelById(modelId) !== null;
}

/**
 * Load and validate configuration
 * @param {string} explicitRoot - Explicit project root path
 * @returns {Object} Configuration object
 */
function loadConfig(explicitRoot = null) {
  const projectRoot = explicitRoot || findProjectRoot() || process.cwd();
  
  // Return cached config if same root
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

/**
 * Save configuration to file
 * @param {Object} config - Configuration to save
 * @param {string} projectRoot - Project root path
 */
function saveConfig(config, projectRoot = null) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const configDir = getConfigDir(root);
  const configPath = path.join(configDir, 'config.json');
  
  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  // Update cache
  loadedConfig = config;
  loadedConfigRoot = root;
  
  log('info', `Configuration saved to ${configPath}`);
}

/**
 * Get a specific config value
 * @param {string} key - Config key (e.g., 'models.main.modelId')
 * @param {string} projectRoot - Project root path
 * @returns {*} Config value
 */
function getConfigValue(key, projectRoot = null) {
  const config = loadConfig(projectRoot);
  
  return key.split('.').reduce((obj, k) => obj?.[k], config);
}

/**
 * Set a specific config value
 * @param {string} key - Config key
 * @param {*} value - Value to set
 * @param {string} projectRoot - Project root path
 */
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

/**
 * Get model configuration for a role
 * @param {string} role - Role (main, research, fallback)
 * @param {string} projectRoot - Project root path
 * @returns {Object} Model config
 */
function getModelConfig(role, projectRoot = null) {
  const config = loadConfig(projectRoot);
  return config.models?.[role] || DEFAULTS.models[role];
}

/**
 * Set model for a role
 * @param {string} role - Role (main, research, fallback)
 * @param {string} modelId - Model ID
 * @param {string} projectRoot - Project root path
 * @returns {boolean} Success
 */
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
  
  return true;
}

/**
 * Get the debug flag value
 * @param {string} projectRoot - Project root path
 * @returns {boolean} Debug flag
 */
function getDebugFlag(projectRoot = null) {
  return getConfigValue('global.debug', projectRoot) === true;
}

/**
 * Get the log level
 * @param {string} projectRoot - Project root path
 * @returns {string} Log level
 */
function getLogLevel(projectRoot = null) {
  return getConfigValue('global.logLevel', projectRoot) || 'info';
}

/**
 * Get project name
 * @param {string} projectRoot - Project root path
 * @returns {string} Project name
 */
function getProjectName(projectRoot = null) {
  return getConfigValue('global.projectName', projectRoot) || 'TaskMaster AI';
}

/**
 * Get default priority
 * @param {string} projectRoot - Project root path
 * @returns {string} Default priority
 */
function getDefaultPriority(projectRoot = null) {
  return getConfigValue('global.defaultPriority', projectRoot) || 'medium';
}

/**
 * Get default number of steps
 * @param {string} projectRoot - Project root path
 * @returns {number} Default steps count
 */
function getDefaultSteps(projectRoot = null) {
  return getConfigValue('global.defaultSteps', projectRoot) || 
         getConfigValue('global.defaultSubtasks', projectRoot) || 5;
}

/**
 * Check if codebase analysis is enabled
 * @param {string} projectRoot - Project root path
 * @returns {boolean} Enabled flag
 */
function hasCodebaseAnalysis(projectRoot = null) {
  return getConfigValue('global.enableCodebaseAnalysis', projectRoot) !== false;
}

/**
 * Check if an API key is set for a provider
 * @param {string} provider - Provider name
 * @returns {boolean} True if API key is set
 */
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

/**
 * Get API key for a provider
 * @param {string} provider - Provider name
 * @returns {string|null} API key or null
 */
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

/**
 * Clear the config cache
 */
function clearConfigCache() {
  loadedConfig = null;
  loadedConfigRoot = null;
}

/**
 * Reset config to defaults
 * @param {string} projectRoot - Project root path
 */
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
  
  // Model operations
  getSupportedModels,
  getAllModelIds,
  findModelById,
  validateProvider,
  validateModelId,
  getModelConfig,
  setModelForRole,
  
  // Getters
  getDebugFlag,
  getLogLevel,
  getProjectName,
  getDefaultPriority,
  getDefaultSteps,
  hasCodebaseAnalysis,
  isApiKeySet,
  getApiKey,
  
  // Constants
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
