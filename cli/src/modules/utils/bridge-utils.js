
import { log as consoleLog, isSilentMode } from '../utils.js';
import { getDebugFlag } from '../config-manager.js';

export function createBridgeLogger(mcpLog, session) {
  const isMCP = !!mcpLog;
  const logger = mcpLog || {
    info: (msg) => !isSilentMode() && consoleLog('info', msg),
    warn: (msg) => !isSilentMode() && consoleLog('warn', msg),
    error: (msg) => !isSilentMode() && consoleLog('error', msg),
    debug: (msg) =>
      !isSilentMode() && getDebugFlag(session) && consoleLog('debug', msg),
    success: (msg) => !isSilentMode() && consoleLog('success', msg)
  };
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

export function createContextAwareWrapper(fn, options = {}) {
  const { defaultOutputFormat = 'text' } = options;

  return async function wrappedFunction(...args) {
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

export function normalizeProjectRoot(projectRoot, findProjectRoot) {
  if (projectRoot && typeof projectRoot === 'string') {
    return projectRoot;
  }
  
  if (typeof findProjectRoot === 'function') {
    return findProjectRoot() || process.cwd();
  }
  
  return process.cwd();
}

export function createLogWrapper(logMethods) {
  return {
    info: (...args) => logMethods.info?.(...args) || console.log(...args),
    warn: (...args) => logMethods.warn?.(...args) || console.warn(...args),
    error: (...args) => logMethods.error?.(...args) || console.error(...args),
    debug: (...args) => logMethods.debug?.(...args) || console.log(...args),
    success: (...args) => logMethods.success?.(...args) || console.log(...args)
  };
}

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

export function isMCPContext(context) {
  return !!(context && (context.mcpLog || context.session));
}

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
