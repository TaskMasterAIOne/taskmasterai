
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  log,
  readJSON,
  writeJSON,
  truncate,
  findProjectRoot,
  isSilentMode,
  getConfigDir
} from './utils.js';
import { getStatusWithColor } from './ui.js';

function getCurrentContext(projectRoot = null) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const statePath = path.join(getConfigDir(root), 'state.json');
  
  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      return state.currentContext || state.currentTag || 'main';
    }
  } catch (error) {
    log('debug', `Could not read state file: ${error.message}`);
  }
  
  return 'main';
}

function setCurrentContext(contextName, projectRoot = null) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const configDir = getConfigDir(root);
  const statePath = path.join(configDir, 'state.json');
  
  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  let state = {};
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    }
  } catch (error) {
    log('debug', `Could not read state file: ${error.message}`);
  }
  state.currentContext = contextName;
  state.currentTag = contextName; // Keep backward compatibility
  state.lastSwitched = new Date().toISOString();
  
  // Write state
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function getTasksForContext(rawData, contextName) {
  // Support both "contexts" and legacy "tags" structure
  if (rawData.contexts && rawData.contexts[contextName]) {
    return rawData.contexts[contextName].tasks || [];
  }
  if (rawData[contextName] && rawData[contextName].tasks) {
    return rawData[contextName].tasks;
  }
  return [];
}

async function listContexts(tasksPath, options = {}) {
  const { projectRoot, showMetadata = false, outputFormat = 'text' } = options;
  
  try {
    log('info', 'Listing all contexts...');
    const data = readJSON(tasksPath, projectRoot);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    let rawData = data._rawTaggedData || data;
    
    // Filter out internal fields
    const contextNames = Object.keys(rawData).filter(
      key => !key.startsWith('_') && key !== 'tag' && key !== 'tasks' && key !== 'metadata'
    );
    const currentContext = getCurrentContext(projectRoot);
    
    // Build context info
    const contexts = contextNames.map(name => {
      const contextData = rawData[name];
      const tasks = contextData?.tasks || [];
      const metadata = contextData?.metadata || {};
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      // Count steps
      let totalSteps = 0;
      let completedSteps = 0;
      tasks.forEach(task => {
        const steps = task.steps || task.subtasks || [];
        totalSteps += steps.length;
        completedSteps += steps.filter(s => s.status === 'done' || s.status === 'completed').length;
      });
      
      return {
        name,
        isCurrent: name === currentContext,
        tasks: totalTasks,
        completed: completedTasks,
        completionPct,
        steps: totalSteps,
        completedSteps,
        description: metadata.description || '',
        created: metadata.created || null,
        updated: metadata.updated || null
      };
    });
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        currentContext,
        contexts
      };
    }
    
    // Text output
    if (contexts.length === 0) {
      console.log(
        boxen(
          chalk.yellow('No contexts found. Create one with:\n\n') +
            chalk.cyan('taskmaster context-add <name>'),
          { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
        )
      );
      return { success: true, contexts: [] };
    }
    const table = new Table({
      head: [
        chalk.cyan.bold(''),
        chalk.cyan.bold('Context'),
        chalk.cyan.bold('Tasks'),
        chalk.cyan.bold('Progress'),
        chalk.cyan.bold('Description')
      ],
      colWidths: [3, 20, 10, 15, 40]
    });
    
    contexts.forEach(ctx => {
      const marker = ctx.isCurrent ? chalk.green('▶') : ' ';
      const name = ctx.isCurrent ? chalk.green.bold(ctx.name) : chalk.white(ctx.name);
      const tasks = `${ctx.completed}/${ctx.tasks}`;
      const progress = ctx.completionPct > 0 
        ? chalk.green(`${ctx.completionPct}%`)
        : chalk.gray('0%');
      const desc = truncate(ctx.description, 38);
      
      table.push([marker, name, tasks, progress, desc]);
    });
    
    console.log('\n' + chalk.white.bold('Available Contexts:'));
    console.log(table.toString());
    
    console.log(
      boxen(
        `${chalk.cyan('Current context:')} ${chalk.green.bold(currentContext)}\n\n` +
          `${chalk.cyan('Switch context:')} taskmaster context <name>\n` +
          `${chalk.cyan('Create new:')} taskmaster context-add <name>`,
        {
          padding: 1,
          borderColor: 'gray',
          borderStyle: 'round',
          margin: { top: 1 }
        }
      )
    );
    
    return { success: true, currentContext, contexts };
    
  } catch (error) {
    log('error', `Error listing contexts: ${error.message}`);
    throw error;
  }
}

