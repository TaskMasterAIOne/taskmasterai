/**
 * Is Linked Module
 * Check if a task is linked to another (directly or indirectly)
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "links" instead of "dependencies"
 * - "steps" instead of "subtasks"
 */

/**
 * Check if a task is linked to another task (directly or indirectly)
 * Used to prevent circular links
 * @param {Array} allTasks - Array of all tasks
 * @param {Object} task - The task to check
 * @param {number} targetTaskId - The task ID to check link against
 * @returns {boolean} Whether the task links to the target task
 */
function isTaskLinkedTo(allTasks, task, targetTaskId) {
  // If the task is a step, check if its parent is the target
  if (task.parentTaskId === targetTaskId) {
    return true;
  }
  
  // Check direct links (support both "links" and "dependencies")
  const taskLinks = task.links || task.dependencies || [];
  if (taskLinks.includes(targetTaskId)) {
    return true;
  }
  
  // Check links of links (recursive)
  for (const linkId of taskLinks) {
    const linkedTask = allTasks.find((t) => t.id === linkId);
    if (linkedTask && isTaskLinkedTo(allTasks, linkedTask, targetTaskId)) {
      return true;
    }
  }
  
  // Check steps for links (support both "steps" and "subtasks")
  const steps = task.steps || task.subtasks || [];
  for (const step of steps) {
    if (isTaskLinkedTo(allTasks, step, targetTaskId)) {
      return true;
    }
  }
  
  return false;
}

// Alias for backward compatibility
const isTaskDependentOn = isTaskLinkedTo;

export { isTaskLinkedTo, isTaskDependentOn };
export default isTaskLinkedTo;
