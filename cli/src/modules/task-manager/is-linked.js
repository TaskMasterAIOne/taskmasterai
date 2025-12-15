
function isTaskLinkedTo(allTasks, task, targetTaskId) {
  if (task.parentTaskId === targetTaskId) {
    return true;
  }
  const taskLinks = task.links || task.dependencies || [];
  if (taskLinks.includes(targetTaskId)) {
    return true;
  }
  for (const linkId of taskLinks) {
    const linkedTask = allTasks.find((t) => t.id === linkId);
    if (linkedTask && isTaskLinkedTo(allTasks, linkedTask, targetTaskId)) {
      return true;
    }
  }
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
