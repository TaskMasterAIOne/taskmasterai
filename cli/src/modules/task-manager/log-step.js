
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

async function logStep(tasksPath, stepId, prompt, options = {}) {
  const { projectRoot, context, useResearch = false, outputFormat = 'text' } = options;
  
  let loadingIndicator = null;
  
  try {

    if (!stepId || typeof stepId !== 'string' || !stepId.includes('.')) {
      throw new Error(
        `Invalid step ID format: ${stepId}. Step ID must be in format "parentId.stepId" (e.g., "1.2")`
      );
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      throw new Error('Prompt cannot be empty. Please provide information to log.');
    }

    if (!fs.existsSync(tasksPath)) {
      throw new Error(`Tasks file not found at: ${tasksPath}`);
    }
    
    log('info', `Logging to step ${stepId}: "${truncate(prompt, 50)}..."`);
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator(`Updating step ${stepId}...`);
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks) {
      throw new Error('No valid tasks found in tasks file');
    }

    const [parentIdStr, stepIdStr] = stepId.split('.');
    const parentId = parseInt(parentIdStr, 10);
    const stepIdNum = parseInt(stepIdStr, 10);
    
    if (isNaN(parentId) || parentId <= 0 || isNaN(stepIdNum) || stepIdNum <= 0) {
      throw new Error(
        `Invalid step ID format: ${stepId}. Both parent and step IDs must be positive integers.`
      );
    }
    
    // Find parent task
    const parentTask = data.tasks.find(task => task.id === parentId);
    if (!parentTask) {
      throw new Error(`Parent task ${parentId} not found`);
    }
    
    // Support both field names
    const stepsField = parentTask.steps ? 'steps' : 'subtasks';
    const steps = parentTask[stepsField];
    
    if (!steps || !Array.isArray(steps)) {
      throw new Error(`Parent task ${parentId} has no steps`);
    }
    
    // Find step
    const step = steps.find(s => s.id === stepIdNum);
    if (!step) {
      throw new Error(`Step ${stepId} not found in parent task ${parentId}`);
    }
    const timestamp = new Date().toISOString();
    const formattedTime = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Build log entry
    const logEntry = `\n\n---\n**[${formattedTime}]**\n${prompt}`;
    if (step.details) {
      step.details += logEntry;
    } else {
      step.details = `**Implementation Log:**${logEntry}`;
    }
    step.updatedAt = timestamp;
    
    // Stop loading indicator
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Step ${stepId} updated`);
    }
    
    // Write changes back
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Successfully logged to step ${stepId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        stepId,
        parentId,
        timestamp,
        step: {
          id: step.id,
          title: step.title,
          status: step.status,
          detailsLength: step.details?.length || 0
        }
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      const stepStatus = getStatusWithColor(step.status, true);
      
      console.log(
        boxen(
          chalk.green.bold('✓ Step Updated Successfully') +
            `\n\n${chalk.cyan('Step:')} ${stepId} - ${step.title}` +
            `\n${chalk.cyan('Status:')} ${stepStatus}` +
            `\n${chalk.cyan('Time:')} ${formattedTime}` +
            `\n\n${chalk.gray('Entry added:')}` +
            `\n${chalk.white(truncate(prompt, 200))}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
      
      // Suggested next actions
      console.log(
        boxen(
          chalk.white.bold('Next Actions:') +
            `\n\n${chalk.cyan('View step:')} taskmaster show ${stepId}` +
            `\n${chalk.cyan('Complete step:')} taskmaster set-status --id=${stepId} --status=done` +
            `\n${chalk.cyan('View task:')} taskmaster show ${parentId}`,
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
      stepId,
      parentId,
      timestamp,
      step
    };
    
  } catch (error) {
    // Stop loading indicator on error
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error logging to step: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

export default logStep;