async function createContext(tasksPath, contextName, options = {}) {
  const { projectRoot, copyFromCurrent = false, copyFrom, description, outputFormat = 'text' } = options;
  
  try {

    if (!contextName || typeof contextName !== 'string') {
      throw new Error('Context name is required');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(contextName)) {
      throw new Error('Context name can only contain letters, numbers, hyphens, and underscores');
    }
    
    log('info', `Creating new context: ${contextName}`);
    const data = readJSON(tasksPath, projectRoot);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    let rawData = data._rawTaggedData || data;
    if (rawData[contextName]) {
      throw new Error(`Context "${contextName}" already exists`);
    }
    
    // Determine source tasks
    let sourceTasks = [];
    let sourceContext = null;
    
    if (copyFromCurrent || copyFrom) {
      sourceContext = copyFrom || getCurrentContext(projectRoot);
      sourceTasks = getTasksForContext(rawData, sourceContext);
      log('info', `Copying ${sourceTasks.length} tasks from context "${sourceContext}"`);
    }
    rawData[contextName] = {
      tasks: JSON.parse(JSON.stringify(sourceTasks)), // Deep copy
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        description: description || `Context created on ${new Date().toLocaleDateString()}`
      }
    };
    
    // Clean and write
    const cleanData = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!key.startsWith('_')) {
        cleanData[key] = value;
      }
    }
    
    writeJSON(tasksPath, cleanData, projectRoot);
    
    log('success', `Successfully created context "${contextName}"`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        contextName,
        tasksCopied: sourceTasks.length,
        sourceContext
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Context Created Successfully') +
            `\n\nContext Name: ${chalk.cyan(contextName)}` +
            (sourceTasks.length > 0 ? `\nTasks Copied: ${chalk.yellow(sourceTasks.length)}` : '') +
            (sourceContext ? `\nFrom Context: ${chalk.gray(sourceContext)}` : '') +
            `\n\n${chalk.gray('Switch to it:')} taskmaster context ${contextName}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, contextName, tasksCopied: sourceTasks.length };
    
  } catch (error) {
    log('error', `Error creating context: ${error.message}`);
    throw error;
  }
}

async function useContext(tasksPath, contextName, options = {}) {
  const { projectRoot, outputFormat = 'text' } = options;
  
  try {
    log('info', `Switching to context: ${contextName}`);
    const data = readJSON(tasksPath, projectRoot);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    const rawData = data._rawTaggedData || data;
    if (!rawData[contextName]) {
      // List available contexts
      const available = Object.keys(rawData).filter(k => !k.startsWith('_'));
      throw new Error(
        `Context "${contextName}" not found. Available: ${available.join(', ')}`
      );
    }
    setCurrentContext(contextName, projectRoot);
    const tasks = rawData[contextName].tasks || [];
    const completedTasks = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    
    log('success', `Switched to context "${contextName}"`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        context: contextName,
        stats: {
          total: tasks.length,
          completed: completedTasks,
          pending: pendingTasks,
          inProgress: inProgressTasks
        }
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold(`✓ Switched to Context: ${contextName}`) +
            `\n\n${chalk.cyan('Tasks:')} ${tasks.length} total, ${chalk.green(completedTasks + ' done')}, ` +
            `${chalk.blue(inProgressTasks + ' in-progress')}, ${chalk.yellow(pendingTasks + ' pending')}` +
            `\n\n${chalk.gray('View tasks:')} taskmaster list`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, context: contextName };
    
  } catch (error) {
    log('error', `Error switching context: ${error.message}`);
    throw error;
  }
}

async function deleteContext(tasksPath, contextName, options = {}) {
  const { projectRoot, force = false, outputFormat = 'text' } = options;
  
  try {
    // Prevent deleting main context
    if (contextName === 'main' || contextName === 'master') {
      throw new Error('Cannot delete the main context');
    }
    
    log('info', `Deleting context: ${contextName}`);
    const data = readJSON(tasksPath, projectRoot);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    let rawData = data._rawTaggedData || data;
    if (!rawData[contextName]) {
      throw new Error(`Context "${contextName}" not found`);
    }
    
    const taskCount = rawData[contextName].tasks?.length || 0;

    delete rawData[contextName];
    const currentContext = getCurrentContext(projectRoot);
    if (currentContext === contextName) {
      setCurrentContext('main', projectRoot);
      log('info', 'Switched to main context');
    }
    
    // Clean and write
    const cleanData = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!key.startsWith('_')) {
        cleanData[key] = value;
      }
    }
    
    writeJSON(tasksPath, cleanData, projectRoot);
    
    log('success', `Deleted context "${contextName}" (${taskCount} tasks removed)`);
    
    // JSON output
    if (outputFormat === 'json') {
      return { success: true, contextName, tasksDeleted: taskCount };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold(`✓ Context Deleted: ${contextName}`) +
            `\n\n${chalk.gray('Tasks removed:')} ${taskCount}`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, contextName, tasksDeleted: taskCount };
    
  } catch (error) {
    log('error', `Error deleting context: ${error.message}`);
    throw error;
  }
}

async function cloneContext(tasksPath, sourceName, targetName, options = {}) {
  const { projectRoot, description, outputFormat = 'text' } = options;
  
  return createContext(tasksPath, targetName, {
    projectRoot,
    copyFrom: sourceName,
    description: description || `Cloned from ${sourceName}`,
    outputFormat
  });
}

async function renameContext(tasksPath, oldName, newName, options = {}) {
  const { projectRoot, outputFormat = 'text' } = options;
  
  try {

    if (!oldName || typeof oldName !== 'string') {
      throw new Error('Old context name is required');
    }
    if (!newName || typeof newName !== 'string') {
      throw new Error('New context name is required');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      throw new Error('New context name can only contain letters, numbers, hyphens, and underscores');
    }
    
    // Prevent renaming main context
    if (oldName === 'main' || oldName === 'master') {
      throw new Error('Cannot rename the main context');
    }
    
    // Reserved context names
    const reservedNames = ['main', 'master', 'default'];
    if (reservedNames.includes(newName.toLowerCase())) {
      throw new Error(`"${newName}" is a reserved context name`);
    }
    
    log('info', `Renaming context from "${oldName}" to "${newName}"`);
    const data = readJSON(tasksPath, projectRoot);
    if (!data) {
      throw new Error('Could not read tasks file');
    }
    let rawData = data._rawTaggedData || data;
    if (!rawData[oldName]) {
      throw new Error(`Context "${oldName}" does not exist`);
    }
    if (rawData[newName]) {
      throw new Error(`Context "${newName}" already exists`);
    }
    const currentContext = getCurrentContext(projectRoot);
    const isCurrentContext = currentContext === oldName;
    rawData[newName] = { ...rawData[oldName] };
    if (rawData[newName].metadata) {
      rawData[newName].metadata.renamed = {
        from: oldName,
        date: new Date().toISOString()
      };
      rawData[newName].metadata.updated = new Date().toISOString();
    }

    delete rawData[oldName];
    if (isCurrentContext) {
      setCurrentContext(newName, projectRoot);
      log('info', `Updated current context to "${newName}"`);
    }
    
    // Clean and write
    const cleanData = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!key.startsWith('_')) {
        cleanData[key] = value;
      }
    }
    
    writeJSON(tasksPath, cleanData, projectRoot);
    const taskCount = rawData[newName].tasks?.length || 0;
    
    log('success', `Renamed context from "${oldName}" to "${newName}"`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        oldName,
        newName,
        taskCount,
        wasCurrentContext: isCurrentContext
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold(`✓ Context Renamed Successfully`) +
            `\n\nOld Name: ${chalk.gray(oldName)}` +
            `\nNew Name: ${chalk.cyan(newName)}` +
            `\nTasks: ${chalk.yellow(taskCount)}` +
            (isCurrentContext ? `\n${chalk.green('✓ Current context updated')}` : ''),
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true, oldName, newName, taskCount };
    
  } catch (error) {
    log('error', `Error renaming context: ${error.message}`);
    throw error;
  }
}

async function createContextFromBranch(tasksPath, options = {}) {
  const { projectRoot, copyFromCurrent = false, description, autoSwitch = true, outputFormat = 'text' } = options;
  
  try {
    const { getCurrentBranch, sanitizeBranchNameForContext, isValidBranchForContext } = await import('./utils/git-utils.js');
    
    const root = projectRoot || findProjectRoot() || process.cwd();
    const branchName = await getCurrentBranch(root);
    if (!branchName) {
      throw new Error('Could not determine current git branch. Are you in a git repository?');
    }
    if (!isValidBranchForContext(branchName)) {
      throw new Error(`Branch "${branchName}" cannot be converted to a valid context name`);
    }
    
    // Sanitize branch name to create context name
    const contextName = sanitizeBranchNameForContext(branchName);
    
    log('info', `Creating context "${contextName}" from git branch "${branchName}"`);
    const createResult = await createContext(tasksPath, contextName, {
      projectRoot: root,
      copyFromCurrent,
      description: description || `Context created from git branch "${branchName}"`,
      outputFormat
    });
    
    // Auto-switch to the new context if requested
    if (autoSwitch && createResult.success) {
      setCurrentContext(contextName, root);
      log('info', `Switched to context "${contextName}"`);
    }
    
    return {
      ...createResult,
      branchName,
      contextName,
      autoSwitched: autoSwitch
    };
    
  } catch (error) {
    log('error', `Error creating context from branch: ${error.message}`);
    throw error;
  }
}

export {
  getCurrentContext,
  setCurrentContext,
  getTasksForContext,
  listContexts,
  createContext,
  useContext,
  deleteContext,
  cloneContext,
  renameContext,
  createContextFromBranch
};

export default {
  getCurrentContext,
  setCurrentContext,
  getTasksForContext,
  listContexts,
  createContext,
  useContext,
  deleteContext,
  cloneContext,
  renameContext,
  createContextFromBranch
};
