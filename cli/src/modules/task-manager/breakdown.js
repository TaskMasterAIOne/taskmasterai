
import fs from 'fs';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  readAssessmentReport,
  isSilentMode,
  truncate,
  getConfigDir
} from '../utils.js';
import {
  getStatusWithColor,
  startLoadingIndicator,
  stopLoadingIndicator
} from '../ui.js';

async function breakdownTask(tasksPath, taskId, options = {}) {
  const {
    numSteps,
    useResearch = false,
    additionalContext = '',
    force = false,
    projectRoot,
    context,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    log('info', `Breaking down task ${taskId}...`);
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator(`Analyzing task ${taskId}...`);
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error(`Invalid tasks data in ${tasksPath}`);
    }
    
    // Find task
    const taskIdNum = parseInt(taskId, 10);
    const taskIndex = data.tasks.findIndex(t => t.id === taskIdNum);
    
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    const task = data.tasks[taskIndex];
    
    log('info', `Breaking down: ${task.title}${useResearch ? ' (with research)' : ''}`);
    
    // Handle force flag - clear existing steps
    const stepsField = task.steps ? 'steps' : (task.subtasks ? 'subtasks' : 'steps');
    const existingSteps = task[stepsField] || [];
    
    if (force && existingSteps.length > 0) {
      log('info', `Force mode: Clearing ${existingSteps.length} existing steps`);
      task[stepsField] = [];
    }
    
    // Determine number of steps
    let targetStepCount = numSteps;
    let assessmentContext = '';
    
    if (!targetStepCount) {
      const assessmentReport = readAssessmentReport(null, projectRoot);
      
      if (assessmentReport?.taskAnalysis) {
        const taskAnalysis = assessmentReport.taskAnalysis.find(
          a => a.taskId === taskIdNum
        );
        
        if (taskAnalysis) {
          targetStepCount = taskAnalysis.recommendedSteps || taskAnalysis.recommendedSubtasks;
          assessmentContext = taskAnalysis.expansionPrompt || taskAnalysis.reasoning || '';
          log('info', `Using assessment recommendation: ${targetStepCount} steps`);
        }
      }
      if (!targetStepCount) {
        targetStepCount = 5;
        log('info', `Using default: ${targetStepCount} steps`);
      }
    }
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, 'Generating steps...');
      loadingIndicator = startLoadingIndicator(`Creating ${targetStepCount} steps for task ${taskId}...`);
    }
    // In production, this would call the AI service
    const currentSteps = task[stepsField] || [];
    const startingId = currentSteps.length > 0 
      ? Math.max(...currentSteps.map(s => s.id)) + 1 
      : 1;
    
    const newSteps = [];
    for (let i = 0; i < targetStepCount; i++) {
      newSteps.push({
        id: startingId + i,
        title: `Step ${startingId + i}: [Pending AI generation]`,
        description: `Implementation step for: ${task.title}`,
        status: 'pending',
        details: assessmentContext || additionalContext || null,
        links: [] // dependencies on other steps
      });
    }
    
    // Append or replace steps
    if (force) {
      task[stepsField] = newSteps;
    } else {
      task[stepsField] = [...currentSteps, ...newSteps];
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Created ${newSteps.length} steps`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Task ${taskId} broken down into ${task[stepsField].length} steps`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        taskId: task.id,
        title: task.title,
        stepsCreated: newSteps.length,
        totalSteps: task[stepsField].length,
        steps: task[stepsField]
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      // Build steps list
      let stepsDisplay = '';
      task[stepsField].forEach(step => {
        const status = getStatusWithColor(step.status, true);
        const isNew = newSteps.find(s => s.id === step.id);
        const marker = isNew ? chalk.green('NEW') : chalk.gray('   ');
        stepsDisplay += `\n  ${marker} ${chalk.cyan(`${task.id}.${step.id}`)} [${status}] ${truncate(step.title, 50)}`;
      });
      
      console.log(
        boxen(
          chalk.green.bold('✓ Task Broken Down Successfully') +
            `\n\n${chalk.cyan('Task:')} #${task.id} - ${task.title}` +
            `\n${chalk.cyan('Steps created:')} ${newSteps.length}` +
            `\n${chalk.cyan('Total steps:')} ${task[stepsField].length}` +
            `\n\n${chalk.white.bold('Steps:')}${stepsDisplay}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
      
      // Suggested actions
      console.log(
        boxen(
          chalk.white.bold('Next Actions:') +
            `\n\n${chalk.cyan('Start first step:')} taskmaster set-status --id=${task.id}.${task[stepsField][0]?.id || 1} --status=in-progress` +
            `\n${chalk.cyan('View task:')} taskmaster show ${task.id}` +
            `\n${chalk.cyan('Find next:')} taskmaster next`,
          {
            padding: 1,
            borderColor: 'gray',
            borderStyle: 'round',
            margin: { top: 1 }
          }
        )
      );
    }
    
    return {
      success: true,
      task,
      stepsCreated: newSteps.length
    };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error breaking down task: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

async function breakdownAll(tasksPath, options = {}) {
  const { projectRoot, context, outputFormat = 'text', force = false } = options;
  
  try {
    log('info', 'Breaking down all eligible tasks...');
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Find eligible tasks (pending/in-progress without steps)
    const eligibleTasks = data.tasks.filter(task => {
      const status = task.status?.toLowerCase() || 'pending';
      const steps = task.steps || task.subtasks || [];
      if (status === 'done' || status === 'completed') return false;
      if (steps.length > 0 && !force) return false;
      
      return true;
    });
    
    if (eligibleTasks.length === 0) {
      log('info', 'No eligible tasks to break down');
      
      if (outputFormat === 'text' && !isSilentMode()) {
        console.log(
          boxen(
            chalk.yellow('No eligible tasks to break down.') +
              '\n\n' + chalk.gray('Tasks must be pending or in-progress with no existing steps.') +
              '\n' + chalk.gray('Use --force to replace existing steps.'),
            {
              padding: 1,
              borderColor: 'yellow',
              borderStyle: 'round'
            }
          )
        );
      }
      
      return { success: true, tasksProcessed: 0 };
    }
    
    // Process each task
    const results = [];
    for (const task of eligibleTasks) {
      try {
        const result = await breakdownTask(tasksPath, task.id, {
          ...options,
          outputFormat: 'json' // Suppress individual output
        });
        results.push({ taskId: task.id, success: true, stepsCreated: result.stepsCreated });
      } catch (err) {
        results.push({ taskId: task.id, success: false, error: err.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalSteps = results.reduce((sum, r) => sum + (r.stepsCreated || 0), 0);
    
    log('success', `Broke down ${successCount}/${eligibleTasks.length} tasks into ${totalSteps} steps`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        tasksProcessed: eligibleTasks.length,
        successCount,
        totalSteps,
        results
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Breakdown Complete') +
            `\n\n${chalk.cyan('Tasks processed:')} ${successCount}/${eligibleTasks.length}` +
            `\n${chalk.cyan('Total steps created:')} ${totalSteps}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, tasksProcessed: successCount, totalSteps };
    
  } catch (error) {
    log('error', `Error in breakdown-all: ${error.message}`);
    throw error;
  }
}

export { breakdownTask, breakdownAll };
export default breakdownTask;
