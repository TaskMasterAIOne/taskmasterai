/**
 * Task Manager for TaskMaster AI
 * Handles task CRUD operations and state management
 */

import { readTasks, writeTasks, findProjectRoot } from './config.js';

/**
 * Get the current tag from state or default to 'master'
 */
export function getCurrentTag(projectRoot = process.cwd()) {
  // For now, always use 'master' tag
  return 'master';
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

export default {
  getCurrentTag,
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
};
