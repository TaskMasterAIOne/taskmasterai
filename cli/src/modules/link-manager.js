
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  formatTaskId,
  isSilentMode,
  log,
  readJSON,
  writeJSON
} from './utils.js';

function taskExists(tasks, taskId) {
  const idStr = String(taskId);
  if (idStr.includes('.')) {
    const [parentId, stepId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    const steps = parentTask?.steps || parentTask?.subtasks || [];
    return steps.some(s => s.id === stepId);
  }
  
  // Regular task
  return tasks.some(t => t.id === Number(taskId));
}

function isCircularLink(tasks, taskId, chain = []) {
  const taskIdStr = String(taskId);
  if (chain.some(id => String(id) === taskIdStr)) {
    return true;
  }
  
  // Find the task or step
  let task = null;
  let parentIdForStep = null;
  
  if (taskIdStr.includes('.')) {
    const [parentId, stepId] = taskIdStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    parentIdForStep = parentId;
    
    const steps = parentTask?.steps || parentTask?.subtasks || [];
    task = steps.find(st => st.id === stepId);
  } else {
    const taskIdNum = parseInt(taskIdStr, 10);
    task = tasks.find(t => t.id === taskIdNum);
  }
  
  if (!task) return false;
  
  // Support both "dependencies" and "links"
  const links = task.dependencies || task.links || [];
  if (links.length === 0) return false;
  const newChain = [...chain, taskIdStr];
  return links.some(linkId => {
    let normalizedLinkId = String(linkId);
    // Normalize relative step references
    if (typeof linkId === 'number' && parentIdForStep !== null) {
      normalizedLinkId = `${parentIdForStep}.${linkId}`;
    }
    return isCircularLink(tasks, normalizedLinkId, newChain);
  });
}

async function addLink(tasksPath, taskId, linkId, context = {}) {
  log('info', `Adding link ${linkId} to task ${taskId}...`);
  
  const data = readJSON(tasksPath, context.projectRoot, context.context);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }
  const formattedTaskId = typeof taskId === 'string' && taskId.includes('.')
    ? taskId
    : parseInt(taskId, 10);
  
  const formattedLinkId = typeof linkId === 'string' && linkId.includes('.')
    ? linkId
    : parseInt(linkId, 10);
  if (!taskExists(data.tasks, formattedLinkId)) {
    log('error', `Link target ${formattedLinkId} does not exist`);
    process.exit(1);
  }
  
  // Find the task to update
  let targetTask = null;
  
  if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
    const [parentId, stepId] = formattedTaskId.split('.').map(Number);
    const parentTask = data.tasks.find(t => t.id === parentId);
    
    if (!parentTask) {
      log('error', `Parent task ${parentId} not found`);
      process.exit(1);
    }
    
    const steps = parentTask.steps || parentTask.subtasks;
    if (!steps) {
      log('error', `Parent task ${parentId} has no steps`);
      process.exit(1);
    }
    
    targetTask = steps.find(s => s.id === stepId);
    if (!targetTask) {
      log('error', `Step ${formattedTaskId} not found`);
      process.exit(1);
    }
  } else {
    targetTask = data.tasks.find(t => t.id === formattedTaskId);
    if (!targetTask) {
      log('error', `Task ${formattedTaskId} not found`);
      process.exit(1);
    }
  }
  
  // Initialize links array - support both field names
  if (!targetTask.dependencies && !targetTask.links) {
    targetTask.dependencies = [];
  }
  const links = targetTask.dependencies || targetTask.links;
  if (links.some(d => String(d) === String(formattedLinkId))) {
    log('warn', `Link ${formattedLinkId} already exists in task ${formattedTaskId}`);
    return;
  }
  if (String(formattedTaskId) === String(formattedLinkId)) {
    log('error', `Task ${formattedTaskId} cannot link to itself`);
    process.exit(1);
  }
  const chain = [formattedTaskId];
  if (!isCircularLink(data.tasks, formattedLinkId, chain)) {
    links.push(formattedLinkId);
    
    // Sort links
    links.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
      }
      const [aP, aC] = String(a).split('.').map(Number);
      const [bP, bC] = String(b).split('.').map(Number);
      if (aP !== bP) return aP - bP;
      return aC - bC;
    });
    
    // Save changes
    writeJSON(tasksPath, data, context.projectRoot, context.context);
    log('success', `Added link ${formattedLinkId} to task ${formattedTaskId}`);
    
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green(`Successfully added link:\n\n`) +
            `Task ${chalk.bold(formattedTaskId)} now depends on ${chalk.bold(formattedLinkId)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1 }
          }
        )
      );
    }
  } else {
    log('error', `Cannot add link ${formattedLinkId} to task ${formattedTaskId} - would create circular dependency`);
    process.exit(1);
  }
}

async function removeLink(tasksPath, taskId, linkId, context = {}) {
  log('info', `Removing link ${linkId} from task ${taskId}...`);
  
  const data = readJSON(tasksPath, context.projectRoot, context.context);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found');
    process.exit(1);
  }
  const formattedTaskId = typeof taskId === 'string' && taskId.includes('.')
    ? taskId
    : parseInt(taskId, 10);
  
  const formattedLinkId = typeof linkId === 'string' && linkId.includes('.')
    ? linkId
    : parseInt(linkId, 10);
  let targetTask = null;
  let isStep = false;
  
  if (typeof formattedTaskId === 'string' && formattedTaskId.includes('.')) {
    const [parentId, stepId] = formattedTaskId.split('.').map(Number);
    const parentTask = data.tasks.find(t => t.id === parentId);
    
    if (!parentTask) {
      log('error', `Parent task ${parentId} not found`);
      process.exit(1);
    }
    
    const steps = parentTask.steps || parentTask.subtasks;
    if (!steps) {
      log('error', `Parent task ${parentId} has no steps`);
      process.exit(1);
    }
    
    targetTask = steps.find(s => s.id === stepId);
    isStep = true;
    
    if (!targetTask) {
      log('error', `Step ${formattedTaskId} not found`);
      process.exit(1);
    }
  } else {
    targetTask = data.tasks.find(t => t.id === formattedTaskId);
    if (!targetTask) {
      log('error', `Task ${formattedTaskId} not found`);
      process.exit(1);
    }
  }
  const links = targetTask.dependencies || targetTask.links || [];
  
  if (links.length === 0) {
    log('info', `Task ${formattedTaskId} has no links, nothing to remove`);
    return;
  }
  const linkIndex = links.findIndex(d => String(d) === String(formattedLinkId));
  
  if (linkIndex === -1) {
    log('info', `Task ${formattedTaskId} does not have link ${formattedLinkId}`);
    return;
  }
  links.splice(linkIndex, 1);
  
  // Save changes
  writeJSON(tasksPath, data, context.projectRoot, context.context);
  log('success', `Removed link: Task ${formattedTaskId} no longer depends on ${formattedLinkId}`);
  
  if (!isSilentMode()) {
    console.log(
      boxen(
        chalk.green(`Successfully removed link:\n\n`) +
          `Task ${chalk.bold(formattedTaskId)} no longer depends on ${chalk.bold(formattedLinkId)}`,
        {
          padding: 1,
          borderColor: 'green',
          borderStyle: 'round',
          margin: { top: 1 }
        }
      )
    );
  }
}

function validateLinks(tasks) {
  const issues = [];
  
  tasks.forEach(task => {
    const links = task.dependencies || task.links || [];
    
    links.forEach(linkId => {
      if (String(linkId) === String(task.id)) {
        issues.push({
          type: 'self',
          taskId: task.id,
          message: `Task ${task.id} links to itself`
        });
        return;
      }
      if (!taskExists(tasks, linkId)) {
        issues.push({
          type: 'missing',
          taskId: task.id,
          linkId,
          message: `Task ${task.id} links to non-existent task ${linkId}`
        });
      }
    });
    if (isCircularLink(tasks, task.id)) {
      issues.push({
        type: 'circular',
        taskId: task.id,
        message: `Task ${task.id} is part of a circular link chain`
      });
    }
    const steps = task.steps || task.subtasks || [];
    steps.forEach(step => {
      const stepLinks = step.dependencies || step.links || [];
      const fullStepId = `${task.id}.${step.id}`;
      
      stepLinks.forEach(linkId => {
        if (String(linkId) === String(fullStepId) ||
            (typeof linkId === 'number' && linkId === step.id)) {
          issues.push({
            type: 'self',
            taskId: fullStepId,
            message: `Step ${fullStepId} links to itself`
          });
          return;
        }
        if (!taskExists(tasks, linkId)) {
          issues.push({
            type: 'missing',
            taskId: fullStepId,
            linkId,
            message: `Step ${fullStepId} links to non-existent task/step ${linkId}`
          });
        }
      });
      if (isCircularLink(tasks, fullStepId)) {
        issues.push({
          type: 'circular',
          taskId: fullStepId,
          message: `Step ${fullStepId} is part of a circular link chain`
        });
      }
    });
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}

function countAllLinks(tasks) {
  let count = 0;
  
  tasks.forEach(task => {
    const links = task.dependencies || task.links || [];
    count += links.length;
    
    const steps = task.steps || task.subtasks || [];
    steps.forEach(step => {
      const stepLinks = step.dependencies || step.links || [];
      count += stepLinks.length;
    });
  });
  
  return count;
}

async function checkLinksCommand(tasksPath, options = {}) {
  const { context = {} } = options;
  log('info', 'Checking for invalid links in task files...');
  
  const data = readJSON(tasksPath, context.projectRoot, context.context);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }
  
  const taskCount = data.tasks.length;
  let stepCount = 0;
  data.tasks.forEach(task => {
    const steps = task.steps || task.subtasks || [];
    stepCount += steps.length;
  });
  
  log('info', `Analyzing links for ${taskCount} tasks and ${stepCount} steps...`);
  
  const validationResult = validateLinks(data.tasks);
  
  if (!validationResult.valid) {
    log('error', `Link validation failed. Found ${validationResult.issues.length} issue(s):`);
    validationResult.issues.forEach(issue => {
      let msg = `  [${issue.type.toUpperCase()}] Task ${issue.taskId}: ${issue.message}`;
      if (issue.linkId) {
        msg += ` (Link: ${issue.linkId})`;
      }
      log('error', msg);
    });
    
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.red(`Link Validation FAILED\n\n`) +
            `${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
            `${chalk.cyan('Steps checked:')} ${stepCount}\n` +
            `${chalk.red('Issues found:')} ${validationResult.issues.length}`,
          {
            padding: 1,
            borderColor: 'red',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 }
          }
        )
      );
    }
  } else {
    log('success', 'No invalid links found - all links are valid');
    
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green(`All Links Are Valid\n\n`) +
            `${chalk.cyan('Tasks checked:')} ${taskCount}\n` +
            `${chalk.cyan('Steps checked:')} ${stepCount}\n` +
            `${chalk.cyan('Total links verified:')} ${countAllLinks(data.tasks)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 }
          }
        )
      );
    }
  }
}

async function fixLinksCommand(tasksPath, options = {}) {
  const { context = {} } = options;
  log('info', 'Checking for and fixing invalid links in tasks.json...');
  
  const data = readJSON(tasksPath, context.projectRoot, context.context);
  if (!data || !data.tasks) {
    log('error', 'No valid tasks found in tasks.json');
    process.exit(1);
  }
  
  const originalData = JSON.parse(JSON.stringify(data));
  
  const stats = {
    invalidLinksRemoved: 0,
    selfLinksRemoved: 0,
    duplicateLinksRemoved: 0,
    tasksFixed: 0,
    stepsFixed: 0
  };
  
  // Fix links in each task
  data.tasks.forEach(task => {
    const links = task.dependencies || task.links || [];
    if (links.length > 0) {
      const originalLength = links.length;
      const uniqueLinks = new Set();
      
      // Filter out duplicates, self-links, and invalid links
      const validLinks = links.filter(linkId => {
        const linkStr = String(linkId);
        if (uniqueLinks.has(linkStr)) {
          stats.duplicateLinksRemoved++;
          return false;
        }
        uniqueLinks.add(linkStr);
        if (linkStr === String(task.id)) {
          stats.selfLinksRemoved++;
          return false;
        }
        if (!taskExists(data.tasks, linkId)) {
          stats.invalidLinksRemoved++;
          return false;
        }
        
        return true;
      });
      if (task.dependencies) {
        task.dependencies = validLinks;
      } else if (task.links) {
        task.links = validLinks;
      }
      
      if (validLinks.length < originalLength) {
        stats.tasksFixed++;
      }
    }
    
    // Fix steps
    const steps = task.steps || task.subtasks || [];
    steps.forEach(step => {
      const stepLinks = step.dependencies || step.links || [];
      if (stepLinks.length > 0) {
        const originalLength = stepLinks.length;
        const uniqueLinks = new Set();
        const fullStepId = `${task.id}.${step.id}`;
        
        const validLinks = stepLinks.filter(linkId => {
          const linkStr = String(linkId);
          if (uniqueLinks.has(linkStr)) {
            stats.duplicateLinksRemoved++;
            return false;
          }
          uniqueLinks.add(linkStr);
          if (linkStr === fullStepId || (typeof linkId === 'number' && linkId === step.id)) {
            stats.selfLinksRemoved++;
            return false;
          }
          if (!taskExists(data.tasks, linkId)) {
            stats.invalidLinksRemoved++;
            return false;
          }
          
          return true;
        });
        if (step.dependencies) {
          step.dependencies = validLinks;
        } else if (step.links) {
          step.links = validLinks;
        }
        
        if (validLinks.length < originalLength) {
          stats.stepsFixed++;
        }
      }
    });
  });
  const dataChanged = JSON.stringify(data) !== JSON.stringify(originalData);
  
  if (dataChanged) {
    writeJSON(tasksPath, data, context.projectRoot, context.context);
    log('success', 'Fixed link issues in tasks.json');
  } else {
    log('info', 'No changes needed to fix links');
  }
  
  const totalFixed = stats.invalidLinksRemoved + stats.selfLinksRemoved + stats.duplicateLinksRemoved;
  
  if (!isSilentMode()) {
    if (totalFixed > 0) {
      log('success', `Fixed ${totalFixed} link issues in total!`);
      
      console.log(
        boxen(
          chalk.green(`Link Fixes Summary:\n\n`) +
            `${chalk.cyan('Invalid links removed:')} ${stats.invalidLinksRemoved}\n` +
            `${chalk.cyan('Self-links removed:')} ${stats.selfLinksRemoved}\n` +
            `${chalk.cyan('Duplicate links removed:')} ${stats.duplicateLinksRemoved}\n\n` +
            `${chalk.cyan('Tasks fixed:')} ${stats.tasksFixed}\n` +
            `${chalk.cyan('Steps fixed:')} ${stats.stepsFixed}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 }
          }
        )
      );
    } else {
      log('success', 'No link issues found - all links are valid');
      
      console.log(
        boxen(
          chalk.green(`All Links Are Valid\n\n`) +
            `${chalk.cyan('Tasks checked:')} ${data.tasks.length}\n` +
            `${chalk.cyan('Total links verified:')} ${countAllLinks(data.tasks)}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 }
          }
        )
      );
    }
  }
}

export {
  addLink,
  removeLink,
  isCircularLink,
  validateLinks,
  checkLinksCommand,
  fixLinksCommand,
  taskExists,
  countAllLinks
};

export default {
  addLink,
  removeLink,
  isCircularLink,
  validateLinks,
  checkLinksCommand,
  fixLinksCommand,
  taskExists,
  countAllLinks
};
