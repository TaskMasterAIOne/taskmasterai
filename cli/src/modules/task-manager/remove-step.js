
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode,
  findProjectRoot,
  getTasksFilePath
} from '../utils.js';
import { getCurrentContext } from '../context-manager.js';

async function removeStep(tasksPath, stepId, options = {}) {
  const { 
    convertToTask = false, 
    projectRoot, 
    context, 
    outputFormat = 'text' 
  } = options;
  
  const root = projectRoot || findProjectRoot() || process.cwd();
  const currentContext = context || getCurrentContext(root);
  
  try {
    log('info', `Removing step ${stepId}...`);
    const data = readJSON(tasksPath, root, currentContext);
    if (!data || !data.tasks) {
      throw new Error(`Invalid or missing tasks file at ${tasksPath}`);
    }
    if (!stepId.includes('.')) {
      throw new Error(
        `Invalid step ID format: ${stepId}. Expected format: "parentId.stepId"`
      );
    }

    const [parentIdStr, stepIdStr] = stepId.split('.');
    const parentId = parseInt(parentIdStr, 10);
    const stepIdNum = parseInt(stepIdStr, 10);
    const parentTask = data.tasks.find((t) => t.id === parentId);
    if (!parentTask) {
      throw new Error(`Parent task with ID ${parentId} not found`);
    }
    const steps = parentTask.steps || parentTask.subtasks || [];
    if (steps.length === 0) {
      throw new Error(`Parent task ${parentId} has no steps`);
    }

    // Find the step to remove
    const stepIndex = steps.findIndex((st) => st.id === stepIdNum);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found`);
    }
    const removedStep = { ...steps[stepIndex] };
    steps.splice(stepIndex, 1);
    if (parentTask.steps) {
      parentTask.steps = steps.length > 0 ? steps : undefined;
    }
    if (parentTask.subtasks) {
      parentTask.subtasks = steps.length > 0 ? steps : undefined;
    }

    let convertedTask = null;

    // Convert the step to a standalone task if requested
    if (convertToTask) {
      log('info', `Converting step ${stepId} to a standalone task...`);

      // Find the highest task ID to determine the next ID
      const highestId = Math.max(...data.tasks.map((t) => t.id));
      const newTaskId = highestId + 1;
      convertedTask = {
        id: newTaskId,
        title: removedStep.title,
        description: removedStep.description || '',
        details: removedStep.details || '',
        status: removedStep.status || 'pending',
        dependencies: removedStep.dependencies || [],
        priority: parentTask.priority || 'medium' // Inherit priority from parent
      };
      if (!convertedTask.dependencies.includes(parentId)) {
        convertedTask.dependencies.push(parentId);
      }
      data.tasks.push(convertedTask);

      log('info', `Created new task ${newTaskId} from step ${stepId}`);
    } else {
      log('info', `Step ${stepId} deleted`);
    }
    writeJSON(tasksPath, data, root, currentContext);

    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        removedStep,
        convertedTask,
        parentTaskId: parentId,
        context: currentContext
      };
    }

    // Text output
    if (!isSilentMode()) {
      if (convertToTask && convertedTask) {
        console.log(
          boxen(
            chalk.green.bold('✓ Step Converted to Task') +
              `\n\nStep: ${chalk.cyan(stepId)}` +
              `\nNew Task ID: ${chalk.yellow(convertedTask.id)}` +
              `\nTitle: ${chalk.white(convertedTask.title)}` +
              `\nStatus: ${chalk.gray(convertedTask.status)}`,
            {
              padding: 1,
              borderColor: 'green',
              borderStyle: 'round'
            }
          )
        );
      } else {
        console.log(
          boxen(
            chalk.green.bold('✓ Step Removed') +
              `\n\nStep: ${chalk.cyan(stepId)}` +
              `\nTitle: ${chalk.white(removedStep.title)}` +
              `\nFrom Task: ${chalk.yellow(parentId)}`,
            {
              padding: 1,
              borderColor: 'green',
              borderStyle: 'round'
            }
          )
        );
      }
    }

    return convertedTask || { success: true, removedStep };
    
  } catch (error) {
    log('error', `Error removing step: ${error.message}`);
    
    if (outputFormat === 'json') {
      return { success: false, error: error.message };
    }
    
    throw error;
  }
}

async function removeMultipleSteps(tasksPath, stepIds, options = {}) {
  const ids = stepIds.split(',').map(id => id.trim());
  const results = [];
  
  for (const id of ids) {
    try {
      const result = await removeStep(tasksPath, id, { 
        ...options, 
        outputFormat: 'json' 
      });
      results.push({ stepId: id, ...result });
    } catch (error) {
      results.push({ stepId: id, success: false, error: error.message });
    }
  }
  
  return {
    success: results.every(r => r.success),
    results,
    removedCount: results.filter(r => r.success).length
  };
}

export { removeStep, removeMultipleSteps };
export default removeStep;
