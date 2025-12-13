/**
 * Dependency Management Tools
 * MCP tools for managing task dependencies
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

/**
 * Register dependency-related tools with the MCP server
 * @param {import('fastmcp').FastMCP} server - FastMCP server instance
 * @param {Object} options - Registration options
 * @param {boolean} options.coreOnly - Only register core tools
 */
export function registerDependencyTools(server, options = {}) {
  const { coreOnly = false } = options;

  // add_dependency - Add a dependency
  server.addTool({
    name: 'add_dependency',
    description: 'Add a dependency to a task',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID'),
      dependsOn: z.string().describe('Dependency task ID'),
    }),
    execute: withToolContext('add-dependency', async (args, context) => {
      const { addDependency, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, dependsOn } = args;
      
      try {
        log.info(`Adding dependency: ${id} depends on ${dependsOn}`);
        const result = addDependency(id, dependsOn, projectRoot);
        
        if (result) {
          return handleApiResult({
            result: {
              success: true,
              data: {
                taskId: id,
                dependsOn,
                message: `Task ${id} now depends on task ${dependsOn}`,
              },
            },
            log,
            projectRoot,
            tag: getCurrentTag(projectRoot),
          });
        }
        
        return handleApiResult({
          result: { success: false, error: { message: 'Task(s) not found' } },
          log,
          projectRoot,
        });
      } catch (error) {
        log.error(`Error in add-dependency: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // remove_dependency - Remove a dependency
  server.addTool({
    name: 'remove_dependency',
    description: 'Remove a dependency from a task',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID'),
      dependsOn: z.string().describe('Dependency task ID to remove'),
    }),
    execute: withToolContext('remove-dependency', async (args, context) => {
      const { removeDependency, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, dependsOn } = args;
      
      try {
        log.info(`Removing dependency: ${id} no longer depends on ${dependsOn}`);
        const result = removeDependency(id, dependsOn, projectRoot);
        
        if (result) {
          return handleApiResult({
            result: {
              success: true,
              data: {
                taskId: id,
                removed: dependsOn,
                message: `Removed dependency on task ${dependsOn}`,
              },
            },
            log,
            projectRoot,
            tag: getCurrentTag(projectRoot),
          });
        }
        
        return handleApiResult({
          result: { success: false, error: { message: 'Task not found' } },
          log,
          projectRoot,
        });
      } catch (error) {
        log.error(`Error in remove-dependency: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // Stop here for core tier
  if (coreOnly) return;

  // validate_dependencies - Validate all dependencies
  server.addTool({
    name: 'validate_dependencies',
    description: 'Validate all task dependencies',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('validate-dependencies', async (args, context) => {
      const { validateDependencies, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Validating dependencies');
        const issues = validateDependencies(projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              valid: issues.length === 0,
              issueCount: issues.length,
              issues,
              message: issues.length === 0
                ? 'All dependencies are valid'
                : `Found ${issues.length} dependency issue(s)`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in validate-dependencies: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // fix_dependencies - Fix dependency issues
  server.addTool({
    name: 'fix_dependencies',
    description: 'Automatically fix dependency issues',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('fix-dependencies', async (args, context) => {
      const { fixDependencies, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Fixing dependencies');
        const result = fixDependencies(projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              fixedCount: result.fixedCount,
              message: result.fixedCount > 0
                ? `Fixed dependencies in ${result.fixedCount} task(s)`
                : 'No dependency issues to fix',
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in fix-dependencies: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
