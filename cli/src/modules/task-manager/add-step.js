
import fs from 'fs';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode,
  truncate
} from '../utils.js';
import {
  getStatusWithColor
} from '../ui.js';

async function addStep(tasksPath, parentId, options = {}) {
  const {
    title,
    description,
    details,
    links = [],
    status = 'pending',
    convertTaskId,
    projectRoot,
    context,
    outputFormat = 'text'
  } = options;
  
  try {
    // Validate input
    if (!convertTaskId && !title) {
      throw new Error('Either title or convertTaskId is required to add a step');
    }
    
    const parentIdNum = parseInt(parentId, 10);
    if (isNaN(parentIdNum) || parentIdNum <= 0) {
      throw new Error(`Invalid parent task ID: ${parentId}`);
    }
    
    log('info', `Adding step to task #${parentIdNum}...`);
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found in tasks file');
    }
    
    // Find parent task
    const parentTask = data.tasks.find(t => t.id === parentIdNum);
    if (!parentTask) {
      throw new Error(`Parent task #${parentIdNum} not found`);
    }
    
    // Initialize steps array (support both field names)
    const stepsField = parentTask.steps ? 'steps' : 'subtasks';
    if (!parentTask[stepsField]) {
      parentTask[stepsField] = [];
      if (stepsField === 'steps') {
        parentTask.subtasks = parentTask.steps;
      } else {
        parentTask.steps = parentTask.subtasks;
      }
    }
    
    let newStep;
    let convertedFrom = null;
    
    if (convertTaskId) {
      // Convert existing task to step
      const taskIdNum = parseInt(convertTaskId, 10);
      const taskIndex = data.tasks.findIndex(t => t.id === taskIdNum);
      
      if (taskIndex === -1) {
        throw new Error(`Task #${taskIdNum} not found for conversion`);
      }
      
      if (taskIdNum === parentIdNum) {
        throw new Error('Cannot convert a task to be its own step');
      }
      
      const taskToConvert = data.tasks[taskIndex];
      
      // Determine new step ID
      const maxStepId = parentTask[stepsField].length > 0
        ? Math.max(...parentTask[stepsField].map(s => s.id))
        : 0;
      newStep = {
        id: maxStepId + 1,
        title: taskToConvert.title,
        description: taskToConvert.description,
        status: taskToConvert.status || 'pending',
        details: taskToConvert.details,
        links: taskToConvert.dependencies || taskToConvert.links || [],
        dependencies: taskToConvert.dependencies || taskToConvert.links || []
      };
      data.tasks.splice(taskIndex, 1);
      convertedFrom = taskIdNum;
      
      log('info', `Converted task #${taskIdNum} to step ${parentIdNum}.${newStep.id}`);
      
    } else {
      const maxStepId = parentTask[stepsField].length > 0
        ? Math.max(...parentTask[stepsField].map(s => s.id))
        : 0;
      
      // Parse links
      let stepLinks = [];
      if (typeof links === 'string') {
        stepLinks = links.split(',').map(id => id.trim()).filter(Boolean);
      } else if (Array.isArray(links)) {
        stepLinks = links;
      }
      
      newStep = {
        id: maxStepId + 1,
        title,
        description: description || title,
        status: status || 'pending',
        details: details || null,
        links: stepLinks,
        dependencies: stepLinks // Backward compatibility
      };
    }
    parentTask[stepsField].push(newStep);
    if (stepsField === 'steps') {
      parentTask.subtasks = parentTask.steps;
    } else {
      parentTask.steps = parentTask.subtasks;
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    const stepFullId = `${parentIdNum}.${newStep.id}`;
    log('success', `Created step ${stepFullId}: ${newStep.title}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        stepId: stepFullId,
        parentId: parentIdNum,
        step: newStep,
        convertedFrom
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      let message = chalk.green.bold('✓ Step Added Successfully');
      
      if (convertedFrom) {
        message = chalk.green.bold(`✓ Task #${convertedFrom} Converted to Step`);
      }
      
      console.log(
        boxen(
          message +
            `\n\n${chalk.cyan('Step ID:')} ${stepFullId}` +
            `\n${chalk.cyan('Parent:')} #${parentIdNum} - ${parentTask.title}` +
            `\n${chalk.cyan('Title:')} ${newStep.title}` +
            `\n${chalk.cyan('Status:')} ${getStatusWithColor(newStep.status, true)}` +
            `\n\n${chalk.gray('Total steps in parent:')} ${parentTask[stepsField].length}`,
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
            `\n\n${chalk.cyan('View step:')} taskmaster show ${stepFullId}` +
            `\n${chalk.cyan('View parent:')} taskmaster show ${parentIdNum}` +
            `\n${chalk.cyan('Start step:')} taskmaster set-status --id=${stepFullId} --status=in-progress`,
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
      stepId: stepFullId,
      parentId: parentIdNum,
      step: newStep,
      convertedFrom
    };
    
  } catch (error) {
    log('error', `Error adding step: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

async function removeStep(tasksPath, stepId, options = {}) {
  const { convert = false, projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    if (!stepId || !stepId.includes('.')) {
      throw new Error('Invalid step ID format. Use "parentId.stepId" (e.g., "1.2")');
    }
    
    const [parentIdStr, stepIdStr] = stepId.split('.');
    const parentIdNum = parseInt(parentIdStr, 10);
    const stepIdNum = parseInt(stepIdStr, 10);
    
    log('info', `Removing step ${stepId}${convert ? ' (converting to task)' : ''}...`);
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Find parent
    const parentTask = data.tasks.find(t => t.id === parentIdNum);
    if (!parentTask) {
      throw new Error(`Parent task #${parentIdNum} not found`);
    }
    
    // Find step
    const stepsField = parentTask.steps ? 'steps' : 'subtasks';
    const steps = parentTask[stepsField];
    
    if (!steps || steps.length === 0) {
      throw new Error(`Parent task #${parentIdNum} has no steps`);
    }
    
    const stepIndex = steps.findIndex(s => s.id === stepIdNum);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepId} not found`);
    }
    
    const step = steps[stepIndex];
    let newTaskId = null;
    
    if (convert) {
      const maxId = Math.max(...data.tasks.map(t => t.id));
      newTaskId = maxId + 1;
      
      const newTask = {
        id: newTaskId,
        title: step.title,
        description: step.description,
        status: step.status,
        priority: 'medium',
        dependencies: step.dependencies || step.links || [],
        links: step.dependencies || step.links || [],
        steps: [],
        subtasks: [],
        details: step.details
      };
      
      data.tasks.push(newTask);
      log('info', `Converted step to task #${newTaskId}`);
    }
    
    // Remove step
    steps.splice(stepIndex, 1);
    if (stepsField === 'steps') {
      parentTask.subtasks = parentTask.steps;
    } else {
      parentTask.steps = parentTask.subtasks;
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Removed step ${stepId}`);
    
    return {
      success: true,
      removedStepId: stepId,
      convertedToTaskId: newTaskId
    };
    
  } catch (error) {
    log('error', `Error removing step: ${error.message}`);
    throw error;
  }
}

async function clearSteps(tasksPath, taskId, options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    log('info', `Clearing steps from ${taskId === 'all' ? 'all tasks' : `task #${taskId}`}...`);
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    let clearedCount = 0;
    let tasksAffected = 0;
    
    if (taskId === 'all') {
      // Clear all
      data.tasks.forEach(task => {
        const steps = task.steps || task.subtasks || [];
        if (steps.length > 0) {
          clearedCount += steps.length;
          tasksAffected++;
          task.steps = [];
          task.subtasks = [];
        }
      });
    } else {
      // Clear specific task
      const taskIdNum = parseInt(taskId, 10);
      const task = data.tasks.find(t => t.id === taskIdNum);
      
      if (!task) {
        throw new Error(`Task #${taskIdNum} not found`);
      }
      
      const steps = task.steps || task.subtasks || [];
      clearedCount = steps.length;
      tasksAffected = clearedCount > 0 ? 1 : 0;
      task.steps = [];
      task.subtasks = [];
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Cleared ${clearedCount} steps from ${tasksAffected} task(s)`);
    
    return {
      success: true,
      stepsCleared: clearedCount,
      tasksAffected
    };
    
  } catch (error) {
    log('error', `Error clearing steps: ${error.message}`);
    throw error;
  }
}

export { addStep, removeStep, clearSteps };
export default addStep;
