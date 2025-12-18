
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  findProjectRoot,
  isSilentMode
} from '../utils.js';
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue
} from '../config-manager.js';

function setResponseLanguage(lang, options = {}) {
  const { mcpLog, projectRoot: providedRoot, outputFormat = 'text' } = options;

  const report = (level, ...args) => {
    if (mcpLog && typeof mcpLog[level] === 'function') {
      mcpLog[level](...args);
    } else {
      log(level, ...args);
    }
  };

  const projectRoot = providedRoot || findProjectRoot() || process.cwd();
  const config = loadConfig(projectRoot);
  if (!config) {
    return {
      success: false,
      error: {
        code: 'CONFIG_MISSING',
        message: 'The configuration file is missing. Run "tm init" to create it.'
      }
    };
  }

  if (typeof lang !== 'string' || lang.trim() === '') {
    return {
      success: false,
      error: {
        code: 'INVALID_RESPONSE_LANGUAGE',
        message: `Invalid response language: ${lang}. Must be a non-empty string.`
      }
    };
  }

  try {
    setConfigValue('global.responseLanguage', lang.trim(), projectRoot);
    
    const successMessage = `Response language set to "${lang}"`;
    report('success', successMessage);

    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        data: {
          responseLanguage: lang.trim(),
          message: successMessage
        }
      };
    }

    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Response Language Updated') +
            `\n\nLanguage: ${chalk.cyan(lang.trim())}` +
            `\n\n${chalk.dim('AI responses will now be in this language.')}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }

    return {
      success: true,
      data: {
        responseLanguage: lang.trim(),
        message: successMessage
      }
    };
    
  } catch (error) {
    report('error', `Error setting response language: ${error.message}`);
    return {
      success: false,
      error: {
        code: 'SET_RESPONSE_LANGUAGE_ERROR',
        message: error.message
      }
    };
  }
}

function getResponseLanguage(options = {}) {
  const { projectRoot: providedRoot } = options;
  const projectRoot = providedRoot || findProjectRoot() || process.cwd();
  
  try {
    return getConfigValue('global.responseLanguage', projectRoot) || 'English';
  } catch {
    return 'English'; // Default
  }
}

function getSupportedLanguages() {
  return [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Dutch',
    'Russian',
    'Chinese',
    'Japanese',
    'Korean',
    'Arabic',
    'Hindi',
    'Hebrew',
    'Polish',
    'Turkish',
    'Vietnamese',
    'Thai',
    'Indonesian',
    'Swedish',
    'Norwegian',
    'Danish',
    'Finnish'
  ];
}

export { setResponseLanguage, getResponseLanguage, getSupportedLanguages };
export default setResponseLanguage;
