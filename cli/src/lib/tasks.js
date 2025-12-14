/**
 * Task Manager for TaskMaster AI
 * Handles task CRUD operations and state management
 */

import fs from 'fs';
import path from 'path';
import { readTasks, writeTasks, findProjectRoot, readState, writeState, getProjectConfigDir, readProjectConfig } from './config.js';
import { syncTasksToCloud } from './license.js';

/**
 * Get the current tag from state or default to 'master'
 */
export function getCurrentTag(projectRoot = process.cwd()) {
  const state = readState(projectRoot);
  return state.currentTag || 'master';
}

/**
 * Set the current tag in state
 */
export function setCurrentTag(tag, projectRoot = process.cwd()) {
  const state = readState(projectRoot);
  state.currentTag = tag;
  state.lastSwitched = new Date().toISOString();
  writeState(state, projectRoot);
  return tag;
}

/**
 * Get tasks for a specific tag
 */
export function getTasksForTag(tag = 'master', projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[tag]) {
    return [];
  }
  
  return tasksData.tags[tag].tasks || [];
}

/**
 * Get all tasks
 */
export function getAllTasks(projectRoot = process.cwd()) {
  const tag = getCurrentTag(projectRoot);
  return getTasksForTag(tag, projectRoot);
}

/**
 * Save tasks for a specific tag
 */
export function saveTasksForTag(tasks, tag = 'master', projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags) {
    tasksData.tags = {};
  }
  
  if (!tasksData.tags[tag]) {
    tasksData.tags[tag] = {
      tasks: [],
      metadata: {
        createdAt: new Date().toISOString(),
      }
    };
  }
  
  tasksData.tags[tag].tasks = tasks;
  tasksData.tags[tag].metadata.updatedAt = new Date().toISOString();
  
  writeTasks(tasksData, projectRoot);
  
  // Sync to cloud (non-blocking, fire and forget)
  try {
    const config = readProjectConfig(projectRoot);
    const projectId = config.projectName || path.basename(projectRoot);
    syncTasksToCloud(tasks, {
      projectId,
      tag,
      metadata: tasksData.tags[tag].metadata,
    }).catch(() => {}); // Silently ignore sync errors
  } catch (e) {
    // Ignore sync errors - CLI should work offline
  }
}

/**
 * Save all tasks (to current tag)
 */
export function saveAllTasks(tasks, projectRoot = process.cwd()) {
  const tag = getCurrentTag(projectRoot);
  saveTasksForTag(tasks, tag, projectRoot);
}

/**
 * Find a task by ID
 */
export function findTaskById(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
  
  // Check if it's a subtask ID (e.g., "1.2")
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask && parentTask.subtasks) {
      const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        return { ...subtask, parentId, isSubtask: true };
      }
    }
    return null;
  }
  
  // Regular task ID
  return tasks.find(t => t.id === Number(taskId)) || null;
}

/**
 * Get the next available task ID
 */
export function getNextTaskId(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  if (tasks.length === 0) return 1;
  
  const maxId = Math.max(...tasks.map(t => t.id));
  return maxId + 1;
}

/**
 * Add a new task
 */
export function addTask(task, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const newId = getNextTaskId(projectRoot);
  
  const newTask = {
    id: newId,
    ...task,
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    dependencies: task.dependencies || [],
    subtasks: task.subtasks || [],
  };
  
  tasks.push(newTask);
  saveAllTasks(tasks, projectRoot);
  
  return newTask;
}

/**
 * Update a task
 */
export function updateTask(taskId, updates, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
  
  // Check if it's a subtask
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask && parentTask.subtasks) {
      const subtaskIndex = parentTask.subtasks.findIndex(s => s.id === subtaskId);
      if (subtaskIndex !== -1) {
        parentTask.subtasks[subtaskIndex] = {
          ...parentTask.subtasks[subtaskIndex],
          ...updates,
        };
        saveAllTasks(tasks, projectRoot);
        return parentTask.subtasks[subtaskIndex];
      }
    }
    return null;
  }
  
  // Regular task
  const taskIndex = tasks.findIndex(t => t.id === Number(taskId));
  if (taskIndex === -1) return null;
  
  tasks[taskIndex] = {
    ...tasks[taskIndex],
    ...updates,
  };
  
  saveAllTasks(tasks, projectRoot);
  return tasks[taskIndex];
}

