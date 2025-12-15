
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode
} from '../utils.js';

async function removeTask(tasksPath, taskId, options = {}) {
  const { force = false, projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    log('info', `Removing task/step ${taskId}...`);
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    let removed = null;
    let isStep = false;
    
    if (String(taskId).includes('.')) {
      // Remove step
      isStep = true;
      const [parentIdStr, stepIdStr] = String(taskId).split('.');
      const parentId = parseInt(parentIdStr, 10);
      const stepId = parseInt(stepIdStr, 10);
      
      const parentTask = data.tasks.find(t => t.id === parentId);
      if (!parentTask) {
        throw new Error(`Parent task #${parentId} not found`);
      }
      
      const stepsField = parentTask.steps ? 'steps' : 'subtasks';
      const steps = parentTask[stepsField];
      
      if (!steps || steps.length === 0) {
        throw new Error(`Task #${parentId} has no steps`);
      }
      
      const stepIndex = steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) {
        throw new Error(`Step ${taskId} not found`);
      }
      
      removed = steps[stepIndex];
      steps.splice(stepIndex, 1);
      if (stepsField === 'steps') {
        parentTask.subtasks = parentTask.steps;
      } else {
        parentTask.steps = parentTask.subtasks;
      }
      
    } else {
      // Remove task
      const taskIdNum = parseInt(taskId, 10);
      const taskIndex = data.tasks.findIndex(t => t.id === taskIdNum);
      
      if (taskIndex === -1) {
        throw new Error(`Task #${taskIdNum} not found`);
      }
      
      removed = data.tasks[taskIndex];
      
      // Clean up references from other tasks
      data.tasks.forEach(task => {
        if (task.dependencies) {
          task.dependencies = task.dependencies.filter(d => d !== taskIdNum);
        }
        if (task.links) {
          task.links = task.links.filter(l => l !== taskIdNum);
        }
      });
      data.tasks.splice(taskIndex, 1);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Removed ${isStep ? 'step' : 'task'} ${taskId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        removedId: taskId,
        isStep,
        removed
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold(`✓ ${isStep ? 'Step' : 'Task'} Removed`) +
            `\n\n${chalk.cyan('ID:')} ${taskId}` +
            `\n${chalk.cyan('Title:')} ${removed.title}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, removedId: taskId, removed };
    
  } catch (error) {
    log('error', `Error removing task: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

export default removeTask;
