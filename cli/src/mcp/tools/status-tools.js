
import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

export function registerStatusTools(server, options = {}) {
  // All status tools are core tools, so coreOnly doesn't filter anything here
  // But we include the parameter for consistency with other tool registrations
  // next_task - Get next task to work on
  server.addTool({
    name: 'next_task',
    description: 'Get the next task to work on based on dependencies and priority',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('next-task', async (args, context) => {
      const { getNextTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info(`Getting next task from ${projectRoot}`);
        const task = getNextTask(projectRoot);
        const currentTag = getCurrentTag(projectRoot);
        
        if (!task) {
          return handleApiResult({
            result: {
              success: true,
              data: {
                hasNext: false,
                message: 'All tasks completed or no pending tasks with satisfied dependencies',
              },
            },
            log,
            projectRoot,
            tag: currentTag,
          });
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              hasNext: true,
              task: {
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dependencies: task.dependencies,
                details: task.details,
                subtasks: task.subtasks?.map(s => ({
                  id: s.id,
                  title: s.title,
                  status: s.status,
                })),
              },
              suggestedActions: [
                `Set status to in-progress: taskmaster set-status --id ${task.id} --status in-progress`,
                task.subtasks?.length
                  ? `View subtasks: taskmaster show ${task.id}`
                  : `Expand into subtasks: taskmaster expand --id ${task.id}`,
              ],
            },
          },
          log,
          projectRoot,
          tag: currentTag,
        });
      } catch (error) {
        log.error(`Error in next-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // set_task_status - Update task status
  server.addTool({
    name: 'set_task_status',
    description: 'Update the status of one or more tasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID or comma-separated IDs'),
      status: z.string().describe('New status (pending, in-progress, done, blocked, cancelled, deferred)'),
    }),
    execute: withToolContext('set-status', async (args, context) => {
      const { setTaskStatus, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, status } = args;
      
      try {
        const validStatuses = ['pending', 'in-progress', 'done', 'blocked', 'cancelled', 'deferred'];
        if (!validStatuses.includes(status)) {
          return handleApiResult({
            result: {
              success: false,
              error: { message: `Invalid status. Use one of: ${validStatuses.join(', ')}` },
            },
            log,
            projectRoot,
          });
        }
        
        const ids = id.split(',').map(i => i.trim());
        log.info(`Setting status '${status}' for ${ids.length} task(s)`);
        
        const results = [];
        for (const taskId of ids) {
          const result = setTaskStatus(taskId, status, projectRoot);
          results.push({ id: taskId, success: !!result });
        }
        
        const successCount = results.filter(r => r.success).length;
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              updated: results,
              message: `Updated ${successCount}/${ids.length} task(s)`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in set-status: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // update_subtask - Append notes to subtask
  server.addTool({
    name: 'update_subtask',
    description: 'Append timestamped notes to a subtask',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Subtask ID (e.g., 1.2)'),
      prompt: z.string().describe('Notes to append'),
    }),
    execute: withToolContext('update-subtask', async (args, context) => {
      const { findTaskById, getAllTasks, saveAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, prompt } = args;
      
      try {
        if (!id.includes('.')) {
          return handleApiResult({
            result: {
              success: false,
              error: { message: 'ID must be a subtask ID (e.g., 1.2)' },
            },
            log,
            projectRoot,
          });
        }
        
        const task = findTaskById(id, projectRoot);
        if (!task) {
          return handleApiResult({
            result: { success: false, error: { message: `Subtask ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        const timestamp = new Date().toISOString();
        const newNote = `\n\n--- Update [${timestamp}] ---\n${prompt}`;
        
        const [parentId, subtaskId] = id.split('.').map(Number);
        const tasks = getAllTasks(projectRoot);
        const parent = tasks.find(t => t.id === parentId);
        
        if (parent && parent.subtasks) {
          const subtask = parent.subtasks.find(s => s.id === subtaskId);
          if (subtask) {
            subtask.details = (subtask.details || '') + newNote;
            saveAllTasks(tasks, projectRoot);
          }
        }
        
        log.info(`Appended note to subtask ${id}`);
        
        return handleApiResult({
          result: {
            success: true,
            data: { id, timestamp, message: `Appended note to subtask ${id}` },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in update-subtask: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // get_task - Get task details
  server.addTool({
    name: 'get_task',
    description: 'Get detailed information about a specific task or subtask',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID or comma-separated IDs'),
    }),
    execute: withToolContext('get-task', async (args, context) => {
      const { findTaskById, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id } = args;
      
      try {
        const ids = id.split(',').map(i => i.trim());
        log.info(`Getting ${ids.length} task(s)`);
        
        const tasks = ids.map(taskId => {
          const task = findTaskById(taskId, projectRoot);
          if (!task) return { id: taskId, error: 'not found' };
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
              description: s.description,
              details: s.details,
            })),
          };
        });
        
        return handleApiResult({
          result: {
            success: true,
            data: ids.length === 1 ? tasks[0] : { tasks },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in get-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
