/**
 * Error Formatter Module
 * Professional error message formatting with context-specific hints and sanitization
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import boxen from 'boxen';
import chalk from 'chalk';

/**
 * Error type categories for context-specific handling
 */
export const ERROR_TYPES = {
  AUTHENTICATION: 'authentication',
  VALIDATION: 'validation',
  NETWORK: 'network',
  API: 'api',
  FILE_SYSTEM: 'file_system',
  TASK: 'task',
  PERMISSION: 'permission',
  TIMEOUT: 'timeout',
  GENERIC: 'generic'
};

/**
 * Sensitive data patterns to sanitize from error messages
 */
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  /\b[A-Za-z0-9_-]{20,}\b/g, // Generic token pattern
  /sk-[A-Za-z0-9]{32,}/g, // OpenAI-style keys
  /api[_-]?key[:\s=]+[^\s]+/gi,
  /bearer\s+[^\s]+/gi,
  /token[:\s=]+[^\s]+/gi,

  // File paths that might contain user info
  /\/Users\/[^/]+/g,
  /C:\\Users\\[^\\]+/g,
  /\/home\/[^/]+/g,

  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // URLs with auth
  /https?:\/\/[^:]+:[^@]+@/g
];

/**
 * Sanitize sensitive information from error messages
 * @param {string} message - The message to sanitize
 * @returns {string} Sanitized message
 */
function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') return message;

  let sanitized = message;

  // Replace sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '***REDACTED***');
  }

  return sanitized;
}

/**
 * Classify error type based on error message and properties
 * @param {Error} error - The error to classify
 * @returns {string} Error type from ERROR_TYPES
 */
function classifyError(error) {
  const message = (error.message || '').toLowerCase();
  const name = (error.name || '').toLowerCase();
  const code = (error.code || '').toLowerCase();

  // Authentication errors
  if (
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid key') ||
    code === 'eauth' ||
    error.status === 401
  ) {
    return ERROR_TYPES.AUTHENTICATION;
  }

  // Validation errors
  if (
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('validation') ||
    name.includes('validation') ||
    code === 'eval'
  ) {
    return ERROR_TYPES.VALIDATION;
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    code === 'enotfound' ||
    code === 'econnrefused'
  ) {
    return ERROR_TYPES.NETWORK;
  }

  // Timeout errors
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    code === 'etimedout'
  ) {
    return ERROR_TYPES.TIMEOUT;
  }

  // API errors
  if (
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('api error') ||
    error.status === 429 ||
    error.status === 500
  ) {
    return ERROR_TYPES.API;
  }

  // File system errors
  if (
    message.includes('enoent') ||
    message.includes('file not found') ||
    message.includes('no such file') ||
    code === 'enoent' ||
    code === 'eacces'
  ) {
    return ERROR_TYPES.FILE_SYSTEM;
  }

  // Permission errors
  if (
    message.includes('permission') ||
    message.includes('forbidden') ||
    code === 'eacces' ||
    error.status === 403
  ) {
    return ERROR_TYPES.PERMISSION;
  }

  // Task-specific errors
  if (
    message.includes('task') ||
    message.includes('step') ||
    message.includes('context')
  ) {
    return ERROR_TYPES.TASK;
  }

  return ERROR_TYPES.GENERIC;
}

/**
 * Get helpful hints based on error type
 * @param {string} errorType - The classified error type
 * @param {Error} error - The original error
 * @returns {string[]} Array of helpful hints
 */
