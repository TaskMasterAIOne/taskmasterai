/**
 * Tag Management Tools
 * MCP tools for managing task tags/contexts
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

/**
 * Register tag-related tools with the MCP server
 * @param {import('fastmcp').FastMCP} server - FastMCP server instance
 */
export function registerTagTools(server) {
  // list_tags - List all tags
  server.addTool({
    name: 'list_tags',
    description: 'List all available tags',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('list-tags', async (args, context) => {
      const { getAllTags, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Listing tags');
        const tags = getAllTags(projectRoot);
        const current = getCurrentTag(projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: { currentTag: current, tags },
          },
          log,
          projectRoot,
          tag: current,
        });
      } catch (error) {
        log.error(`Error in list-tags: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // add_tag - Create a new tag
  server.addTool({
    name: 'add_tag',
    description: 'Create a new tag',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      name: z.string().describe('Tag name'),
      copyFrom: z.string().optional().describe('Copy tasks from this tag'),
      copyFromCurrent: z.boolean().optional().describe('Copy tasks from current tag'),
      description: z.string().optional().describe('Tag description'),
    }),
    execute: withToolContext('add-tag', async (args, context) => {
      const { createTag, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { name, copyFrom, copyFromCurrent, description } = args;
      
      try {
        log.info(`Creating tag '${name}'`);
        
        createTag(name, {
          copyFrom,
          copyFromCurrent,
          description,
        }, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              name,
              copiedFrom: copyFrom || (copyFromCurrent ? 'current' : null),
              message: `Created tag '${name}'`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in add-tag: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // delete_tag - Delete a tag
  server.addTool({
    name: 'delete_tag',
    description: 'Delete a tag and all its tasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      name: z.string().describe('Tag name'),
    }),
    execute: withToolContext('delete-tag', async (args, context) => {
      const { deleteTagData, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { name } = args;
      
      try {
        log.info(`Deleting tag '${name}'`);
        deleteTagData(name, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              deleted: name,
              message: `Deleted tag '${name}'`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in delete-tag: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // use_tag - Switch to a tag
  server.addTool({
    name: 'use_tag',
    description: 'Switch to a different tag',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      name: z.string().describe('Tag name'),
    }),
    execute: withToolContext('use-tag', async (args, context) => {
      const { switchTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { name } = args;
      
      try {
        log.info(`Switching to tag '${name}'`);
        switchTag(name, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              currentTag: name,
              message: `Switched to tag '${name}'`,
            },
          },
          log,
          projectRoot,
          tag: name,
        });
      } catch (error) {
        log.error(`Error in use-tag: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // rename_tag - Rename a tag
  server.addTool({
    name: 'rename_tag',
    description: 'Rename a tag',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      oldName: z.string().describe('Current tag name'),
      newName: z.string().describe('New tag name'),
    }),
    execute: withToolContext('rename-tag', async (args, context) => {
      const { renameTag, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { oldName, newName } = args;
      
      try {
        log.info(`Renaming tag '${oldName}' to '${newName}'`);
        renameTag(oldName, newName, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              oldName,
              newName,
              message: `Renamed tag '${oldName}' to '${newName}'`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in rename-tag: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // copy_tag - Copy a tag
  server.addTool({
    name: 'copy_tag',
    description: 'Copy a tag with all its tasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      source: z.string().describe('Source tag name'),
      target: z.string().describe('Target tag name'),
      description: z.string().optional().describe('Description for new tag'),
    }),
    execute: withToolContext('copy-tag', async (args, context) => {
      const { copyTag, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { source, target, description } = args;
      
      try {
        log.info(`Copying tag '${source}' to '${target}'`);
        copyTag(source, target, { description }, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              source,
              target,
              message: `Copied tag '${source}' to '${target}'`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in copy-tag: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
