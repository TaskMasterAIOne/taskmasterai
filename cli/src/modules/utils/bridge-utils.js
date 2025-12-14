/**
 * Bridge Utilities Module
 * Utilities for bridging MCP and CLI contexts
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import { log as consoleLog, isSilentMode } from '../utils.js';
import { getDebugFlag } from '../config-manager.js';

/**
 * Create a unified logger and report function for bridge operations
 * Handles both MCP and CLI contexts consistently
 *
 * @param {Object} mcpLog - Optional MCP logger object
 * @param {Object} [session] - Optional session object for debug flag checking
 * @returns {Object} Object containing logger, report function, and isMCP flag
 */
export function createBridgeLogger(mcpLog, session) {
  const isMCP = !!mcpLog;

  // Create logger that works in both contexts
  const logger = mcpLog || {
    info: (msg) => !isSilentMode() && consoleLog('info', msg),
    warn: (msg) => !isSilentMode() && consoleLog('warn', msg),
    error: (msg) => !isSilentMode() && consoleLog('error', msg),
    debug: (msg) =>
      !isSilentMode() && getDebugFlag(session) && consoleLog('debug', msg),
    success: (msg) => !isSilentMode() && consoleLog('success', msg)
  };

  // Create report function compatible with bridge
  const report = (level, ...args) => {
    if (isMCP) {
      if (typeof logger[level] === 'function') logger[level](...args);
      else logger.info(...args);
    } else if (!isSilentMode()) {
      consoleLog(level, ...args);
    }
  };

  return { logger, report, isMCP };
}

/**
 * Create a context-aware function wrapper
 * Automatically handles MCP vs CLI output formats
 *
 * @param {Function} fn - The function to wrap
 * @param {Object} options - Wrapper options
 * @returns {Function} Wrapped function
 */
export function createContextAwareWrapper(fn, options = {}) {
  const { defaultOutputFormat = 'text' } = options;

  return async function wrappedFunction(...args) {
    // Check if last argument is options object with context info
    const lastArg = args[args.length - 1];
    const hasContext = lastArg && typeof lastArg === 'object' && 
                       (lastArg.mcpLog !== undefined || lastArg.session !== undefined);
    
    if (hasContext) {
      const context = lastArg;
      const outputFormat = context.mcpLog ? 'json' : (context.outputFormat || defaultOutputFormat);
      args[args.length - 1] = { ...context, outputFormat };
    }

    return fn(...args);
  };
}

/**
 * Normalize project root path
 * Handles both CLI and MCP contexts
 *
 * @param {string|undefined} projectRoot - Provided project root
 * @param {Function} findProjectRoot - Function to find project root
 * @returns {string} Normalized project root
 */
export function normalizeProjectRoot(projectRoot, findProjectRoot) {
  if (projectRoot && typeof projectRoot === 'string') {
    return projectRoot;
  }
  
  if (typeof findProjectRoot === 'function') {
    return findProjectRoot() || process.cwd();
  }
  
  return process.cwd();
}

/**
 * Create MCP-compatible log wrapper from console log function
 *
 * @param {Object} logMethods - Object with log methods
 * @returns {Object} MCP-compatible logger
 */
export function createLogWrapper(logMethods) {
  return {
    info: (...args) => logMethods.info?.(...args) || console.log(...args),
    warn: (...args) => logMethods.warn?.(...args) || console.warn(...args),
    error: (...args) => logMethods.error?.(...args) || console.error(...args),
    debug: (...args) => logMethods.debug?.(...args) || console.log(...args),
    success: (...args) => logMethods.success?.(...args) || console.log(...args)
  };
}

/**
 * Handle API result for both MCP and CLI contexts
 *
 * @param {Object} result - The result to handle
 * @param {Object} logger - Logger object
 * @returns {Object} Processed result
 */
export function handleApiResult(result, logger) {
  if (result.success) {
    return result;
  }

  // Log error if logger available
  if (logger && result.error) {
    if (typeof logger.error === 'function') {
      logger.error(result.error.message || result.error);
    }
  }

  return result;
}

/**
 * Check if running in MCP context
 *
 * @param {Object} context - Context object
 * @returns {boolean} True if MCP context
 */
export function isMCPContext(context) {
  return !!(context && (context.mcpLog || context.session));
}

/**
 * Get output format based on context
 *
 * @param {Object} context - Context object
 * @param {string} defaultFormat - Default format if not determinable
 * @returns {string} Output format ('json' or 'text')
 */
export function getOutputFormat(context, defaultFormat = 'text') {
  if (!context) return defaultFormat;
  
  // Explicit outputFormat takes precedence
  if (context.outputFormat) return context.outputFormat;
  
  // MCP context defaults to JSON
  if (isMCPContext(context)) return 'json';
  
  return defaultFormat;
}

export default {
  createBridgeLogger,
  createContextAwareWrapper,
  normalizeProjectRoot,
  createLogWrapper,
  handleApiResult,
  isMCPContext,
  getOutputFormat
};
