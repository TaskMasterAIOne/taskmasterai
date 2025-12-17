
import fs from 'fs';
import path from 'path';
import { readTasks, writeTasks, findProjectRoot, readState, writeState, getProjectConfigDir, readProjectConfig } from './config.js';
import { syncTasksToCloud } from './license.js';

export function getCurrentTag(projectRoot = process.cwd()) {
  const state = readState(projectRoot);
  return state.currentTag || 'main';
}

export function setCurrentTag(tag, projectRoot = process.cwd()) {
  const state = readState(projectRoot);
  state.currentTag = tag;
  state.lastSwitched = new Date().toISOString();
  writeState(state, projectRoot);
  return tag;
}

export function getTasksForTag(tag = 'main', projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[tag]) {
    return [];
  }
  
  return tasksData.tags[tag].tasks || [];
}

export function getAllTasks(projectRoot = process.cwd()) {
  const tag = getCurrentTag(projectRoot);
  return getTasksForTag(tag, projectRoot);
}

export function saveTasksForTag(tasks, tag = 'main', projectRoot = process.cwd()) {
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
  try {
    const config = readProjectConfig(projectRoot);
    const projectId = config.projectName || path.basename(projectRoot);
    const verbose = process.env.TASKMASTER_VERBOSE === 'true';
    
    if (verbose) {
      console.log(`[SYNC] Syncing ${tasks.length} tasks to cloud...`);
      console.log(`[SYNC] Project: ${projectId}, Tag: ${tag}`);
    }
    
    syncTasksToCloud(tasks, {
      projectId,
      tag,
      metadata: tasksData.tags[tag].metadata,
    }).then((result) => {
      if (verbose) {
        if (result.success) {
          console.log(`[SYNC] ✓ Successfully synced ${tasks.length} tasks`);
        } else {
          console.log(`[SYNC] ✗ Sync failed: ${result.error}`);
        }
      }
    }).catch((err) => {
      if (verbose) {
        console.log(`[SYNC] ✗ Sync error: ${err.message}`);
      }
    });
  } catch (e) {
    // Ignore sync errors - CLI should work offline
    if (process.env.TASKMASTER_VERBOSE === 'true') {
      console.log(`[SYNC] ✗ Setup error: ${e.message}`);
    }
  }
}

export function saveAllTasks(tasks, projectRoot = process.cwd()) {
  const tag = getCurrentTag(projectRoot);
  saveTasksForTag(tasks, tag, projectRoot);
}

export function findTaskById(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask) {
      // Support both 'steps' (per terminology) and 'subtasks' (legacy)
      const steps = parentTask.steps || parentTask.subtasks || [];
      const step = steps.find(s => s.id === subtaskId);
      if (step) {
        return { ...step, parentId, isSubtask: true, isStep: true };
      }
    }
    return null;
  }
  
  // Regular task ID
  return tasks.find(t => t.id === Number(taskId)) || null;
}

export function getNextTaskId(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  if (tasks.length === 0) return 1;
  
  const maxId = Math.max(...tasks.map(t => t.id));
  return maxId + 1;
}

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

