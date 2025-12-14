/**
 * Sync README Module
 * Exports tasks to project README.md file
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "steps" instead of "subtasks"
 * - "links" instead of "dependencies"
 * - "contexts" instead of "tags"
 */

import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  findProjectRoot,
  isSilentMode,
  getTasksFilePath
} from '../utils.js';
import { getCurrentContext } from '../context-manager.js';

/**
 * Generate markdown table row for a task
 * @param {Object} task - Task object
 * @param {boolean} showSteps - Whether to include steps count
 * @returns {string} Markdown table row
 */
function generateTaskRow(task, showSteps = false) {
  const status = task.status === 'done' ? '✅' : 
                 task.status === 'in-progress' ? '🔄' :
                 task.status === 'blocked' ? '🚫' : '⏳';
  
  const priority = task.priority === 'high' ? '🔴' :
                   task.priority === 'medium' ? '🟡' : '🟢';
  
  const stepsInfo = showSteps && task.steps?.length > 0 
    ? ` (${task.steps.filter(s => s.status === 'done').length}/${task.steps.length} steps)`
    : '';
  
  const title = task.title.replace(/\|/g, '\\|'); // Escape pipe characters
  const description = (task.description || '').replace(/\|/g, '\\|').substring(0, 100);
  
  return `| ${task.id} | ${status} | ${priority} | ${title}${stepsInfo} | ${description}${description.length >= 100 ? '...' : ''} |`;
}

/**
 * Generate task list section for README
 * @param {Array} tasks - Array of tasks
 * @param {Object} options - Options
 * @param {boolean} [options.withSteps] - Include steps in output
 * @param {string} [options.status] - Filter by status
 * @returns {string} Markdown content
 */
function generateTaskListMarkdown(tasks, options = {}) {
  const { withSteps = false, status = null } = options;
  
  // Filter tasks by status if specified
  let filteredTasks = tasks;
  if (status) {
    const statusList = status.split(',').map(s => s.trim().toLowerCase());
    filteredTasks = tasks.filter(t => statusList.includes((t.status || 'pending').toLowerCase()));
  }
  
  if (filteredTasks.length === 0) {
    return '*No tasks to display.*\n';
  }
  
  let markdown = '';
  
  // Table header
  markdown += '| ID | Status | Priority | Title | Description |\n';
  markdown += '|----|--------|----------|-------|-------------|\n';
  
  // Task rows
  filteredTasks.forEach(task => {
    markdown += generateTaskRow(task, withSteps) + '\n';
    
    // Optionally include steps as indented items
    if (withSteps && task.steps && task.steps.length > 0) {
      task.steps.forEach(step => {
        const stepStatus = step.status === 'done' ? '✅' : '⏳';
        const stepTitle = (step.title || '').replace(/\|/g, '\\|');
        markdown += `| ${task.id}.${step.id} | ${stepStatus} | - | ↳ ${stepTitle} | |\n`;
      });
    }
  });
  
  return markdown;
}

/**
 * Generate progress statistics
 * @param {Array} tasks - Array of tasks
 * @returns {string} Markdown content with stats
 */
function generateProgressStats(tasks) {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  
  // Generate progress bar
  const barLength = 20;
  const filledLength = Math.round((progressPct / 100) * barLength);
  const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  
  let stats = `### Progress: ${progressPct}%\n\n`;
  stats += `\`${progressBar}\` ${done}/${total} tasks completed\n\n`;
  stats += `- ✅ Done: ${done}\n`;
  stats += `- 🔄 In Progress: ${inProgress}\n`;
  stats += `- ⏳ Pending: ${pending}\n`;
  if (blocked > 0) {
    stats += `- 🚫 Blocked: ${blocked}\n`;
  }
  
  return stats;
}

/**
 * Sync tasks to README.md file
 * @param {Object} options - Sync options
 * @param {string} [options.projectRoot] - Project root directory
 * @param {string} [options.status] - Filter by status
 * @param {boolean} [options.withSteps] - Include steps
 * @param {string} [options.context] - Context name
 * @param {string} [options.outputFormat] - Output format (text or json)
 * @returns {Object} Sync result
 */
async function syncReadme(options = {}) {
  const { 
    projectRoot: providedRoot, 
    status = null, 
    withSteps = false, 
    context,
    outputFormat = 'text' 
  } = options;
  
  try {
    const projectRoot = providedRoot || findProjectRoot() || process.cwd();
    const readmePath = path.join(projectRoot, 'README.md');
    const tasksPath = getTasksFilePath(projectRoot);
    
    // Get current context
    const currentContext = context || getCurrentContext(projectRoot);
    
    log('info', `Syncing tasks from context "${currentContext}" to README.md...`);
    
    // Read tasks
    const data = readJSON(tasksPath, projectRoot, currentContext);
    if (!data || !data.tasks || data.tasks.length === 0) {
      if (outputFormat === 'json') {
        return { success: false, error: 'No tasks found', tasksCount: 0 };
      }
      console.log(chalk.yellow('No tasks found to sync.'));
      return { success: false, tasksCount: 0 };
    }
    
    const tasks = data.tasks;
    
    // Generate the task section
    const startMarker = '<!-- TASKMASTER-AI:START -->';
    const endMarker = '<!-- TASKMASTER-AI:END -->';
    
    let taskSection = `${startMarker}\n`;
    taskSection += `## 📋 Project Tasks\n\n`;
    taskSection += `*Auto-generated by [TaskMaster AI](https://taskmaster.one) on ${new Date().toLocaleDateString()}*\n\n`;
    taskSection += generateProgressStats(tasks);
    taskSection += '\n### Task List\n\n';
    taskSection += generateTaskListMarkdown(tasks, { withSteps, status });
    taskSection += `\n${endMarker}`;
    
    // Read existing README or create new
    let readmeContent = '';
    if (fs.existsSync(readmePath)) {
      readmeContent = fs.readFileSync(readmePath, 'utf-8');
    }
    
    // Check if markers exist
    const hasMarkers = readmeContent.includes(startMarker) && readmeContent.includes(endMarker);
    
    if (hasMarkers) {
      // Replace existing section
      const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'g');
      readmeContent = readmeContent.replace(regex, taskSection);
    } else {
      // Append to end of README
      readmeContent = readmeContent.trim() + '\n\n' + taskSection + '\n';
    }
    
    // Write back
    fs.writeFileSync(readmePath, readmeContent, 'utf-8');
    
    log('success', `Synced ${tasks.length} tasks to README.md`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        tasksCount: tasks.length,
        readmePath,
        context: currentContext,
        action: hasMarkers ? 'updated' : 'appended'
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ README Synced Successfully') +
            `\n\n${chalk.cyan('Tasks synced:')} ${tasks.length}` +
            `\n${chalk.cyan('Context:')} ${currentContext}` +
            `\n${chalk.cyan('File:')} ${path.relative(process.cwd(), readmePath)}` +
            `\n${chalk.cyan('Action:')} ${hasMarkers ? 'Updated existing section' : 'Appended new section'}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, tasksCount: tasks.length };
    
  } catch (error) {
    log('error', `Error syncing README: ${error.message}`);
    throw error;
  }
}

export { syncReadme, generateTaskListMarkdown, generateProgressStats };
export default syncReadme;
