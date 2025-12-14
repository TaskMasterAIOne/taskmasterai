/**
 * Set Task Status Module
 * Updates the status of tasks and steps
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "steps" instead of "subtasks"
 * - "contexts" instead of "tags"
 */

import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode
} from '../utils.js';

// Valid task statuses
const TASK_STATUS_OPTIONS = [
  'pending',
  'in-progress',
  'done',
  'blocked',
  'deferred',
  'cancelled',
  'review'
];

/**
 * Check if a status is valid
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidStatus(status) {
  return TASK_STATUS_OPTIONS.includes(status?.toLowerCase());
}

/**
 * Update a single task or step status
 * @param {Object} data - Tasks data object
 * @param {string} taskId - Task or step ID (e.g., "1" or "1.2")
 * @param {string} newStatus - New status to set
 * @returns {Object} Info about the update
 */
function updateSingleStatus(data, taskId, newStatus) {
  const idStr = String(taskId);
  let oldStatus = 'pending';
  let updated = false;
  
  if (idStr.includes('.')) {
    // Handle step (subtask)
    const [parentId, stepId] = idStr.split('.').map(Number);
    const parentTask = data.tasks.find(t => t.id === parentId);
    
    if (!parentTask) {
      throw new Error(`Parent task ${parentId} not found`);
    }
    
    // Support both field names
    const steps = parentTask.steps || parentTask.subtasks;
    if (!steps) {
      throw new Error(`Parent task ${parentId} has no steps`);
    }
    
    const step = steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${idStr} not found`);
    }
    
    oldStatus = step.status || 'pending';
    step.status = newStatus;
    updated = true;
    
  } else {
    // Handle regular task
    const taskIdNum = parseInt(idStr, 10);
    const task = data.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      throw new Error(`Task ${taskIdNum} not found`);
    }
    
    oldStatus = task.status || 'pending';
    task.status = newStatus;
    updated = true;
  }
  
  return { id: taskId, oldStatus, newStatus, updated };
}

/**
 * Set the status of one or more tasks/steps
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to update (comma-separated)
 * @param {string} newStatus - New status
 * @param {Object} options - Additional options
 * @param {string} [options.projectRoot] - Project root path
 * @param {string} [options.context] - Context name
 * @param {boolean} [options.silent] - Suppress output
 * @returns {Object} Result object
 */
async function setStatus(tasksPath, taskIdInput, newStatus, options = {}) {
  const { projectRoot, context, silent } = options;
  
  try {
    // Validate status
    const normalizedStatus = newStatus?.toLowerCase();
    if (!isValidStatus(normalizedStatus)) {
      throw new Error(
        `Invalid status value: ${newStatus}. Use one of: ${TASK_STATUS_OPTIONS.join(', ')}`
      );
    }
    
    // Display header
    if (!silent && !isSilentMode()) {
      console.log(
        boxen(chalk.white.bold(`Updating Task Status to: ${normalizedStatus}`), {
          padding: 1,
          borderColor: 'blue',
          borderStyle: 'round'
        })
      );
    }
    
    log('info', `Reading tasks from ${tasksPath}...`);
    
    // Read tasks data
    const data = readJSON(tasksPath, projectRoot, context);
    
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Handle multiple task IDs (comma-separated)
    const taskIds = taskIdInput.split(',').map(id => id.trim());
    const updatedTasks = [];
    
    // Update each task
    for (const id of taskIds) {
      const updateInfo = updateSingleStatus(data, id, normalizedStatus);
      updatedTasks.push(updateInfo);
      log('info', `Updated task ${id}: ${updateInfo.oldStatus} → ${normalizedStatus}`);
    }
    
    // Write changes back
    writeJSON(tasksPath, data, projectRoot, context);
    
    // Display success message
    if (!silent && !isSilentMode()) {
      for (const updateInfo of updatedTasks) {
        const { id, oldStatus } = updateInfo;
        
        console.log(
          boxen(
            chalk.white.bold(`Successfully updated task ${id} status:`) +
              '\n' +
              `From: ${chalk.yellow(oldStatus)}\n` +
              `To:   ${chalk.green(normalizedStatus)}`,
            { padding: 1, borderColor: 'green', borderStyle: 'round' }
          )
        );
      }
    }
    
    return {
      success: true,
      updatedTasks: updatedTasks.map(({ id, oldStatus, newStatus }) => ({
        id,
        oldStatus,
        newStatus
      }))
    };
    
  } catch (error) {
    log('error', `Error setting task status: ${error.message}`);
    
    if (!options.silent && !isSilentMode()) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

export {
  setStatus,
  isValidStatus,
  TASK_STATUS_OPTIONS
};

export default setStatus;