function getHints(errorType, error) {
  const hints = {
    [ERROR_TYPES.AUTHENTICATION]: [
      'Check that your API key is correctly set in .env or mcp.json',
      'Verify the API key is valid and not expired',
      'Run "tm models" to check your configuration'
    ],
    [ERROR_TYPES.VALIDATION]: [
      'Check the command syntax and required arguments',
      'Run "tm --help" for command usage',
      'Ensure task/step IDs are in the correct format (e.g., "1" or "1.2")'
    ],
    [ERROR_TYPES.NETWORK]: [
      'Check your internet connection',
      'Verify the API endpoint is accessible',
      'Try again in a few moments'
    ],
    [ERROR_TYPES.TIMEOUT]: [
      'The request took too long to complete',
      'Try again with a simpler request',
      'Check if the AI service is experiencing issues'
    ],
    [ERROR_TYPES.API]: [
      'You may have exceeded API rate limits - wait a moment and retry',
      'Check your API quota and billing status',
      'Try using a different AI model with "tm models --set-main <model>"'
    ],
    [ERROR_TYPES.FILE_SYSTEM]: [
      'Ensure you are in a TaskMaster AI project directory',
      'Run "tm init" to initialize a new project',
      'Check file permissions and paths'
    ],
    [ERROR_TYPES.PERMISSION]: [
      'Check file and directory permissions',
      'Try running with elevated privileges if necessary',
      'Ensure you have write access to the project directory'
    ],
    [ERROR_TYPES.TASK]: [
      'Verify the task ID exists with "tm list"',
      'Use "tm show <id>" to check task details',
      'Ensure the task is in the current context'
    ],
    [ERROR_TYPES.GENERIC]: [
      'Try running the command again',
      'Check "tm --help" for command usage',
      'Enable debug mode for more details'
    ]
  };

  return hints[errorType] || hints[ERROR_TYPES.GENERIC];
}

/**
 * Format an error message for display
 * @param {Error} error - The error to format
 * @param {Object} options - Formatting options
 * @param {boolean} [options.showStack=false] - Include stack trace
 * @param {boolean} [options.showHints=true] - Include helpful hints
 * @param {boolean} [options.sanitize=true] - Sanitize sensitive data
 * @returns {string} Formatted error message
 */
function formatError(error, options = {}) {
  const { showStack = false, showHints = true, sanitize = true } = options;

  const errorType = classifyError(error);
  let message = error.message || 'An unknown error occurred';
  
  if (sanitize) {
    message = sanitizeMessage(message);
  }

  const icon = {
    [ERROR_TYPES.AUTHENTICATION]: '🔐',
    [ERROR_TYPES.VALIDATION]: '⚠️',
    [ERROR_TYPES.NETWORK]: '🌐',
    [ERROR_TYPES.API]: '🤖',
    [ERROR_TYPES.FILE_SYSTEM]: '📁',
    [ERROR_TYPES.PERMISSION]: '🚫',
    [ERROR_TYPES.TIMEOUT]: '⏱️',
    [ERROR_TYPES.TASK]: '📋',
    [ERROR_TYPES.GENERIC]: '❌'
  }[errorType];

  let output = `${icon} ${chalk.red.bold('Error:')} ${chalk.white(message)}`;

  if (showHints) {
    const hints = getHints(errorType, error);
    if (hints.length > 0) {
      output += '\n\n' + chalk.cyan.bold('Suggestions:');
      hints.forEach((hint, i) => {
        output += `\n  ${chalk.dim(`${i + 1}.`)} ${hint}`;
      });
    }
  }

  if (showStack && error.stack) {
    const sanitizedStack = sanitize 
      ? sanitizeMessage(error.stack) 
      : error.stack;
    output += '\n\n' + chalk.dim('Stack trace:\n' + sanitizedStack);
  }

  return boxen(output, {
    padding: 1,
    borderColor: 'red',
    borderStyle: 'round',
    margin: { top: 1, bottom: 1 }
  });
}

/**
 * Display a formatted error to the console
 * @param {Error} error - The error to display
 * @param {Object} options - Display options
 */
function displayError(error, options = {}) {
  console.error(formatError(error, options));
}

/**
 * Create a formatted error object for JSON output
 * @param {Error} error - The error to format
 * @param {Object} options - Formatting options
 * @returns {Object} Formatted error object
 */
function formatErrorJson(error, options = {}) {
  const { sanitize = true } = options;
  const errorType = classifyError(error);
  let message = error.message || 'An unknown error occurred';
  
  if (sanitize) {
    message = sanitizeMessage(message);
  }

  return {
    success: false,
    error: {
      type: errorType,
      message,
      code: error.code || null,
      hints: getHints(errorType, error)
    }
  };
}

export {
  ERROR_TYPES,
  sanitizeMessage,
  classifyError,
  getHints,
  formatError,
  displayError,
  formatErrorJson
};

export default {
  ERROR_TYPES,
  sanitizeMessage,
  classifyError,
  getHints,
  formatError,
  displayError,
  formatErrorJson
};
