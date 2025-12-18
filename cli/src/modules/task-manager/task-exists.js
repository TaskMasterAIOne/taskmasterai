
function taskExists(tasks, taskId) {
  if (!tasks || !Array.isArray(tasks)) {
    return false;
  }
  
  // Handle step IDs (e.g., "1.2")
  if (typeof taskId === 'string' && taskId.includes('.')) {
    const parts = taskId.split('.');

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      // Invalid format - treat as regular task ID
      const id = parseInt(taskId, 10);
      return tasks.some((t) => t.id === id);
    }
    
    const [parentIdStr, stepIdStr] = parts;
    const parentId = parseInt(parentIdStr, 10);
    const stepId = parseInt(stepIdStr, 10);
    const parentTask = tasks.find((t) => t.id === parentId);
    if (!parentTask) {
      return false;
    }
    const steps = parentTask.steps || parentTask.subtasks || [];
    return steps.some((st) => st.id === stepId);
  }
  
  // Handle regular task IDs
  const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
  return tasks.some((t) => t.id === id);
}

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
