
import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

export function registerAutopilotTools(server) {
  // autopilot_start - Start a TDD workflow
  server.addTool({
    name: 'autopilot_start',
    description: 'Initialize and start a new TDD workflow for a task. Creates a git branch and sets up the workflow state machine.',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      taskId: z.string().describe('Main task ID to work on (not subtask)'),
      maxAttempts: z.number().optional().default(3).describe('Maximum attempts per subtask'),
      force: z.boolean().optional().default(false).describe('Force start even if workflow exists'),
    }),
    execute: withToolContext('autopilot-start', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { findTaskById, getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { taskId, maxAttempts, force } = args;
      
      try {
        // Validate task exists and has subtasks
        const task = findTaskById(taskId, projectRoot);
        if (!task) {
          return handleApiResult({
            result: { success: false, error: { message: `Task ${taskId} not found` } },
            log,
            projectRoot,
          });
        }
        
        if (!task.subtasks || task.subtasks.length === 0) {
          return handleApiResult({
            result: {
              success: false,
              error: {
                message: `Task ${taskId} has no subtasks. Use expand_task to create subtasks first.`,
              },
            },
            log,
            projectRoot,
          });
        }
        
        log.info(`Starting autopilot workflow for task ${taskId}`);
        
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const status = await orchestrator.start(taskId, {
          maxAttempts: maxAttempts || 3,
          force,
        });
        
        const nextAction = orchestrator.getNextAction();
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              message: `Workflow started for task ${taskId}`,
              taskId,
              branchName: status.branchName,
              phase: status.phase,
              tddPhase: status.tddPhase,
              progress: status.progress,
              currentSubtask: status.currentSubtask,
              nextAction: nextAction.action,
              nextSteps: nextAction.nextSteps,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-start: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_next - Get next action
  server.addTool({
    name: 'autopilot_next',
    description: 'Get the next action to perform in the workflow',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('autopilot-next', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = orchestrator.getNextAction();
        
        return handleApiResult({
          result: { success: true, data: result },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-next: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_status - Get workflow status
  server.addTool({
    name: 'autopilot_status',
    description: 'Get current workflow status',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('autopilot-status', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = orchestrator.getStatus();
        
        if (!result) {
          return handleApiResult({
            result: {
              success: true,
              data: { active: false, message: 'No active workflow' },
            },
            log,
            projectRoot,
            tag: getCurrentTag(projectRoot),
          });
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: { active: true, ...result },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-status: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_complete - Complete current phase
  server.addTool({
    name: 'autopilot_complete',
    description: 'Complete the current TDD phase with test results',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      testResults: z.object({
        total: z.number().describe('Total tests'),
        passed: z.number().describe('Passed tests'),
        failed: z.number().describe('Failed tests'),
        skipped: z.number().optional().describe('Skipped tests'),
      }).describe('Test results'),
    }),
    execute: withToolContext('autopilot-complete', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { testResults } = args;
      
      try {
        log.info('Completing TDD phase');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = orchestrator.completePhase(testResults);
        
        return handleApiResult({
          result: {
            success: true,
            data: { ...result, message: 'Phase completed' },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-complete: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_commit - Commit changes
  server.addTool({
    name: 'autopilot_commit',
    description: 'Commit changes and advance to next subtask',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      message: z.string().optional().describe('Custom commit message'),
      files: z.array(z.string()).optional().describe('Specific files to stage'),
    }),
    execute: withToolContext('autopilot-commit', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { message, files } = args;
      
      try {
        log.info('Committing changes');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = await orchestrator.commit({
          customMessage: message,
          files,
        });
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              ...result,
              message: result.isComplete ? 'Workflow complete!' : 'Committed and advanced to next subtask',
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-commit: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_abort - Abort workflow
  server.addTool({
    name: 'autopilot_abort',
    description: 'Abort the current workflow',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('autopilot-abort', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Aborting workflow');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = orchestrator.abort();
        
        return handleApiResult({
          result: {
            success: true,
            data: { ...result, message: 'Workflow aborted' },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-abort: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_resume - Resume workflow
  server.addTool({
    name: 'autopilot_resume',
    description: 'Resume an interrupted workflow',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('autopilot-resume', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Resuming workflow');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const result = orchestrator.resume();
        
        return handleApiResult({
          result: {
            success: true,
            data: { ...result, message: 'Workflow resumed' },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-resume: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // autopilot_finalize - Finalize workflow
  server.addTool({
    name: 'autopilot_finalize',
    description: 'Finalize the workflow after all subtasks are complete',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('autopilot-finalize', async (args, context) => {
      const { WorkflowOrchestrator } = await import('../../lib/autopilot/index.js');
      const { getCurrentTag, setTaskStatus } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        log.info('Finalizing workflow');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        const status = orchestrator.getStatus();
        
        if (!status) {
          return handleApiResult({
            result: { success: false, error: { message: 'No active workflow to finalize' } },
            log,
            projectRoot,
          });
        }
        
        // Mark parent task as done
        setTaskStatus(status.taskId, 'done', projectRoot);
        
        // Clear workflow state
        orchestrator.abort();
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              taskId: status.taskId,
              message: `Workflow finalized. Task ${status.taskId} marked as done.`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in autopilot-finalize: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
