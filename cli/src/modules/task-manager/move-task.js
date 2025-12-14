/**
 * Move Task Module
 * Moves tasks or steps within the hierarchy
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode
} from '../utils.js';

/**
 * Move a task or step to a new position
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} fromId - Source ID (e.g., "5" or "5.2")
 * @param {string} toId - Target ID (e.g., "7" or "7.3")
 * @param {Object} options - Options
 * @param {string} [options.projectRoot] - Project root path
 * @param {string} [options.context] - Context name
 * @param {string} [options.outputFormat] - Output format
 * @returns {Promise<Object>} Result
 */
async function moveTask(tasksPath, fromId, toId, options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    log('info', `Moving ${fromId} to ${toId}...`);
    
    // Read tasks
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Handle comma-separated IDs for bulk moves
    const fromIds = String(fromId).split(',').map(id => id.trim());
    const toIds = String(toId).split(',').map(id => id.trim());
    
    if (fromIds.length !== toIds.length) {
      throw new Error('Number of source IDs must match number of target IDs');
    }
    
    const results = [];
    
    for (let i = 0; i < fromIds.length; i++) {
      const from = fromIds[i];
      const to = toIds[i];
      
      try {
        const result = moveSingle(data, from, to);
        results.push({ from, to, success: true, ...result });
      } catch (error) {
        results.push({ from, to, success: false, error: error.message });
      }
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    const successCount = results.filter(r => r.success).length;
    log('success', `Moved ${successCount}/${results.length} items`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: successCount > 0,
        results
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      if (successCount > 0) {
        let message = '';
        results.filter(r => r.success).forEach(r => {
          message += `\n${chalk.cyan(r.from)} → ${chalk.green(r.to)}`;
        });
        
        console.log(
          boxen(
            chalk.green.bold(`✓ ${successCount} Item(s) Moved`) + message,
            {
              padding: 1,
              borderColor: 'green',
              borderStyle: 'round'
            }
          )
        );
      }
      
      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        console.log(
          boxen(
            chalk.red.bold(`Failed: ${failures.length}`) +
              failures.map(f => `\n${chalk.red(f.from)}: ${f.error}`).join(''),
            {
              padding: 1,
              borderColor: 'red',
              borderStyle: 'round',
              margin: { top: 1 }
            }
          )
        );
      }
    }
    
    return { success: successCount > 0, results };
    
  } catch (error) {
    log('error', `Error moving task: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

/**
 * Move a single task or step
 * @param {Object} data - Tasks data
 * @param {string} from - Source ID
 * @param {string} to - Target ID
 * @returns {Object} Move result
 */
function moveSingle(data, from, to) {
  const fromIsStep = String(from).includes('.');
  const toIsStep = String(to).includes('.');
  
  // Get source item
  let sourceItem = null;
  let sourceParent = null;
  let sourceStepsField = null;
  let sourceIndex = -1;
  
  if (fromIsStep) {
    const [parentId, stepId] = String(from).split('.').map(Number);
    sourceParent = data.tasks.find(t => t.id === parentId);
    
    if (!sourceParent) {
      throw new Error(`Source parent task #${parentId} not found`);
    }
    
    sourceStepsField = sourceParent.steps ? 'steps' : 'subtasks';
    const steps = sourceParent[sourceStepsField] || [];
    sourceIndex = steps.findIndex(s => s.id === stepId);
    
    if (sourceIndex === -1) {
      throw new Error(`Source step ${from} not found`);
    }
    
    sourceItem = { ...steps[sourceIndex] };
    
  } else {
    const taskId = parseInt(from, 10);
    sourceIndex = data.tasks.findIndex(t => t.id === taskId);
    
    if (sourceIndex === -1) {
      throw new Error(`Source task #${taskId} not found`);
    }
    
    sourceItem = { ...data.tasks[sourceIndex] };
  }
  
  // Remove from source
  if (fromIsStep) {
    sourceParent[sourceStepsField].splice(sourceIndex, 1);
    if (sourceStepsField === 'steps') {
      sourceParent.subtasks = sourceParent.steps;
    } else {
      sourceParent.steps = sourceParent.subtasks;
    }
  } else {
    data.tasks.splice(sourceIndex, 1);
  }
  
  // Add to target
  if (toIsStep) {
    const [parentId, stepId] = String(to).split('.').map(Number);
    let targetParent = data.tasks.find(t => t.id === parentId);
    
    // Create parent if doesn't exist
    if (!targetParent) {
      const maxId = Math.max(...data.tasks.map(t => t.id), 0);
      targetParent = {
        id: parentId,
        title: `[Placeholder Task ${parentId}]`,
        description: 'Placeholder task created during move operation',
        status: 'pending',
        priority: 'medium',
        steps: [],
        subtasks: [],
        dependencies: [],
        links: []
      };
      data.tasks.push(targetParent);
    }
    
    const targetStepsField = targetParent.steps ? 'steps' : 'subtasks';
    if (!targetParent[targetStepsField]) {
      targetParent[targetStepsField] = [];
    }
    
    // Add as step
    const newStep = {
      id: stepId,
      title: sourceItem.title,
      description: sourceItem.description,
      status: sourceItem.status || 'pending',
      details: sourceItem.details,
      links: sourceItem.dependencies || sourceItem.links || [],
      dependencies: sourceItem.dependencies || sourceItem.links || []
    };
    
    targetParent[targetStepsField].push(newStep);
    
    // Sync fields
    if (targetStepsField === 'steps') {
      targetParent.subtasks = targetParent.steps;
    } else {
      targetParent.steps = targetParent.subtasks;
    }
    
  } else {
    const targetId = parseInt(to, 10);
    
    // Check if target ID exists
    const existing = data.tasks.find(t => t.id === targetId);
    if (existing && existing.title && !existing.title.includes('[Placeholder')) {
      throw new Error(`Target task #${targetId} already exists. Cannot overwrite.`);
    }
    
    // Remove placeholder if exists
    const existingIndex = data.tasks.findIndex(t => t.id === targetId);
    if (existingIndex !== -1) {
      data.tasks.splice(existingIndex, 1);
    }
    
    // Add task with new ID
    const newTask = {
      ...sourceItem,
      id: targetId
    };
    
    data.tasks.push(newTask);
    
    // Sort tasks by ID
    data.tasks.sort((a, b) => a.id - b.id);
  }
  
  return {
    movedItem: sourceItem.title,
    wasStep: fromIsStep,
    isNowStep: toIsStep
  };
}

export default moveTask;