/**
 * Delete a task
 */
export function deleteTask(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
  
  // Check if it's a subtask
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask && parentTask.subtasks) {
      const subtaskIndex = parentTask.subtasks.findIndex(s => s.id === subtaskId);
      if (subtaskIndex !== -1) {
        parentTask.subtasks.splice(subtaskIndex, 1);
        saveAllTasks(tasks, projectRoot);
        return true;
      }
    }
    return false;
  }
  
  // Regular task
  const taskIndex = tasks.findIndex(t => t.id === Number(taskId));
  if (taskIndex === -1) return false;
  
  // Remove this task from other tasks' dependencies
  const deletedId = tasks[taskIndex].id;
  tasks.forEach(task => {
    if (task.dependencies) {
      task.dependencies = task.dependencies.filter(d => d !== deletedId);
    }
  });
  
  tasks.splice(taskIndex, 1);
  saveAllTasks(tasks, projectRoot);
  return true;
}

/**
 * Set task status
 */
export function setTaskStatus(taskId, status, projectRoot = process.cwd()) {
  return updateTask(taskId, { status }, projectRoot);
}

/**
 * Add subtasks to a task
 */
export function addSubtasks(taskId, subtasks, replace = false, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task) return null;
  
  if (replace) {
    task.subtasks = [];
  }
  
  if (!task.subtasks) {
    task.subtasks = [];
  }
  
  const startId = task.subtasks.length > 0 
    ? Math.max(...task.subtasks.map(s => s.id)) + 1 
    : 1;
  
  subtasks.forEach((subtask, index) => {
    task.subtasks.push({
      id: startId + index,
      ...subtask,
      status: subtask.status || 'pending',
    });
  });
  
  saveAllTasks(tasks, projectRoot);
  return task;
}

/**
 * Clear subtasks from a task
 */
export function clearSubtasks(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task) return null;
  
  task.subtasks = [];
  saveAllTasks(tasks, projectRoot);
  return task;
}

/**
 * Get the next task to work on
 */
export function getNextTask(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  
  // Get pending tasks with all dependencies completed
  const pendingTasks = tasks.filter(task => {
    if (task.status !== 'pending') return false;
    
    // Check if all dependencies are done
    if (task.dependencies && task.dependencies.length > 0) {
      const allDepsDone = task.dependencies.every(depId => {
        const depTask = tasks.find(t => t.id === depId);
        return depTask && depTask.status === 'done';
      });
      return allDepsDone;
    }
    
    return true;
  });
  
  if (pendingTasks.length === 0) return null;
  
  // Sort by priority and ID
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  pendingTasks.sort((a, b) => {
    const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (priorityDiff !== 0) return priorityDiff;
    return a.id - b.id;
  });
  
  return pendingTasks[0];
}

/**
 * Add a dependency to a task
 */
export function addDependency(taskId, dependsOnId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  const depTask = tasks.find(t => t.id === Number(dependsOnId));
  
  if (!task || !depTask) return null;
  
  // Check for circular dependency
  if (wouldCreateCircularDependency(taskId, dependsOnId, tasks)) {
    throw new Error('This would create a circular dependency');
  }
  
  if (!task.dependencies) {
    task.dependencies = [];
  }
  
  if (!task.dependencies.includes(Number(dependsOnId))) {
    task.dependencies.push(Number(dependsOnId));
    saveAllTasks(tasks, projectRoot);
  }
  
  return task;
}

/**
 * Remove a dependency from a task
 */
export function removeDependency(taskId, dependsOnId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task || !task.dependencies) return null;
  
  task.dependencies = task.dependencies.filter(d => d !== Number(dependsOnId));
  saveAllTasks(tasks, projectRoot);
  
  return task;
}

