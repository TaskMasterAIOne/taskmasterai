
import https from 'https';
import http from 'http';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  log,
  isSilentMode
} from '../utils.js';
import {
  loadConfig,
  saveConfig,
  getSupportedModels,
  findModelById,
  getModelConfig,
  setModelForRole,
  isApiKeySet
} from '../config-manager.js';

async function fetchOpenRouterModels() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/models',
      method: 'GET',
      headers: { Accept: 'application/json' }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.data || []);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function fetchOllamaModels(baseURL = 'http://localhost:11434/api') {
  return new Promise((resolve) => {
    try {
      const url = new URL(baseURL);
      const isHttps = url.protocol === 'https:';
      const port = url.port || (isHttps ? 443 : 80);
      const basePath = url.pathname.endsWith('/') 
        ? url.pathname.slice(0, -1) 
        : url.pathname;
      
      const options = {
        hostname: url.hostname,
        port: parseInt(port, 10),
        path: `${basePath}/tags`,
        method: 'GET',
        headers: { Accept: 'application/json' }
      };
      
      const requestLib = isHttps ? https : http;
      const req = requestLib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.models || []);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });
      
      req.on('error', () => resolve(null));
      req.end();
    } catch {
      resolve(null);
    }
  });
}

async function showModelsConfig(options = {}) {
  const { projectRoot, outputFormat = 'text' } = options;
  
  const config = loadConfig(projectRoot);
  const supportedModels = getSupportedModels();
  const mainConfig = config.models?.main || {};
  const researchConfig = config.models?.research || {};
  const fallbackConfig = config.models?.fallback || {};
  
  // Find model details
  const mainModel = findModelById(mainConfig.modelId);
  const researchModel = findModelById(researchConfig.modelId);
  const fallbackModel = findModelById(fallbackConfig.modelId);
  const mainKeyOk = isApiKeySet(mainConfig.provider);
  const researchKeyOk = isApiKeySet(researchConfig.provider);
  const fallbackKeyOk = isApiKeySet(fallbackConfig.provider);
  
  const configData = {
    main: {
      provider: mainConfig.provider || 'Not set',
      modelId: mainConfig.modelId || 'Not set',
      name: mainModel?.name || mainConfig.modelId || 'Unknown',
      maxTokens: mainConfig.maxTokens,
      temperature: mainConfig.temperature,
      apiKeySet: mainKeyOk
    },
    research: {
      provider: researchConfig.provider || 'Not set',
      modelId: researchConfig.modelId || 'Not set',
      name: researchModel?.name || researchConfig.modelId || 'Unknown',
      maxTokens: researchConfig.maxTokens,
      temperature: researchConfig.temperature,
      apiKeySet: researchKeyOk
    },
    fallback: {
      provider: fallbackConfig.provider || 'Not set',
      modelId: fallbackConfig.modelId || 'Not set',
      name: fallbackModel?.name || fallbackConfig.modelId || 'Unknown',
      maxTokens: fallbackConfig.maxTokens,
      temperature: fallbackConfig.temperature,
      apiKeySet: fallbackKeyOk
    }
  };
  
  // JSON output
  if (outputFormat === 'json') {
    return { success: true, data: configData };
  }
  
  // Text output
  if (!isSilentMode()) {
    console.log(
      boxen(
        chalk.cyan.bold('🤖 AI Model Configuration') +
          '\n\n' +
          chalk.white.bold('Main Model:') +
          `\n  Provider: ${chalk.cyan(configData.main.provider)}` +
          `\n  Model: ${chalk.white(configData.main.name)}` +
          `\n  Max Tokens: ${chalk.gray(configData.main.maxTokens || 'default')}` +
          `\n  API Key: ${configData.main.apiKeySet ? chalk.green('✓ Set') : chalk.red('✗ Missing')}` +
          '\n\n' +
          chalk.white.bold('Research Model:') +
          `\n  Provider: ${chalk.cyan(configData.research.provider)}` +
          `\n  Model: ${chalk.white(configData.research.name)}` +
          `\n  API Key: ${configData.research.apiKeySet ? chalk.green('✓ Set') : chalk.red('✗ Missing')}` +
          '\n\n' +
          chalk.white.bold('Fallback Model:') +
          `\n  Provider: ${chalk.cyan(configData.fallback.provider)}` +
          `\n  Model: ${chalk.white(configData.fallback.name)}` +
          `\n  API Key: ${configData.fallback.apiKeySet ? chalk.green('✓ Set') : chalk.red('✗ Missing')}`,
        {
          padding: 1,
          borderColor: 'cyan',
          borderStyle: 'round'
        }
      )
    );
  }
  
  return { success: true, data: configData };
}

async function listAvailableModels(options = {}) {
  const { projectRoot, outputFormat = 'text' } = options;
  
  const supportedModels = getSupportedModels();
  
  // JSON output
  if (outputFormat === 'json') {
    return { success: true, data: supportedModels };
  }
  
  // Text output
  if (!isSilentMode()) {
    console.log(chalk.cyan.bold('\n📋 Available AI Models\n'));
    
    for (const [provider, models] of Object.entries(supportedModels)) {
      console.log(chalk.white.bold(`\n${provider.toUpperCase()}`));
      console.log(chalk.gray('─'.repeat(40)));
      
      const table = new Table({
        head: [chalk.cyan('Model ID'), chalk.cyan('Name'), chalk.cyan('Description')],
        colWidths: [30, 25, 25]
      });
      
      for (const model of models) {
        table.push([model.id, model.name, model.description]);
      }
      
      console.log(table.toString());
    }
  }
  
  return { success: true, data: supportedModels };
}

async function setRoleModel(role, modelId, options = {}) {
  const { projectRoot, outputFormat = 'text' } = options;

  if (!['main', 'research', 'fallback'].includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be main, research, or fallback.`);
  }
  
  // Find the model
  const model = findModelById(modelId);
  if (!model) {
    throw new Error(`Model "${modelId}" not found. Run 'taskmaster models --list' to see available models.`);
  }
  const success = setModelForRole(role, modelId, projectRoot);
  
  if (!success) {
    throw new Error(`Failed to set ${role} model`);
  }
  
  // JSON output
  if (outputFormat === 'json') {
    return {
      success: true,
      data: {
        role,
        modelId,
        provider: model.provider,
        name: model.name
      }
    };
  }
  
  // Text output
  if (!isSilentMode()) {
    console.log(
      boxen(
        chalk.green.bold('✓ Model Updated') +
          `\n\nRole: ${chalk.cyan(role)}` +
          `\nModel: ${chalk.white(model.name)}` +
          `\nProvider: ${chalk.cyan(model.provider)}`,
        {
          padding: 1,
          borderColor: 'green',
          borderStyle: 'round'
        }
      )
    );
  }
  
  return { success: true };
}

export {
  fetchOpenRouterModels,
  fetchOllamaModels,
  showModelsConfig,
  listAvailableModels,
  setRoleModel
};

export default {
  fetchOpenRouterModels,
  fetchOllamaModels,
  showModelsConfig,
  listAvailableModels,
  setRoleModel
};
