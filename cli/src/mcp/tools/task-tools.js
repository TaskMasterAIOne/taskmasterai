
import { z } from 'zod';
import { handleApiResult, withToolContext, withAIToolContext } from '../utils.js';

export function registerTaskTools(server, options = {}) {
  const { coreOnly = false } = options;
  // get_tasks - List all tasks
  server.addTool({
    name: 'get_tasks',
    description: 'List all tasks in the current project, optionally filtered by status',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      status: z.string().optional().describe('Filter by status (comma-separated)'),
      withSubtasks: z.boolean().optional().describe('Include subtasks in output'),
    }),
    execute: withToolContext('get-tasks', async (args, context) => {
      const { getAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { status, withSubtasks } = args;
      
      try {
        log.info(`Getting tasks from ${projectRoot}${status ? ` with status filter: ${status}` : ''}`);
        let tasks = getAllTasks(projectRoot);
        
        if (status) {
          const statuses = status.split(',').map(s => s.trim());
          tasks = tasks.filter(t => statuses.includes(t.status));
        }
        
        const formattedTasks = tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dependencies: t.dependencies,
          subtaskCount: t.subtasks?.length || 0,
          ...(withSubtasks && t.subtasks ? {
            subtasks: t.subtasks.map(s => ({
              id: s.id,
              title: s.title,
              status: s.status,
            })),
          } : {}),
        }));
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProgress = tasks.filter(t => t.status === 'in-progress').length;
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              tasks: formattedTasks,
              filter: status || 'all',
              stats: {
                total,
                completed: done,
                pending,
                inProgress,
                completionPercentage: total > 0 ? Math.round((done / total) * 100) : 0,
              },
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in get-tasks: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // add_task - Add a new task
  server.addTool({
    name: 'add_task',
    description: 'Add a new task using AI to structure it',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      prompt: z.string().describe('Task description'),
      priority: z.enum(['high', 'medium', 'low']).optional().describe('Task priority'),
      dependencies: z.string().optional().describe('Comma-separated dependency IDs'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withAIToolContext('add-task', 'tasksAdded', async (args, context) => {
      const { addTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { generateTask } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { prompt, priority, dependencies, research } = args;
      
      try {
        log.info(`Adding new task: ${prompt.substring(0, 50)}...`);
        
        const deps = dependencies
          ? dependencies.split(',').map(id => parseInt(id.trim()))
          : [];
        
        const taskData = await generateTask(prompt, {
          priority: priority || 'medium',
          dependencies: deps,
          research,
        });
        
        const newTask = addTask(taskData, projectRoot);
        log.info(`Created task ${newTask.id}`);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              id: newTask.id,
              title: newTask.title,
              status: newTask.status,
              priority: newTask.priority,
              message: `Created task ${newTask.id}`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in add-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // update_task - Update a task (with optional metadata when TASK_MASTER_ALLOW_METADATA_UPDATES=true)
  server.addTool({
    name: 'update_task',
    description: 'Update a task with new information. Metadata updates require TASK_MASTER_ALLOW_METADATA_UPDATES=true.',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID'),
      prompt: z.string().optional().describe('Update information'),
      append: z.boolean().optional().describe('Append to details instead of replacing'),
      research: z.boolean().optional().describe('Use research model'),
      metadata: z.string().optional().describe('JSON string of metadata to set (requires TASK_MASTER_ALLOW_METADATA_UPDATES=true)'),
    }),
    execute: withToolContext('update-task', async (args, context) => {
      const { findTaskById, updateTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, prompt, append, metadata } = args;
      
      try {
        const task = findTaskById(id, projectRoot);
        if (!task) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        log.info(`Updating task ${id}`);
        
        const updates = {};

        if (prompt) {
          if (append) {
            const timestamp = new Date().toISOString();
            updates.details = (task.details || '') + `\n\n--- Update [${timestamp}] ---\n${prompt}`;
          } else {
            updates.details = prompt;
          }
        }

        if (metadata) {
          if (process.env.TASK_MASTER_ALLOW_METADATA_UPDATES !== 'true') {
            return handleApiResult({
              result: {
                success: false,
                error: { message: 'Metadata updates require TASK_MASTER_ALLOW_METADATA_UPDATES=true in env.' },
              },
              log,
              projectRoot,
            });
          }
          try {
            updates.metadata = JSON.parse(metadata);
          } catch (_) {
            return handleApiResult({
              result: { success: false, error: { message: 'Invalid JSON in metadata parameter.' } },
              log,
              projectRoot,
            });
          }
        }

        updateTask(id, updates, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: { id, metadataUpdated: !!metadata, message: 'Task updated' },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in update-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // remove_task - Remove a task
  server.addTool({
    name: 'remove_task',
    description: 'Remove a task or subtask',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task or subtask ID'),
    }),
    execute: withToolContext('remove-task', async (args, context) => {
      const { deleteTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id } = args;
      
      try {
        log.info(`Removing task ${id}`);
        const result = deleteTask(id, projectRoot);
        
        if (result) {
          return handleApiResult({
            result: {
              success: true,
              data: { id, message: `Removed task ${id}` },
            },
            log,
            projectRoot,
            tag: getCurrentTag(projectRoot),
          });
        }
        
        return handleApiResult({
          result: { success: false, error: { message: `Task ${id} not found` } },
          log,
          projectRoot,
        });
      } catch (error) {
        log.error(`Error in remove-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // add_subtask - Add a subtask
  server.addTool({
    name: 'add_subtask',
    description: 'Add a subtask to a parent task',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      parent: z.string().describe('Parent task ID'),
      title: z.string().describe('Subtask title'),
      description: z.string().optional().describe('Subtask description'),
      details: z.string().optional().describe('Implementation details'),
      status: z.string().optional().describe('Initial status'),
    }),
    execute: withToolContext('add-subtask', async (args, context) => {
      const { addSingleSubtask, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { parent, title, description, details, status } = args;
      
      try {
        log.info(`Adding subtask to task ${parent}`);
        
        const result = addSingleSubtask(parent, {
          title,
          description: description || '',
          details: details || '',
          status: status || 'pending',
        }, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              parentId: parent,
              subtaskId: `${parent}.${result.subtask.id}`,
              title: result.subtask.title,
              message: `Added subtask ${parent}.${result.subtask.id}`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in add-subtask: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // move_task - Move a task
  server.addTool({
    name: 'move_task',
    description: 'Move a task or subtask to a new position',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      from: z.string().describe('Source task/subtask ID'),
      to: z.string().describe('Destination task/subtask ID'),
    }),
    execute: withToolContext('move-task', async (args, context) => {
      const { moveTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { from, to } = args;
      
      try {
        log.info(`Moving task ${from} to ${to}`);
        moveTask(from, to, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: { from, to, message: `Moved ${from} to ${to}` },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in move-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // update - Batch update tasks
  server.addTool({
    name: 'update',
    description: 'Batch update multiple tasks from a specific ID',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      from: z.string().describe('Starting task ID'),
      prompt: z.string().describe('Update context/changes'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    // Count function for batch updates - counts tasks that will be updated
    execute: withAIToolContext('update', 'aiOperations', async (args, context) => {
      const { getAllTasks, updateTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { batchUpdateTasks } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { from, prompt, research } = args;
      
      try {
        const tasks = getAllTasks(projectRoot);
        const fromId = parseInt(from);
        
        log.info(`Batch updating tasks from ID ${fromId}`);
        
        const updates = await batchUpdateTasks(tasks, fromId, prompt, { research });
        
        for (const update of updates) {
          updateTask(update.id, {
            title: update.title,
            description: update.description,
            details: update.details,
            testStrategy: update.testStrategy,
          }, projectRoot);
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              updatedCount: updates.length,
              taskIds: updates.map(u => u.id),
              message: `Updated ${updates.length} task(s)`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in update: ${error.message}`);
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

  // remove_subtask - Remove a single subtask
  server.addTool({
    name: 'remove_subtask',
    description: 'Remove a single subtask from a task',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Subtask ID (e.g., 1.2)'),
    }),
    execute: withToolContext('remove-subtask', async (args, context) => {
      const { getAllTasks, saveAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id } = args;
      
      try {
        if (!id.includes('.')) {
          return handleApiResult({
            result: { success: false, error: { message: 'ID must be a subtask ID (e.g., 1.2)' } },
            log,
            projectRoot,
          });
        }
        
        const [parentId, subtaskId] = id.split('.').map(Number);
        const tasks = getAllTasks(projectRoot);
        const parent = tasks.find(t => t.id === parentId);
        
        if (!parent) {
          return handleApiResult({
            result: { success: false, error: { message: `Parent task ${parentId} not found` } },
            log,
            projectRoot,
          });
        }
        
        if (!parent.subtasks) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${parentId} has no subtasks` } },
            log,
            projectRoot,
          });
        }
        
        const subtaskIndex = parent.subtasks.findIndex(s => s.id === subtaskId);
        if (subtaskIndex === -1) {
          return handleApiResult({
            result: { success: false, error: { message: `Subtask ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        const removedSubtask = parent.subtasks.splice(subtaskIndex, 1)[0];
        saveAllTasks(tasks, projectRoot);
        
        log.info(`Removed subtask ${id}`);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              removed: id,
              title: removedSubtask.title,
              message: `Removed subtask ${id}`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in remove-subtask: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