/**
 * Check if adding a dependency would create a circular reference
 */
function wouldCreateCircularDependency(taskId, dependsOnId, tasks) {
  const visited = new Set();
  const stack = [Number(dependsOnId)];
  
  while (stack.length > 0) {
    const currentId = stack.pop();
    
    if (currentId === Number(taskId)) {
      return true;
    }
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const task = tasks.find(t => t.id === currentId);
    if (task && task.dependencies) {
      stack.push(...task.dependencies);
    }
  }
  
  return false;
}

/**
 * Get task statistics
 */
export function getTaskStats(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  
  const stats = {
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    done: 0,
    blocked: 0,
    totalSubtasks: 0,
    completedSubtasks: 0,
  };
  
  tasks.forEach(task => {
    switch (task.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'in-progress':
        stats.inProgress++;
        break;
      case 'done':
        stats.done++;
        break;
      case 'blocked':
        stats.blocked++;
        break;
    }
    
    if (task.subtasks) {
      stats.totalSubtasks += task.subtasks.length;
      stats.completedSubtasks += task.subtasks.filter(s => s.status === 'done').length;
    }
  });
  
  return stats;
}

// ============================================
// TAG MANAGEMENT
// ============================================

/**
 * Get all tags with metadata
 */
export function getAllTags(projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  const currentTag = getCurrentTag(projectRoot);
  
  if (!tasksData.tags) {
    return [{ name: 'master', taskCount: 0, completedCount: 0, isCurrent: currentTag === 'master' }];
  }
  
  return Object.entries(tasksData.tags).map(([name, data]) => {
    const tasks = data.tasks || [];
    const completedCount = tasks.filter(t => t.status === 'done').length;
    
    return {
      name,
      taskCount: tasks.length,
      completedCount,
      percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
      isCurrent: name === currentTag,
      metadata: data.metadata || {},
    };
  });
}

/**
 * Create a new tag
 */
export function createTag(name, options = {}, projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags) {
    tasksData.tags = {};
  }
  
  // Check if tag already exists
  if (tasksData.tags[name]) {
    throw new Error(`Tag '${name}' already exists`);
  }
  
  // Validate tag name
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Tag name can only contain alphanumeric characters, hyphens, and underscores');
  }
  
  let tasks = [];
  
  // Copy tasks from another tag if specified
  if (options.copyFrom) {
    const sourceTag = tasksData.tags[options.copyFrom];
    if (!sourceTag) {
      throw new Error(`Source tag '${options.copyFrom}' not found`);
    }
    tasks = JSON.parse(JSON.stringify(sourceTag.tasks || []));
  } else if (options.copyFromCurrent) {
    const currentTag = getCurrentTag(projectRoot);
    const sourceTag = tasksData.tags[currentTag];
    if (sourceTag) {
      tasks = JSON.parse(JSON.stringify(sourceTag.tasks || []));
    }
  }
  
  tasksData.tags[name] = {
    tasks,
    metadata: {
      createdAt: new Date().toISOString(),
      description: options.description || '',
    }
  };
  
  writeTasks(tasksData, projectRoot);
  return tasksData.tags[name];
}

/**
 * Delete a tag
 */
export function deleteTagData(name, projectRoot = process.cwd()) {
  if (name === 'master') {
    throw new Error("Cannot delete the 'master' tag");
  }
  
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[name]) {
    throw new Error(`Tag '${name}' not found`);
  }
  
  // If deleting current tag, switch to master
  const currentTag = getCurrentTag(projectRoot);
  if (currentTag === name) {
    setCurrentTag('master', projectRoot);
  }
  
  delete tasksData.tags[name];
  writeTasks(tasksData, projectRoot);
  
  return true;
}

/**
 * Switch to a different tag
 */
export function switchTag(name, projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[name]) {
    throw new Error(`Tag '${name}' not found`);
  }
  
  setCurrentTag(name, projectRoot);
  return name;
}

/**
 * Rename a tag
 */
