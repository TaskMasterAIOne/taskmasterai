
import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../lib/config.js';
import { getLicenseStatus } from '../lib/license.js';
import { enforceUsageLimit, incrementUsage } from '../lib/usage.js';

export function getVersionInfo() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return {
        version: pkg.version || '1.0.0',
        name: pkg.name || 'taskmaster-ai',
      };
    }
  } catch {
    // Ignore errors
  }
  return { version: '1.0.0', name: 'taskmaster-ai' };
}

export function getCurrentTag(projectRoot) {
  try {
    const stateJsonPath = path.join(projectRoot, '.taskmaster-ai', 'state.json');
    if (fs.existsSync(stateJsonPath)) {
      const stateData = JSON.parse(fs.readFileSync(stateJsonPath, 'utf-8'));
      return stateData.currentTag || 'master';
    }
    return 'master';
  } catch {
    return 'master';
  }
}

export function normalizeProjectRoot(rawPath) {
  if (!rawPath) return process.cwd();

  try {
    let pathString = rawPath;

    // Decode URI encoding
    try {
      pathString = decodeURIComponent(pathString);
    } catch {
    }

    // Strip file:// prefix
    if (pathString.startsWith('file:///')) {
      pathString = pathString.slice(7);
    } else if (pathString.startsWith('file://')) {
      pathString = pathString.slice(7);
    }

    // Handle Windows drive letter after stripping prefix
    if (pathString.startsWith('/') && /[A-Za-z]:/.test(pathString.substring(1, 3))) {
      pathString = pathString.substring(1);
    }

    // Normalize backslashes to forward slashes
    pathString = pathString.replace(/\\/g, '/');

    return path.resolve(pathString);
  } catch {
    return path.resolve(rawPath);
  }
}

export function getProjectRoot(argsProjectRoot, session = null) {
  // 1. Check env variable
  if (process.env.TASK_MASTER_PROJECT_ROOT) {
    const envRoot = process.env.TASK_MASTER_PROJECT_ROOT;
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(process.cwd(), envRoot);
  }

  // 2. Check args.projectRoot
  if (argsProjectRoot) {
    return normalizeProjectRoot(argsProjectRoot);
  }

  // 3. Try session
  if (session?.roots?.[0]?.uri) {
    return normalizeProjectRoot(session.roots[0].uri);
  }

  // 4. Try to find project root from cwd
  const foundRoot = findProjectRoot();
  if (foundRoot) return foundRoot;

  // 5. Fall back to cwd
  return process.cwd();
}

export function createContentResponse(content) {
  return {
    content: [
      {
        type: 'text',
        text: typeof content === 'object'
          ? JSON.stringify(content, null, 2)
          : String(content),
      },
    ],
  };
}

export function handleApiResult(options) {
  const {
    result,
    log,
    errorPrefix = 'API error',
    projectRoot,
    tag: providedTag,
  } = options;

  const versionInfo = getVersionInfo();
  const currentTag = providedTag !== undefined
    ? providedTag
    : projectRoot
      ? getCurrentTag(projectRoot)
      : null;

  if (!result.success) {
    const errorMsg = result.error?.message || `Unknown ${errorPrefix}`;
    log?.error?.(`${errorPrefix}: ${errorMsg}`);

    let errorText = `Error: ${errorMsg}\nVersion: ${versionInfo.version}\nName: ${versionInfo.name}`;
    if (currentTag) {
      errorText += `\nCurrent Tag: ${currentTag}`;
    }

    return {
      content: [{ type: 'text', text: errorText }],
      isError: true,
    };
  }

  log?.info?.('Successfully completed operation');

  const responsePayload = {
    data: result.data,
    version: versionInfo,
  };

  if (currentTag) {
    responsePayload.tag = currentTag;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(responsePayload, null, 2),
      },
    ],
  };
}

export function withNormalizedProjectRoot(fn) {
  return async (args, context) => {
    const { log, session } = context;
    
    try {
      const normalizedRoot = getProjectRoot(args.projectRoot, session);
      
      if (!normalizedRoot) {
        log?.error?.('Could not determine project root');
        return handleApiResult({
          result: {
            success: false,
            error: {
              message: 'Could not determine project root. Please provide projectRoot argument.',
            },
          },
        });
      }

      const updatedArgs = { ...args, projectRoot: normalizedRoot };
      return await fn(updatedArgs, context);
    } catch (error) {
      log?.error?.(`Error in withNormalizedProjectRoot: ${error.message}`);
      return handleApiResult({
        result: {
          success: false,
          error: { message: `Operation failed: ${error.message}` },
        },
      });
    }
  };
}

export function withToolContext(commandName, executeFn) {
  return withNormalizedProjectRoot(async (args, context) => {
    const enhancedContext = {
      log: context.log,
      session: context.session,
      projectRoot: args.projectRoot,
    };
    
    return executeFn(args, enhancedContext);
  });
}

export function withAIToolContext(commandName, operationType, executeFn, options = {}) {
  const { countFn = () => 1 } = options;
  
  return withNormalizedProjectRoot(async (args, context) => {
    const { log } = context;
    try {
      const licenseStatus = await getLicenseStatus();
      if (!licenseStatus.valid) {
        log?.error?.(`License validation failed: ${licenseStatus.error}`);
        return handleApiResult({
          result: {
            success: false,
            error: {
              message: licenseStatus.error || 'Invalid or expired license. Please activate a valid license key.',
              code: 'LICENSE_INVALID',
            },
          },
          log,
        });
      }
    } catch (licenseError) {
      log?.warn?.(`License check warning: ${licenseError.message}`);
      // Continue - license check is best-effort for offline mode
    }
    const operationCount = countFn(args);
    try {
      enforceUsageLimit(operationCount);
    } catch (usageError) {
      log?.error?.(`Usage limit error: ${usageError.message}`);
      return handleApiResult({
        result: {
          success: false,
          error: {
            message: usageError.message,
            code: 'USAGE_LIMIT_EXCEEDED',
          },
        },
        log,
      });
    }
    
    const enhancedContext = {
      log: context.log,
      session: context.session,
      projectRoot: args.projectRoot,
    };
    const result = await executeFn(args, enhancedContext);
    if (!result.isError) {
      incrementUsage(operationType, operationCount)
        .catch(err => log?.warn?.(`Usage tracking failed: ${err.message}`));
    }
    
    return result;
  });
}

// ============================================
// LEGACY HELPERS (for backwards compatibility)
// ============================================

export function successResponse(data, message) {
  return {
    success: true,
    data,
    message,
  };
}

export function errorResponse(message, details) {
  return {
    success: false,
    error: { message, details },
  };
}

export function parseIds(idString) {
  return idString.split(',').map(id => id.trim());
}

export function formatTask(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dependencies: task.dependencies,
    subtaskCount: task.subtasks?.length || 0,
  };
}

export function formatTaskDetailed(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dependencies: task.dependencies,
    details: task.details,
    testStrategy: task.testStrategy,
    subtasks: task.subtasks?.map(s => ({
      id: s.id,
      title: s.title,
      status: s.status,
    })),
  };
}
