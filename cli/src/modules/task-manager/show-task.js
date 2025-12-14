/**
 * Show Task Module
 * Displays detailed task information
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "steps" instead of "subtasks"
 * - "links" instead of "dependencies"
 * - "assessment" instead of "complexity"
 */

import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  log,
  readJSON,
  findTaskById,
  readAssessmentReport,
  truncate,
  isSilentMode
} from '../utils.js';
import {
  getStatusWithColor,
  getAssessmentWithColor,
  formatDependenciesWithStatus
} from '../ui.js';

/**
 * Show detailed information for a task or step
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {string} taskIdInput - Task ID(s) to show (comma-separated)
 * @param {Object} options - Additional options
 * @param {string} [options.projectRoot] - Project root path
 * @param {string} [options.context] - Context name
 * @param {string} [options.outputFormat] - Output format (text or json)
 * @returns {Object} Task data
 */
async function showTask(tasksPath, taskIdInput, options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    log('info', `Reading tasks from ${tasksPath}...`);
    
    // Read tasks data
    const data = readJSON(tasksPath, projectRoot, context);
    
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    
    // Read assessment report if available
    const assessmentReport = readAssessmentReport(null, projectRoot);
    
    // Handle multiple task IDs
    const taskIds = taskIdInput.split(',').map(id => id.trim());
    const foundTasks = [];
    
    for (const id of taskIds) {
      const task = findTaskById(data.tasks, id, assessmentReport);
      if (task) {
        foundTasks.push(task);
      } else {
        log('warn', `Task ${id} not found`);
      }
    }
    
    if (foundTasks.length === 0) {
      throw new Error(`No tasks found for ID(s): ${taskIdInput}`);
    }
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        tasks: foundTasks
      };
    }
    
    // Text output - display each task
    for (const task of foundTasks) {
      displayTaskDetails(task, data.tasks, assessmentReport);
    }
    
    return {
      success: true,
      tasks: foundTasks
    };
    
  } catch (error) {
    log('error', `Error showing task: ${error.message}`);
    
    if (!isSilentMode()) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

/**
 * Display detailed task information
 * @param {Object} task - Task object to display
 * @param {Array} allTasks - All tasks for link resolution
 * @param {Object} assessmentReport - Assessment report for scoring
 */
function displayTaskDetails(task, allTasks, assessmentReport) {
  const isStep = task.isStep || String(task.id).includes('.');
  const itemType = isStep ? 'Step' : 'Task';
  
  // Get links (dependencies)
  const links = task.dependencies || task.links || [];
  const linksDisplay = links.length > 0
    ? formatDependenciesWithStatus(links, allTasks, true)
    : chalk.gray('None');
  
  // Get steps if this is a parent task
  const steps = task.steps || task.subtasks || [];
  
  // Build content
  let content = '';
  
  // Header
  content += chalk.white.bold(`${itemType} #${task.id}: ${task.title}\n\n`);
  
  // Status and Priority
  content += `${chalk.cyan('Status:')} ${getStatusWithColor(task.status, true)}   `;
  content += `${chalk.cyan('Priority:')} ${getPriorityColor(task.priority)(task.priority || 'medium')}\n`;
  
  // Links
  content += `${chalk.cyan('Links:')} ${linksDisplay}\n`;
  
  // Assessment score if available
  if (task.assessmentScore) {
    content += `${chalk.cyan('Assessment:')} ${getAssessmentWithColor(task.assessmentScore)}\n`;
  }
  
  // Description
  content += `\n${chalk.cyan('Description:')}\n`;
  content += `${task.description || 'No description available.'}\n`;
  
  // Details
  if (task.details) {
    content += `\n${chalk.cyan('Implementation Details:')}\n`;
    content += `${task.details}\n`;
  }
  
  // Test Strategy
  if (task.testStrategy) {
    content += `\n${chalk.cyan('Test Strategy:')}\n`;
    content += `${task.testStrategy}\n`;
  }
  
  // Steps (if parent task has them)
  if (steps.length > 0) {
    content += `\n${chalk.cyan('Steps:')}\n`;
    steps.forEach(step => {
      const stepStatus = getStatusWithColor(step.status, true);
      content += `  ${chalk.cyan(`${task.id}.${step.id}`)} [${stepStatus}] ${step.title}\n`;
    });
  }
  
  // Display in a box
  console.log(
    boxen(content, {
      padding: 1,
      borderColor: 'cyan',
      borderStyle: 'round',
      title: `📋 ${itemType} Details`,
      titleAlignment: 'center'
    })
  );
  
  // Suggested actions
  const actions = [];
  
  if (task.status === 'pending') {
    actions.push(`${chalk.cyan('Start working:')} taskmaster set-status --id=${task.id} --status=in-progress`);
  }
  
  if (task.status === 'in-progress') {
    actions.push(`${chalk.cyan('Mark complete:')} taskmaster set-status --id=${task.id} --status=done`);
  }
  
  if (!isStep && steps.length === 0) {
    actions.push(`${chalk.cyan('Break down:')} taskmaster breakdown --id=${task.id}`);
  }
  
  if (actions.length > 0) {
    console.log(
      boxen(
        chalk.white.bold('Suggested Actions:\n\n') + actions.join('\n'),
        {
          padding: 1,
          borderColor: 'gray',
          borderStyle: 'round',
          margin: { top: 1 }
        }
      )
    );
  }
}

/**
 * Get priority color function
 * @param {string} priority - Priority level
 * @returns {Function} Chalk color function
 */
function getPriorityColor(priority) {
  const colors = {
    high: chalk.red.bold,
    medium: chalk.yellow,
    low: chalk.gray
  };
  return colors[priority] || chalk.white;
}

export default showTask;