export function updateTask(taskId, updates, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
  if (idStr.includes('.')) {
    const [parentId, subtaskId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    if (parentTask) {
      // Support both 'steps' (per terminology) and 'subtasks' (legacy)
      const stepsKey = parentTask.steps ? 'steps' : 'subtasks';
      const steps = parentTask[stepsKey] || [];
      const stepIndex = steps.findIndex(s => s.id === subtaskId);
      if (stepIndex !== -1) {
        steps[stepIndex] = {
          ...steps[stepIndex],
          ...updates,
        };
        parentTask[stepsKey] = steps;
        saveAllTasks(tasks, projectRoot);
        return steps[stepIndex];
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

export function deleteTask(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const idStr = String(taskId);
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

export function setTaskStatus(taskId, status, projectRoot = process.cwd()) {
  return updateTask(taskId, { status }, projectRoot);
}

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

export function clearSubtasks(taskId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task) return null;
  
  task.subtasks = [];
  saveAllTasks(tasks, projectRoot);
  return task;
}

export function getNextTask(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  
  const priorityValues = { high: 3, medium: 2, low: 1 };
  
  // Helper to convert subtask dependency to full dotted form
  const toFullSubId = (parentId, maybeDotId) => {
    if (typeof maybeDotId === 'string' && maybeDotId.includes('.')) {
      return maybeDotId;
    }
    return `${parentId}.${maybeDotId}`;
  };
  
  // Build set of completed IDs (both tasks and subtasks)
  const completedIds = new Set();
  tasks.forEach(t => {
    if (t.status === 'done' || t.status === 'completed') {
      completedIds.add(String(t.id));
    }
    if (Array.isArray(t.subtasks)) {
      t.subtasks.forEach(st => {
        if (st.status === 'done' || st.status === 'completed') {
          completedIds.add(`${t.id}.${st.id}`);
        }
      });
    }
  });
  
  // 1) Look for eligible subtasks of in-progress parent tasks
  const candidateSubtasks = [];
  
  tasks
    .filter(t => t.status === 'in-progress' && Array.isArray(t.subtasks))
    .forEach(parent => {
      parent.subtasks.forEach(st => {
        const stStatus = (st.status || 'pending').toLowerCase();
        if (stStatus !== 'pending' && stStatus !== 'in-progress') return;
        
        const fullDeps = st.dependencies?.map(d => toFullSubId(parent.id, d)) ?? [];
        const depsSatisfied = fullDeps.length === 0 || 
          fullDeps.every(depId => completedIds.has(String(depId)));
        
        if (depsSatisfied) {
          candidateSubtasks.push({
            id: `${parent.id}.${st.id}`,
            title: st.title || `Subtask ${st.id}`,
            description: st.description || '',
            status: st.status || 'pending',
            priority: st.priority || parent.priority || 'medium',
            dependencies: fullDeps,
            parentId: parent.id,
            details: st.details || '',
            isSubtask: true,
          });
        }
      });
    });
  
  if (candidateSubtasks.length > 0) {
    // Sort by priority (high first) → dep-count → parent-id → sub-id
    candidateSubtasks.sort((a, b) => {
      const pa = priorityValues[a.priority] ?? 2;
      const pb = priorityValues[b.priority] ?? 2;
      if (pb !== pa) return pb - pa;
      
      if (a.dependencies.length !== b.dependencies.length) {
        return a.dependencies.length - b.dependencies.length;
      }
      
      // Compare parent then sub-id numerically
      const [aPar, aSub] = a.id.split('.').map(Number);
      const [bPar, bSub] = b.id.split('.').map(Number);
      if (aPar !== bPar) return aPar - bPar;
      return aSub - bSub;
    });
    
    return candidateSubtasks[0];
  }
  
  // 2) Fall back to top-level tasks (pending or in-progress with deps satisfied)
  const eligibleTasks = tasks.filter(task => {
    const status = (task.status || 'pending').toLowerCase();
    if (status !== 'pending' && status !== 'in-progress') return false;
    
    const deps = task.dependencies ?? [];
    return deps.every(depId => completedIds.has(String(depId)));
  });
  
  if (eligibleTasks.length === 0) return null;
  
  // Sort by priority (high first) → dep-count → ID
  eligibleTasks.sort((a, b) => {
    const pa = priorityValues[a.priority || 'medium'] ?? 2;
    const pb = priorityValues[b.priority || 'medium'] ?? 2;
    if (pb !== pa) return pb - pa;
    
    const da = (a.dependencies ?? []).length;
    const db = (b.dependencies ?? []).length;
    if (da !== db) return da - db;
    
    return a.id - b.id;
  });
  
  return eligibleTasks[0];
}

export function addDependency(taskId, dependsOnId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  const depTask = tasks.find(t => t.id === Number(dependsOnId));
  
  if (!task || !depTask) return null;
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

export function removeDependency(taskId, dependsOnId, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task || !task.dependencies) return null;
  
  task.dependencies = task.dependencies.filter(d => d !== Number(dependsOnId));
  saveAllTasks(tasks, projectRoot);
  
  return task;
}

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
// ============================================

export function getAllTags(projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  const currentTag = getCurrentTag(projectRoot);
  
  if (!tasksData.tags) {
    return [{ name: 'main', taskCount: 0, completedCount: 0, isCurrent: currentTag === 'main' }];
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

export function createTag(name, options = {}, projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags) {
    tasksData.tags = {};
  }
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

export function deleteTagData(name, projectRoot = process.cwd()) {
  if (name === 'main') {
    throw new Error("Cannot delete the 'main' context");
  }
  
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[name]) {
    throw new Error(`Tag '${name}' not found`);
  }
  const currentTag = getCurrentTag(projectRoot);
  if (currentTag === name) {
    setCurrentTag('main', projectRoot);
  }
  
  delete tasksData.tags[name];
  writeTasks(tasksData, projectRoot);
  
  return true;
}

export function switchTag(name, projectRoot = process.cwd()) {
  const tasksData = readTasks(projectRoot);
  
  if (!tasksData.tags || !tasksData.tags[name]) {
    throw new Error(`Tag '${name}' not found`);
  }
  
  setCurrentTag(name, projectRoot);
  return name;
}

export function renameTag(oldName, newName, projectRoot = process.cwd()) {
  if (oldName === 'main') {
    throw new Error("Cannot rename the 'main' context");
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
  const currentTag = getCurrentTag(projectRoot);
  if (currentTag === oldName) {
    setCurrentTag(newName, projectRoot);
  }
  
  writeTasks(tasksData, projectRoot);
  return newName;
}

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
// ============================================

export function validateDependencies(projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const issues = [];
  const taskIds = new Set(tasks.map(t => t.id));
  
  for (const task of tasks) {
    if (!task.dependencies) continue;
    
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        issues.push({
          type: 'missing',
          taskId: task.id,
          dependencyId: depId,
          message: `Task ${task.id} depends on non-existent task ${depId}`,
        });
      }
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
// ============================================

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
    task.id = Number(toStr);
    tasks.push(task);
    tasks.sort((a, b) => a.id - b.id);
  } else {
    task.id = Number(toStr);
    tasks.splice(toIndex, 0, task);
  }
  updateDependencyReferences(tasks, Number(fromStr), Number(toStr));
  
  saveAllTasks(tasks, projectRoot);
  return task;
}

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
  updateDependencyReferences(tasks, Number(fromStr), null);
  
  saveAllTasks(tasks, projectRoot);
  return subtask;
}

function updateDependencyReferences(tasks, oldId, newId) {
  for (const task of tasks) {
    if (!task.dependencies) continue;
    
    if (newId === null) {
      // Remove references to deleted task
      task.dependencies = task.dependencies.filter(d => d !== oldId);
    } else {
      task.dependencies = task.dependencies.map(d => d === oldId ? newId : d);
    }
  }
}

export function addSingleSubtask(parentId, subtaskData, projectRoot = process.cwd()) {
  const tasks = getAllTasks(projectRoot);
  const parent = tasks.find(t => t.id === Number(parentId));
  
  if (!parent) {
    throw new Error(`Parent task ${parentId} not found`);
  }
  
  if (!parent.subtasks) {
    parent.subtasks = [];
  }
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
// ============================================

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
