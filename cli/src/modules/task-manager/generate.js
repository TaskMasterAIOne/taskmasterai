
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  isSilentMode,
  getConfigDir
} from '../utils.js';
import {
  startLoadingIndicator,
  stopLoadingIndicator,
  getStatusWithColor
} from '../ui.js';

async function generateTaskFiles(tasksPath, options = {}) {
  const {
    output,
    projectRoot,
    context,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    log('info', 'Generating task files...');
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator('Generating task files...');
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data?.tasks || data.tasks.length === 0) {
      if (loadingIndicator) {
        stopLoadingIndicator(loadingIndicator, 'No tasks to generate');
      }
      return { success: true, filesGenerated: 0 };
    }
    
    // Determine output directory
    const configDir = getConfigDir(projectRoot);
    const outputDir = output || path.join(configDir, 'tasks');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const tasks = data.tasks;
    let filesGenerated = 0;
    
    // Generate markdown for each task
    for (const task of tasks) {
      const markdown = generateTaskMarkdown(task);
      const filename = `task_${String(task.id).padStart(3, '0')}.md`;
      const filePath = path.join(outputDir, filename);
      
      fs.writeFileSync(filePath, markdown);
      filesGenerated++;
      
      log('debug', `Generated: ${filename}`);
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Generated ${filesGenerated} task files`);
    }
    
    log('success', `Generated ${filesGenerated} task files in ${outputDir}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        filesGenerated,
        outputDir
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Task Files Generated') +
            `\n\nFiles created: ${chalk.cyan(filesGenerated)}` +
            `\nOutput: ${chalk.gray(outputDir)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, filesGenerated };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Generate error: ${error.message}`);
    throw error;
  }
}

function generateTaskMarkdown(task) {
  const lines = [];
  
  // Header
  lines.push(`# Task ${task.id}: ${task.title}`);
  lines.push('');
  
  // Status badge
  const statusBadge = task.status === 'done' ? '✅' : 
                      task.status === 'in-progress' ? '🔄' : 
                      task.status === 'blocked' ? '🚫' : '⏳';
  lines.push(`**Status:** ${statusBadge} ${task.status || 'pending'}`);
  lines.push(`**Priority:** ${task.priority || 'medium'}`);
  lines.push('');
  
  // Description
  if (task.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(task.description);
    lines.push('');
  }
  
  // Links (dependencies)
  const links = task.links || task.dependencies || [];
  if (links.length > 0) {
    lines.push('## Links');
    lines.push('');
    lines.push(`This task depends on: ${links.join(', ')}`);
    lines.push('');
  }
  
  // Details
  if (task.details) {
    lines.push('## Implementation Details');
    lines.push('');
    lines.push(task.details);
    lines.push('');
  }
  
  // Steps
  const steps = task.steps || task.subtasks || [];
  if (steps.length > 0) {
    lines.push('## Steps');
    lines.push('');
    
    for (const step of steps) {
      const stepStatus = step.status === 'done' ? '✅' : 
                         step.status === 'in-progress' ? '🔄' : '⬜';
      lines.push(`- [${step.status === 'done' ? 'x' : ' '}] **${task.id}.${step.id}**: ${step.title}`);
      
      if (step.description) {
        lines.push(`  - ${step.description}`);
      }
    }
    lines.push('');
  }
  
  // Test Strategy
  if (task.testStrategy) {
    lines.push('## Test Strategy');
    lines.push('');
    lines.push(task.testStrategy);
    lines.push('');
  }
  
  // Metadata
  lines.push('---');
  lines.push('');
  lines.push(`*Created: ${task.createdAt || 'Unknown'}*`);
  if (task.updatedAt) {
    lines.push(`*Updated: ${task.updatedAt}*`);
  }
  
  return lines.join('\n');
}

function generateSingleTaskFile(task, outputDir) {
  const markdown = generateTaskMarkdown(task);
  const filename = `task_${String(task.id).padStart(3, '0')}.md`;
  const filePath = path.join(outputDir, filename);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, markdown);
  return filePath;
}

export {
  generateTaskFiles,
  generateTaskMarkdown,
  generateSingleTaskFile
};

export default generateTaskFiles;