export function renameTag(oldName, newName, projectRoot = process.cwd()) {
  if (oldName === 'master') {
    throw new Error("Cannot rename the 'master' tag");
  }
  
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[oldName]) {
    throw new Error(`Tag '${oldName}' not found`);
  }
  
  if (tasksData.tags[newName]) {
    throw new Error(`Tag '${newName}' already exists`);
  }
  
  // Validate new tag name
  if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
    throw new Error('Tag name can only contain alphanumeric characters, hyphens, and underscores');
  }
  
  // Copy data to new name and delete old
  tasksData.tags[newName] = tasksData.tags[oldName];
  tasksData.tags[newName].metadata.renamedAt = new Date().toISOString();
  delete tasksData.tags[oldName];
  
  // Update current tag if it was renamed
  const currentTag = getCurrentTag(projectRoot);
  if (currentTag === oldName) {
    setCurrentTag(newName, projectRoot);
  }
  
  writeTasks(tasksData, projectRoot);
  return newName;
}

/**
 * Copy a tag
 */
export function copyTag(sourceName, targetName, options = {}, projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[sourceName]) {
    throw new Error(`Source tag '${sourceName}' not found`);
  }
  
  if (tasksData.tags[targetName]) {
    throw new Error(`Target tag '${targetName}' already exists`);
  }
  
  // Validate target tag name
  if (!/^[a-zA-Z0-9_-]+$/.test(targetName)) {
    throw new Error('Tag name can only contain alphanumeric characters, hyphens, and underscores');
  }
  
  // Deep copy the source tag
  tasksData.tags[targetName] = JSON.parse(JSON.stringify(tasksData.tags[sourceName]));
  tasksData.tags[targetName].metadata = {
    ...tasksData.tags[targetName].metadata,
    createdAt: new Date().toISOString(),
    copiedFrom: sourceName,
    description: options.description || tasksData.tags[targetName].metadata?.description || '',
  };
  
  writeTasks(tasksData, projectRoot);
  return tasksData.tags[targetName];
}

// ============================================
// DEPENDENCY VALIDATION
// ============================================

/**
 * Validate all dependencies
 */
