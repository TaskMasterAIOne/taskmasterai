/**
 * New Task Module
 * Adds a new task using AI or manual input
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "new" instead of "add-task"
 * - "steps" instead of "subtasks"
 * - "links" instead of "dependencies"
 */

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

// Valid priority levels
const TASK_PRIORITY_OPTIONS = ['high', 'medium', 'low'];
const DEFAULT_PRIORITY = 'medium';

/**
 * Add a new task
 * @param {string} tasksPath - Path to the tasks.json file
 * @param {Object} options - Task options
 * @param {string} options.prompt - Description of the task (for AI structuring)
 * @param {string} [options.title] - Direct title (skip AI)
 * @param {string} [options.description] - Direct description
 * @param {Array|string} [options.links] - Task dependencies
 * @param {string} [options.priority] - Task priority (high/medium/low)
 * @param {boolean} [options.useResearch] - Use research AI
 * @param {string} [options.projectRoot] - Project root path
 * @param {string} [options.context] - Context name
 * @param {string} [options.outputFormat] - Output format (text or json)
 * @returns {Promise<Object>} Created task data
 */
async function newTask(tasksPath, options = {}) {
  const {
    prompt,
    title,
    description,
    links = [],
    priority = DEFAULT_PRIORITY,
    useResearch = false,
    projectRoot,
    context,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    // Validate we have something to work with
    if (!prompt && !title) {
      throw new Error('Either prompt or title is required to create a task');
    }
    
    // Validate priority
    const normalizedPriority = priority?.toLowerCase();
    if (!TASK_PRIORITY_OPTIONS.includes(normalizedPriority)) {
      log('warn', `Invalid priority "${priority}". Using default: ${DEFAULT_PRIORITY}`);
    }
    const effectivePriority = TASK_PRIORITY_OPTIONS.includes(normalizedPriority) 
      ? normalizedPriority 
      : DEFAULT_PRIORITY;
    
    // Parse links if string
    let taskLinks = [];
    if (typeof links === 'string') {
      taskLinks = links.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    } else if (Array.isArray(links)) {
      taskLinks = links.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }
    
    log('info', `Creating new task${useResearch ? ' with research' : ''}...`);
    
    // Show loading indicator
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator('Creating task...');
    }
    
    // Read current tasks
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    
    // Initialize tasks array if needed
    if (!data.tasks) {
      data.tasks = [];
    }
    
    // Determine next task ID
    const maxId = data.tasks.length > 0 
      ? Math.max(...data.tasks.map(t => t.id)) 
      : 0;
    const newId = maxId + 1;
    
    // Build task object
    // In production, this would call AI service to structure from prompt
    const newTaskData = {
      id: newId,
      title: title || extractTitle(prompt),
      description: description || prompt,
      status: 'pending',
      priority: effectivePriority,
      links: taskLinks, // Our terminology
      dependencies: taskLinks, // Backward compatibility
      steps: [], // Our terminology
      subtasks: [], // Backward compatibility
      details: prompt !== title ? prompt : null,
      testStrategy: null,
      createdAt: new Date().toISOString()
    };
    
    // Validate links exist
    for (const linkId of taskLinks) {
      const linkedTask = data.tasks.find(t => t.id === linkId);
      if (!linkedTask) {
        log('warn', `Linked task ${linkId} not found - will be created as dependency anyway`);
      }
    }
    
    // Add task
    data.tasks.push(newTaskData);
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Task #${newId} created`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    log('success', `Created task #${newId}: ${newTaskData.title}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        taskId: newId,
        task: newTaskData
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Task Created Successfully') +
            `\n\n${chalk.cyan('ID:')} #${newId}` +
            `\n${chalk.cyan('Title:')} ${newTaskData.title}` +
            `\n${chalk.cyan('Priority:')} ${getPriorityColor(effectivePriority)(effectivePriority)}` +
            `\n${chalk.cyan('Status:')} ${getStatusWithColor('pending', true)}` +
            (taskLinks.length > 0 
              ? `\n${chalk.cyan('Links:')} ${taskLinks.join(', ')}`
              : '') +
            `\n\n${chalk.gray('Description:')}` +
            `\n${truncate(newTaskData.description, 200)}`,
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
            `\n\n${chalk.cyan('View task:')} taskmaster show ${newId}` +
            `\n${chalk.cyan('Break it down:')} taskmaster breakdown --id=${newId}` +
            `\n${chalk.cyan('Start working:')} taskmaster set-status --id=${newId} --status=in-progress`,
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
      taskId: newId,
      task: newTaskData
    };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error creating task: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

/**
 * Extract a title from a prompt
 * @param {string} prompt - Full prompt text
 * @returns {string} Extracted title
 */
function extractTitle(prompt) {
  if (!prompt) return 'New Task';
  
  // Take first sentence or first 60 chars
  const firstSentence = prompt.split(/[.!?\n]/)[0].trim();
  
  if (firstSentence.length <= 60) {
    return firstSentence;
  }
  
  return firstSentence.substring(0, 57) + '...';
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

export { newTask, TASK_PRIORITY_OPTIONS, DEFAULT_PRIORITY };
export default newTask;
