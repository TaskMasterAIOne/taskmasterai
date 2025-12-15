
import { addAssessmentToTask } from '../utils.js';

function findNextTask(tasks, assessmentReport = null) {
  // ---------- helpers ----------------------------------------------------
  const priorityValues = { high: 3, medium: 2, low: 1 };

  const toFullStepId = (parentId, maybeDotId) => {
    // "12.3" -> "12.3"
    //       4 -> "12.4" (numeric / short form)
    if (typeof maybeDotId === 'string' && maybeDotId.includes('.')) {
      return maybeDotId;
    }
    return `${parentId}.${maybeDotId}`;
  };

  // ---------- build completed-ID set (tasks *and* steps) --------------
  const completedIds = new Set();
  tasks.forEach((t) => {
    if (t.status === 'done' || t.status === 'completed') {
      completedIds.add(String(t.id));
    }
    // Support both "steps" (new) and "subtasks" (legacy) field names
    const steps = t.steps || t.subtasks;
    if (Array.isArray(steps)) {
      steps.forEach((st) => {
        if (st.status === 'done' || st.status === 'completed') {
          completedIds.add(`${t.id}.${st.id}`);
        }
      });
    }
  });

  // ---------- 1) look for eligible steps ------------------------------
  const candidateSteps = [];

  tasks
    .filter((t) => {
      // Support both "steps" (new) and "subtasks" (legacy)
      const steps = t.steps || t.subtasks;
      return t.status === 'in-progress' && Array.isArray(steps);
    })
    .forEach((parent) => {
      // Support both field names
      const steps = parent.steps || parent.subtasks;
      steps.forEach((st) => {
        const stStatus = (st.status || 'pending').toLowerCase();
        if (stStatus !== 'pending' && stStatus !== 'in-progress') return;

        // Support both "dependencies" and "links" field names
        const deps = st.dependencies || st.links || [];
        const fullDeps = deps.map((d) => toFullStepId(parent.id, d));

        const depsSatisfied =
          fullDeps.length === 0 ||
          fullDeps.every((depId) => completedIds.has(String(depId)));

        if (depsSatisfied) {
          candidateSteps.push({
            id: `${parent.id}.${st.id}`,
            title: st.title || `Step ${st.id}`,
            description: st.description || '',
            status: st.status || 'pending',
            priority: st.priority || parent.priority || 'medium',
            dependencies: fullDeps,
            parentId: parent.id,
            details: st.details || '',
            isStep: true,
          });
        }
      });
    });

  if (candidateSteps.length > 0) {
    // sort by priority → dep-count → parent-id → step-id
    candidateSteps.sort((a, b) => {
      const pa = priorityValues[a.priority] ?? 2;
      const pb = priorityValues[b.priority] ?? 2;
      if (pb !== pa) return pb - pa;

      if (a.dependencies.length !== b.dependencies.length)
        return a.dependencies.length - b.dependencies.length;

      // compare parent then step-id numerically
      const [aPar, aStep] = a.id.split('.').map(Number);
      const [bPar, bStep] = b.id.split('.').map(Number);
      if (aPar !== bPar) return aPar - bPar;
      return aStep - bStep;
    });

    const nextTask = candidateSteps[0];
    if (nextTask && assessmentReport) {
      addAssessmentToTask(nextTask, assessmentReport);
    }

    return nextTask;
  }

  const eligibleTasks = tasks.filter((task) => {
    const status = (task.status || 'pending').toLowerCase();
    if (status !== 'pending' && status !== 'in-progress') return false;
    // Support both "dependencies" and "links" field names
    const deps = task.dependencies || task.links || [];
    return deps.every((depId) => completedIds.has(String(depId)));
  });

  if (eligibleTasks.length === 0) return null;

  const nextTask = eligibleTasks.sort((a, b) => {
    const pa = priorityValues[a.priority || 'medium'] ?? 2;
    const pb = priorityValues[b.priority || 'medium'] ?? 2;
    if (pb !== pa) return pb - pa;

    // Support both "dependencies" and "links"
    const da = (a.dependencies || a.links || []).length;
    const db = (b.dependencies || b.links || []).length;
    if (da !== db) return da - db;

    return a.id - b.id;
  })[0];
  if (nextTask && assessmentReport) {
    addAssessmentToTask(nextTask, assessmentReport);
  }

  return nextTask;
}

export default findNextTask;
