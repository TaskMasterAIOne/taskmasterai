/**
 * Analysis Tools
 * MCP tools for PRD parsing, task expansion, and complexity analysis
 */

import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { handleApiResult, withToolContext } from '../utils.js';

/**
 * Register analysis-related tools with the MCP server
 * @param {import('fastmcp').FastMCP} server - FastMCP server instance
 * @param {Object} options - Registration options
 * @param {boolean} options.coreOnly - Only register core tools (for 'core' tier)
 */
export function registerAnalysisTools(server, options = {}) {
  const { coreOnly = false } = options;

  // parse_prd - Parse PRD and generate tasks (always included)
  server.addTool({
    name: 'plan',
    description: 'Parse a PRD file and generate tasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      input: z.string().describe('Path to PRD file'),
      numTasks: z.number().optional().describe('Number of tasks to generate'),
      force: z.boolean().optional().describe('Overwrite existing tasks'),
      append: z.boolean().optional().describe('Append to existing tasks'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withToolContext('parse-prd', async (args, context) => {
      const { getAllTasks, saveAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { generateTasksFromPRD } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { input, numTasks, force, append, research } = args;
      
      try {
        const prdPath = path.isAbsolute(input) ? input : path.join(projectRoot, input);
        
        if (!fs.existsSync(prdPath)) {
          return handleApiResult({
            result: { success: false, error: { message: `File not found: ${input}` } },
            log,
            projectRoot,
          });
        }
        
        const existingTasks = getAllTasks(projectRoot);
        if (existingTasks.length > 0 && !force && !append) {
          return handleApiResult({
            result: {
              success: false,
              error: { message: 'Tasks already exist. Use force=true to overwrite or append=true to add.' },
            },
            log,
            projectRoot,
          });
        }
        
        log.info(`Parsing PRD from ${input}`);
        const prdContent = fs.readFileSync(prdPath, 'utf-8');
        const tasks = await generateTasksFromPRD(prdContent, {
          numTasks: numTasks || 10,
          research,
        });
        
        let finalTasks;
        if (append) {
          const maxId = existingTasks.length > 0
            ? Math.max(...existingTasks.map(t => t.id))
            : 0;
          finalTasks = [
            ...existingTasks,
            ...tasks.map((t, i) => ({ ...t, id: maxId + i + 1 })),
          ];
        } else {
          finalTasks = tasks.map((t, i) => ({ ...t, id: i + 1 }));
        }
        
        saveAllTasks(finalTasks, projectRoot);
        log.info(`Generated ${tasks.length} tasks`);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              tasksGenerated: tasks.length,
              totalTasks: finalTasks.length,
              message: `Generated ${tasks.length} tasks from PRD`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in parse-prd: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // expand_task - Expand task into subtasks (always included)
  server.addTool({
    name: 'breakdown_task',
    description: 'Expand a task into subtasks using AI',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID to expand'),
      num: z.number().optional().describe('Number of subtasks'),
      prompt: z.string().optional().describe('Additional context'),
      force: z.boolean().optional().describe('Replace existing subtasks'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withToolContext('expand-task', async (args, context) => {
      const { findTaskById, addSubtasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { expandTask: aiExpandTask } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { id, num, prompt, force, research } = args;
      
      try {
        const task = findTaskById(id, projectRoot);
        if (!task) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        log.info(`Expanding task ${id}`);
        const subtasks = await aiExpandTask(task, {
          numSubtasks: num || 5,
          research,
          prompt,
        });
        
        addSubtasks(id, subtasks, force, projectRoot);
        log.info(`Added ${subtasks.length} subtasks to task ${id}`);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              taskId: id,
              subtasksCreated: subtasks.length,
              subtasks: subtasks.map((s, i) => ({ id: i + 1, title: s.title })),
              message: `Added ${subtasks.length} subtasks to task ${id}`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in expand-task: ${error.message}`);
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

  // initialize_project - Initialize TaskMaster
  server.addTool({
    name: 'initialize_project',
    description: 'Initialize TaskMaster in the current project',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      name: z.string().optional().describe('Project name'),
      description: z.string().optional().describe('Project description'),
    }),
    execute: withToolContext('init', async (args, context) => {
      const { ensureProjectConfigDir, writeProjectConfig, getDefaultConfig, getTasksFilePath } = 
        await import('../../lib/config.js');
      const { projectRoot, log } = context;
      const { name, description } = args;
      
      try {
        log.info(`Initializing TaskMaster in ${projectRoot}`);
        
        ensureProjectConfigDir(projectRoot);
        
        const config = getDefaultConfig();
        config.projectName = name || path.basename(projectRoot);
        config.projectDescription = description || '';
        writeProjectConfig(config, projectRoot);
        
        const tasksPath = getTasksFilePath(projectRoot);
        const initialTasks = {
          tags: {
            master: {
              tasks: [],
              metadata: { createdAt: new Date().toISOString() },
            },
          },
        };
        fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              projectRoot,
              configCreated: true,
              tasksCreated: true,
              message: 'TaskMaster initialized successfully',
            },
          },
          log,
          projectRoot,
          tag: 'master',
        });
      } catch (error) {
        log.error(`Error in init: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // expand_all - Expand all pending tasks
  server.addTool({
    name: 'breakdown_all',
    description: 'Break down all pending tasks into smaller steps',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      num: z.number().optional().describe('Number of subtasks per task'),
      force: z.boolean().optional().describe('Replace existing subtasks'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withToolContext('expand-all', async (args, context) => {
      const { getAllTasks, addSubtasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { expandTask: aiExpandTask } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { num, force, research } = args;
      
      try {
        const tasks = getAllTasks(projectRoot);
        const toExpand = tasks.filter(t =>
          t.status === 'pending' && (!t.subtasks || t.subtasks.length === 0 || force)
        );
        
        log.info(`Expanding ${toExpand.length} tasks`);
        
        const results = [];
        for (const task of toExpand) {
          try {
            const subtasks = await aiExpandTask(task, {
              numSubtasks: num || 5,
              research,
            });
            addSubtasks(task.id, subtasks, force, projectRoot);
            results.push({ taskId: task.id, subtasksCreated: subtasks.length, success: true });
          } catch (error) {
            results.push({ taskId: task.id, error: error.message, success: false });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              expanded: results,
              successCount,
              totalAttempted: toExpand.length,
              message: `Expanded ${successCount}/${toExpand.length} tasks`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in expand-all: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // analyze_project_complexity - Analyze task complexity
  server.addTool({
    name: 'assess_complexity',
    description: 'Analyze complexity of all tasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withToolContext('analyze-complexity', async (args, context) => {
      const { getAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { analyzeComplexity } = await import('../../lib/ai.js');
      const { getProjectConfigDir } = await import('../../lib/config.js');
      const { projectRoot, log } = context;
      const { research } = args;
      
      try {
        const tasks = getAllTasks(projectRoot);
        
        if (tasks.length === 0) {
          return handleApiResult({
            result: { success: false, error: { message: 'No tasks to analyze' } },
            log,
            projectRoot,
          });
        }
        
        log.info(`Analyzing complexity of ${tasks.length} tasks`);
        const analysis = await analyzeComplexity(tasks, { research });
        
        // Save report
        const reportDir = path.join(getProjectConfigDir(projectRoot), 'reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }
        const reportPath = path.join(reportDir, 'complexity-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
          generatedAt: new Date().toISOString(),
          analysis,
        }, null, 2));
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              analysis,
              reportPath,
              message: `Analyzed ${analysis.length} tasks`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in analyze-complexity: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // complexity_report - View complexity report
  server.addTool({
    name: 'get_report',
    description: 'View the complexity analysis report',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('complexity-report', async (args, context) => {
      const { getProjectConfigDir } = await import('../../lib/config.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        const reportPath = path.join(getProjectConfigDir(projectRoot), 'reports', 'complexity-report.json');
        
        if (!fs.existsSync(reportPath)) {
          return handleApiResult({
            result: {
              success: false,
              error: { message: 'No complexity report found. Run analyze_project_complexity first.' },
            },
            log,
            projectRoot,
          });
        }
        
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        
        return handleApiResult({
          result: { success: true, data: report },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in complexity-report: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // generate - Generate task markdown files
  server.addTool({
    name: 'generate',
    description: 'Generate individual task markdown files',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      output: z.string().optional().describe('Output directory'),
    }),
    execute: withToolContext('generate', async (args, context) => {
      const { generateTaskFiles, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { output } = args;
      
      try {
        log.info('Generating task files');
        const files = generateTaskFiles(projectRoot, output);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              filesGenerated: files.length,
              files: files.map(f => path.basename(f)),
              message: `Generated ${files.length} task file(s)`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in generate: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // research - AI-powered research
  server.addTool({
    name: 'ask',
    description: 'Perform AI-powered research',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      query: z.string().describe('Research query'),
      saveTo: z.string().optional().describe('Task ID to save results to'),
    }),
    execute: withToolContext('research', async (args, context) => {
      const { findTaskById, updateTask, getCurrentTag } = await import('../../lib/tasks.js');
      const { performResearch } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { query, saveTo } = args;
      
      try {
        log.info(`Performing research: ${query.substring(0, 50)}...`);
        const result = await performResearch(query);
        
        if (saveTo) {
          const task = findTaskById(saveTo, projectRoot);
          if (task) {
            const timestamp = new Date().toISOString();
            const note = `\n\n--- Research [${timestamp}] ---\nQuery: ${query}\n\n${result.text}`;
            updateTask(saveTo, { details: (task.details || '') + note }, projectRoot);
            log.info(`Saved research results to task ${saveTo}`);
          }
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              query,
              result: result.text,
              model: result.model,
              provider: result.provider,
              savedTo: saveTo || null,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in research: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // scope_up_task - Increase task scope/complexity (matching official claude-task-master)
  server.addTool({
    name: 'scope_up_task',
    description: 'Increase the scope or complexity of a task by adding more subtasks or detail',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID to scope up'),
      additionalSubtasks: z.number().optional().describe('Number of additional subtasks to add'),
      prompt: z.string().optional().describe('Additional context for scoping'),
      research: z.boolean().optional().describe('Use research model'),
    }),
    execute: withToolContext('scope-up-task', async (args, context) => {
      const { findTaskById, addSubtasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { expandTask: aiExpandTask } = await import('../../lib/ai.js');
      const { projectRoot, log } = context;
      const { id, additionalSubtasks = 3, prompt, research } = args;
      
      try {
        const task = findTaskById(id, projectRoot);
        if (!task) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        log.info(`Scoping up task ${id} with ${additionalSubtasks} additional subtasks`);
        
        // Generate additional subtasks
        const scopePrompt = prompt 
          ? `Increase scope: ${prompt}`
          : 'Add more detailed subtasks to increase the scope and complexity of this task';
        
        const newSubtasks = await aiExpandTask(task, {
          numSubtasks: additionalSubtasks,
          research,
          prompt: scopePrompt,
        });
        
        // Append to existing subtasks
        addSubtasks(id, newSubtasks, false, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              taskId: id,
              addedSubtasks: newSubtasks.length,
              totalSubtasks: (task.subtasks?.length || 0) + newSubtasks.length,
              message: `Scoped up task ${id} with ${newSubtasks.length} additional subtasks`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in scope-up-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // scope_down_task - Decrease task scope/complexity (matching official claude-task-master)
  server.addTool({
    name: 'scope_down_task',
    description: 'Decrease the scope or complexity of a task by removing or consolidating subtasks',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().describe('Task ID to scope down'),
      targetSubtasks: z.number().optional().describe('Target number of subtasks'),
      removePending: z.boolean().optional().describe('Only remove pending subtasks'),
    }),
    execute: withToolContext('scope-down-task', async (args, context) => {
      const { findTaskById, getAllTasks, saveAllTasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, targetSubtasks = 3, removePending = true } = args;
      
      try {
        const tasks = getAllTasks(projectRoot);
        const taskIndex = tasks.findIndex(t => String(t.id) === String(id));
        
        if (taskIndex === -1) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${id} not found` } },
            log,
            projectRoot,
          });
        }
        
        const task = tasks[taskIndex];
        if (!task.subtasks || task.subtasks.length === 0) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${id} has no subtasks to scope down` } },
            log,
            projectRoot,
          });
        }
        
        const originalCount = task.subtasks.length;
        
        log.info(`Scoping down task ${id} from ${originalCount} to ${targetSubtasks} subtasks`);
        
        if (removePending) {
          // Keep done/in-progress subtasks, remove pending ones
          const keepSubtasks = task.subtasks.filter(s => 
            s.status === 'done' || s.status === 'in-progress'
          );
          const pendingSubtasks = task.subtasks.filter(s => s.status === 'pending');
          
          // Keep up to targetSubtasks pending ones
          const pendingToKeep = pendingSubtasks.slice(0, Math.max(0, targetSubtasks - keepSubtasks.length));
          
          task.subtasks = [...keepSubtasks, ...pendingToKeep];
        } else {
          // Simple truncation to target
          task.subtasks = task.subtasks.slice(0, targetSubtasks);
        }
        
        // Re-number subtasks
        task.subtasks = task.subtasks.map((s, i) => ({ ...s, id: i + 1 }));
        
        saveAllTasks(tasks, projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              taskId: id,
              originalSubtasks: originalCount,
              remainingSubtasks: task.subtasks.length,
              removed: originalCount - task.subtasks.length,
              message: `Scoped down task ${id} from ${originalCount} to ${task.subtasks.length} subtasks`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in scope-down-task: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // clear_subtasks - Clear subtasks
  server.addTool({
    name: 'clear_steps',
    description: 'Clear all subtasks from a task',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      id: z.string().optional().describe('Task ID or comma-separated IDs'),
      all: z.boolean().optional().describe('Clear from all tasks'),
    }),
    execute: withToolContext('clear-subtasks', async (args, context) => {
      const { getAllTasks, saveAllTasks, clearSubtasks, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { id, all } = args;
      
      try {
        if (all) {
          const tasks = getAllTasks(projectRoot);
          let cleared = 0;
          tasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
              task.subtasks = [];
              cleared++;
            }
          });
          saveAllTasks(tasks, projectRoot);
          
          return handleApiResult({
            result: {
              success: true,
              data: { clearedCount: cleared, message: `Cleared subtasks from ${cleared} tasks` },
            },
            log,
            projectRoot,
            tag: getCurrentTag(projectRoot),
          });
        }
        
        if (!id) {
          return handleApiResult({
            result: { success: false, error: { message: 'Provide id or use all=true' } },
            log,
            projectRoot,
          });
        }
        
        const ids = id.split(',').map(i => i.trim());
        for (const taskId of ids) {
          clearSubtasks(taskId, projectRoot);
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: { clearedIds: ids, message: `Cleared subtasks from ${ids.length} task(s)` },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in clear-subtasks: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
