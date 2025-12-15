
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
  getStatusWithColor,
  startLoadingIndicator,
  stopLoadingIndicator
} from '../ui.js';

async function editTask(tasksPath, taskId, prompt, options = {}) {
  const {
    useResearch = false,
    append = false,
    projectRoot,
    context,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    // Validate inputs
    if (taskId === null || taskId === undefined || String(taskId).trim() === '') {
      throw new Error('Task ID is required');
    }
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('Update prompt/information is required');
    }
    
    log('info', `Editing task ${taskId}${append ? ' (append mode)' : ''}...`);
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator(`Updating task ${taskId}...`);
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Find task (support both numeric and step IDs)
    let task = null;
    let isStep = false;
    let parentTask = null;
    
    const idStr = String(taskId);
    
    if (idStr.includes('.')) {
      // Step ID
      isStep = true;
      const [parentId, stepId] = idStr.split('.').map(Number);
      
      parentTask = data.tasks.find(t => t.id === parentId);
      if (!parentTask) {
        throw new Error(`Parent task #${parentId} not found`);
      }
      
      const stepsField = parentTask.steps ? 'steps' : 'subtasks';
      const steps = parentTask[stepsField] || [];
      task = steps.find(s => s.id === stepId);
      
      if (!task) {
        throw new Error(`Step ${taskId} not found`);
      }
    } else {
      // Regular task ID
      const taskIdNum = parseInt(idStr, 10);
      task = data.tasks.find(t => t.id === taskIdNum);
      
      if (!task) {
        throw new Error(`Task #${taskIdNum} not found`);
      }
    }
    const oldTitle = task.title;
    const oldDescription = task.description;
    const oldDetails = task.details;
    if (append) {
      // Append mode - add timestamped entry to details
      const timestamp = new Date().toISOString();
      const formattedTime = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const entry = `\n\n---\n**[${formattedTime}]**\n${prompt}`;
      
      if (task.details) {
        task.details += entry;
      } else {
        task.details = `**Update Log:**${entry}`;
      }
      
      task.updatedAt = timestamp;
      
    } else {
      // Replace mode - update fields based on prompt
      // In production, this would use AI to intelligently update
      
      if (prompt.length < 200) {
        task.description = prompt;
      } else {
        task.details = prompt;
      }
      
      task.updatedAt = new Date().toISOString();
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Task ${taskId} updated`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Updated task ${taskId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        taskId,
        isStep,
        task,
        mode: append ? 'append' : 'replace'
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      const itemType = isStep ? 'Step' : 'Task';
      
      console.log(
        boxen(
          chalk.green.bold(`✓ ${itemType} Updated Successfully`) +
            `\n\n${chalk.cyan('ID:')} ${taskId}` +
            `\n${chalk.cyan('Title:')} ${task.title}` +
            `\n${chalk.cyan('Mode:')} ${append ? 'Appended to details' : 'Replaced content'}` +
            `\n\n${chalk.gray('Updated content:')}` +
            `\n${truncate(prompt, 200)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return {
      success: true,
      taskId,
      task
    };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error editing task: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

async function editTasks(tasksPath, fromId, prompt, options = {}) {
  const { useResearch = false, projectRoot, context, outputFormat = 'text' } = options;
  
  let loadingIndicator = null;
  
  try {
    log('info', `Updating tasks from ID ${fromId}...`);
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator('Updating tasks...');
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found');
    }
    
    const fromIdNum = parseInt(fromId, 10);
    
    // Find tasks to update (from ID onwards, not done)
    const tasksToUpdate = data.tasks.filter(t => 
      t.id >= fromIdNum && 
      t.status !== 'done' && 
      t.status !== 'completed'
    );
    
    if (tasksToUpdate.length === 0) {
      if (loadingIndicator) {
        stopLoadingIndicator(loadingIndicator, 'No tasks to update');
      }
      
      return { success: true, updated: 0 };
    }
    const timestamp = new Date().toISOString();
    const formattedTime = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const updateNote = `\n\n---\n**[Bulk Update - ${formattedTime}]**\n${prompt}`;
    
    for (const task of tasksToUpdate) {
      if (task.details) {
        task.details += updateNote;
      } else {
        task.details = `**Context Updates:**${updateNote}`;
      }
      task.updatedAt = timestamp;
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Updated ${tasksToUpdate.length} tasks`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Updated ${tasksToUpdate.length} tasks from ID ${fromId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        updated: tasksToUpdate.length,
        taskIds: tasksToUpdate.map(t => t.id)
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold(`✓ Bulk Update Complete`) +
            `\n\n${chalk.cyan('Tasks updated:')} ${tasksToUpdate.length}` +
            `\n${chalk.cyan('ID range:')} ${fromIdNum} - ${Math.max(...tasksToUpdate.map(t => t.id))}` +
            `\n\n${chalk.gray('Update context:')}` +
            `\n${truncate(prompt, 200)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return {
      success: true,
      updated: tasksToUpdate.length
    };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error in bulk update: ${error.message}`);
    throw error;
  }
}

export { editTask, editTasks };
export default editTask;
