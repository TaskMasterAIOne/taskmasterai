/**
 * Task Exists Module
 * Check if a task exists in the task list
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "steps" instead of "subtasks"
 */

/**
 * Check if a task with the given ID exists
 * @param {Array} tasks - Array of tasks to search
 * @param {string|number} taskId - ID of task or step to check
 * @returns {boolean} Whether the task exists
 */
function taskExists(tasks, taskId) {
  if (!tasks || !Array.isArray(tasks)) {
    return false;
  }
  
  // Handle step IDs (e.g., "1.2")
  if (typeof taskId === 'string' && taskId.includes('.')) {
    const parts = taskId.split('.');
    
    // Validate format (parentId.stepId)
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      // Invalid format - treat as regular task ID
      const id = parseInt(taskId, 10);
      return tasks.some((t) => t.id === id);
    }
    
    const [parentIdStr, stepIdStr] = parts;
    const parentId = parseInt(parentIdStr, 10);
    const stepId = parseInt(stepIdStr, 10);
    
    // Find the parent task
    const parentTask = tasks.find((t) => t.id === parentId);
    if (!parentTask) {
      return false;
    }
    
    // Check if step exists (support both "steps" and "subtasks")
    const steps = parentTask.steps || parentTask.subtasks || [];
    return steps.some((st) => st.id === stepId);
  }
  
  // Handle regular task IDs
  const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
  return tasks.some((t) => t.id === id);
}

/**
 * Find a task by ID (including steps)
 * @param {Array} tasks - Array of tasks
 * @param {string|number} taskId - Task or step ID
 * @returns {Object|null} Found task or null
 */
function findTask(tasks, taskId) {
  if (!tasks || !Array.isArray(tasks)) {
    return null;
  }
  
  const idStr = String(taskId);
  
  // Handle step IDs (e.g., "1.2")
  if (idStr.includes('.')) {
    const [parentIdStr, stepIdStr] = idStr.split('.');
    const parentId = parseInt(parentIdStr, 10);
    const stepId = parseInt(stepIdStr, 10);
    
    const parentTask = tasks.find((t) => t.id === parentId);
    if (!parentTask) {
      return null;
    }
    
    const steps = parentTask.steps || parentTask.subtasks || [];
    return steps.find((st) => st.id === stepId) || null;
  }
  
  // Regular task ID
  const id = parseInt(idStr, 10);
  return tasks.find((t) => t.id === id) || null;
}

/**
 * Get parent task for a step
 * @param {Array} tasks - Array of tasks
 * @param {string} stepId - Step ID (e.g., "1.2")
 * @returns {Object|null} Parent task or null
 */
function getParentTask(tasks, stepId) {
  if (!tasks || !stepId?.includes('.')) {
    return null;
  }
  
  const [parentIdStr] = stepId.split('.');
  const parentId = parseInt(parentIdStr, 10);
  
  return tasks.find((t) => t.id === parentId) || null;
}

export { taskExists, findTask, getParentTask };
export default taskExists;