export function validateDependencies(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const issues = [];
  const taskIds = new Set(tasks.map(t => t.id));
  
  for (const task of tasks) {
    if (!task.dependencies) continue;
    
    for (const depId of task.dependencies) {
      // Check if dependency exists
      if (!taskIds.has(depId)) {
        issues.push({
          type: 'missing',
          taskId: task.id,
          dependencyId: depId,
          message: `Task ${task.id} depends on non-existent task ${depId}`,
        });
      }
      
      // Check for circular dependency
      if (wouldCreateCircularDep(task.id, depId, tasks)) {
        issues.push({
          type: 'circular',
          taskId: task.id,
          dependencyId: depId,
          message: `Task ${task.id} has circular dependency with task ${depId}`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * Helper to check circular dependencies
 */
function wouldCreateCircularDep(taskId, depId, tasks) {
  const visited = new Set();
  const stack = [depId];
  
  while (stack.length > 0) {
    const currentId = stack.pop();
    
    if (currentId === taskId) {
      return true;
    }
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    
    const task = tasks.find(t => t.id === currentId);
    if (task && task.dependencies) {
      stack.push(...task.dependencies);
    }
  }
  
  return false;
}

/**
 * Fix dependency issues
 */
export function fixDependencies(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const taskIds = new Set(tasks.map(t => t.id));
  let fixedCount = 0;
  
  for (const task of tasks) {
    if (!task.dependencies) continue;
    
    const originalLength = task.dependencies.length;
    
    // Remove non-existent dependencies
    task.dependencies = task.dependencies.filter(depId => taskIds.has(depId));
    
    // Remove circular dependencies
    task.dependencies = task.dependencies.filter(depId => {
      return !wouldCreateCircularDep(task.id, depId, tasks);
    });
    
    if (task.dependencies.length !== originalLength) {
      fixedCount++;
    }
  }
  
  if (fixedCount > 0) {
    saveAllTasks(tasks, projectRoot);
  }
  
  return { fixedCount, tasks };
}

// ============================================
// TASK ORGANIZATION
// ============================================

/**
 * Move a task or subtask to a new position
 */
export function moveTask(fromId, toId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const fromStr = String(fromId);
  const toStr = String(toId);
  
  // Handle subtask moves
  if (fromStr.includes('.')) {
    return moveSubtask(fromStr, toStr, tasks, projectRoot);
  }
  
  // Handle task to subtask move
  if (toStr.includes('.')) {
    return moveTaskToSubtask(fromStr, toStr, tasks, projectRoot);
  }
  
  // Handle task reordering
  const fromIndex = tasks.findIndex(t => t.id === Number(fromStr));
  if (fromIndex === -1) {
    throw new Error(`Task ${fromStr} not found`);
  }
  
  const task = tasks[fromIndex];
  tasks.splice(fromIndex, 1);
  
  // Find insertion point or create placeholder
  let toIndex = tasks.findIndex(t => t.id === Number(toStr));
  if (toIndex === -1) {
    // Insert at position based on ID
    task.id = Number(toStr);
    tasks.push(task);
    tasks.sort((a, b) => a.id - b.id);
  } else {
    task.id = Number(toStr);
    tasks.splice(toIndex, 0, task);
  }
  
  // Update dependency references
  updateDependencyReferences(tasks, Number(fromStr), Number(toStr));
  
  saveAllTasks(tasks, projectRoot);
  return task;
}

/**
 * Move a subtask
 */
function moveSubtask(fromStr, toStr, tasks, projectRoot) {
  const [fromParentId, fromSubtaskId] = fromStr.split('.').map(Number);
  const fromParent = tasks.find(t => t.id === fromParentId);
  
  if (!fromParent || !fromParent.subtasks) {
    throw new Error(`Subtask ${fromStr} not found`);
  }
  
  const subtaskIndex = fromParent.subtasks.findIndex(s => s.id === fromSubtaskId);
  if (subtaskIndex === -1) {
    throw new Error(`Subtask ${fromStr} not found`);
  }
  
  const subtask = fromParent.subtasks.splice(subtaskIndex, 1)[0];
  
  if (toStr.includes('.')) {
    // Move to another subtask position
    const [toParentId, toSubtaskId] = toStr.split('.').map(Number);
    const toParent = tasks.find(t => t.id === toParentId);
    
    if (!toParent) {
      throw new Error(`Parent task ${toParentId} not found`);
    }
    
    if (!toParent.subtasks) {
      toParent.subtasks = [];
    }
    
    subtask.id = toSubtaskId;
    toParent.subtasks.push(subtask);
    toParent.subtasks.sort((a, b) => a.id - b.id);
  } else {
    // Convert subtask to task
    const newTask = {
      id: Number(toStr),
      title: subtask.title,
      description: subtask.description || '',
      status: subtask.status,
      priority: 'medium',
      dependencies: [],
      details: subtask.details || '',
      testStrategy: '',
      subtasks: [],
    };
    tasks.push(newTask);
    tasks.sort((a, b) => a.id - b.id);
  }
  
  saveAllTasks(tasks, projectRoot);
  return subtask;
}

/**
 * Move a task to become a subtask
 */
function moveTaskToSubtask(fromStr, toStr, tasks, projectRoot) {
  const [toParentId, toSubtaskId] = toStr.split('.').map(Number);
  const taskIndex = tasks.findIndex(t => t.id === Number(fromStr));
  
  if (taskIndex === -1) {
    throw new Error(`Task ${fromStr} not found`);
  }
  
  const toParent = tasks.find(t => t.id === toParentId);
  if (!toParent) {
    throw new Error(`Parent task ${toParentId} not found`);
  }
  
  const task = tasks.splice(taskIndex, 1)[0];
  
  if (!toParent.subtasks) {
    toParent.subtasks = [];
  }
  
  const subtask = {
    id: toSubtaskId,
    title: task.title,
    description: task.description,
    status: task.status,
    details: task.details,
  };
  
  toParent.subtasks.push(subtask);
  toParent.subtasks.sort((a, b) => a.id - b.id);
  
  // Update dependencies
  updateDependencyReferences(tasks, Number(fromStr), null);
  
  saveAllTasks(tasks, projectRoot);
  return subtask;
}

/**
 * Update dependency references when a task is moved
 */
function updateDependencyReferences(tasks, oldId, newId) {
  for (const task of tasks) {
    if (!task.dependencies) continue;
    
    if (newId === null) {
      // Remove references to deleted task
      task.dependencies = task.dependencies.filter(d => d !== oldId);
    } else {
      // Update references
      task.dependencies = task.dependencies.map(d => d === oldId ? newId : d);
    }
  }
}

/**
 * Add a single subtask manually
 */
export function addSingleSubtask(parentId, subtaskData, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const parent = tasks.find(t => t.id === Number(parentId));
  
  if (!parent) {
    throw new Error(`Parent task ${parentId} not found`);
  }
  
  if (!parent.subtasks) {
    parent.subtasks = [];
  }
  
  // Get next subtask ID
  const nextId = parent.subtasks.length > 0 
    ? Math.max(...parent.subtasks.map(s => s.id)) + 1 
    : 1;
  
  const subtask = {
    id: nextId,
    title: subtaskData.title,
    description: subtaskData.description || '',
    status: subtaskData.status || 'pending',
    details: subtaskData.details || '',
    dependencies: subtaskData.dependencies || [],
  };
  
  parent.subtasks.push(subtask);
  saveAllTasks(tasks, projectRoot);
  
  return { parent, subtask };
}

// ============================================
// FILE GENERATION
// ============================================

/**
 * Generate individual task markdown files
 */
export function generateTaskFiles(projectRoot = process.cwd(), outputDir = null) {
  const tasks = getAllTasks(projectRoot);
  const tasksDir = outputDir || path.join(getProjectConfigDir(projectRoot), 'tasks');
  
  // Ensure directory exists
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }
  
  const generatedFiles = [];
  
  for (const task of tasks) {
    const fileName = `task-${task.id}.md`;
    const filePath = path.join(tasksDir, fileName);
    
    const content = formatTaskAsMarkdown(task);
    fs.writeFileSync(filePath, content, 'utf-8');
    generatedFiles.push(filePath);
  }
  
  return generatedFiles;
}

/**
 * Format a task as markdown
 */
function formatTaskAsMarkdown(task) {
  let content = `# Task ID: ${task.id}
# Title: ${task.title}
# Status: ${task.status || 'pending'}
# Dependencies: ${task.dependencies?.join(', ') || 'None'}
# Priority: ${task.priority || 'medium'}
# Description: ${task.description || ''}

# Details:
${task.details || 'No details provided.'}

# Test Strategy:
${task.testStrategy || 'No test strategy defined.'}
`;

  if (task.subtasks && task.subtasks.length > 0) {
    content += '\n# Subtasks:\n';
    for (const subtask of task.subtasks) {
      const statusIcon = subtask.status === 'done' ? '✅' : subtask.status === 'in-progress' ? '🔄' : '⏳';
      content += `\n## ${subtask.id}. ${subtask.title} ${statusIcon}
- Status: ${subtask.status || 'pending'}
- Description: ${subtask.description || ''}
${subtask.details ? `- Details: ${subtask.details}` : ''}
`;
    }
  }

  return content;
}

export default {
  getCurrentTag,
  setCurrentTag,
  getTasksForTag,
  getAllTasks,
  saveTasksForTag,
  saveAllTasks,
  findTaskById,
  getNextTaskId,
  addTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  addSubtasks,
  clearSubtasks,
  getNextTask,
  addDependency,
  removeDependency,
  getTaskStats,
  // Tag management
  getAllTags,
  createTag,
  deleteTagData,
  switchTag,
  renameTag,
  copyTag,
  // Dependency validation
  validateDependencies,
  fixDependencies,
  // Task organization
  moveTask,
  addSingleSubtask,
  // File generation
  generateTaskFiles,
};
