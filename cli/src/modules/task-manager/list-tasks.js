
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  addAssessmentToTask,
  log,
  readAssessmentReport,
  readJSON,
  truncate
} from '../utils.js';
import findNextTask from './find-next-task.js';
import {
  createProgressBar,
  formatDependenciesWithStatus,
  getAssessmentWithColor,
  getStatusWithColor
} from '../ui.js';

async function listTasks(
  tasksPath,
  statusFilter,
  reportPath = null,
  withSteps = false,
  outputFormat = 'text',
  context = {}
) {
  const { projectRoot, context: contextName } = context;
  
  try {
    const data = readJSON(tasksPath, projectRoot, contextName);
    
    if (!data || !data.tasks) {
      throw new Error(`No valid tasks found in ${tasksPath}`);
    }
    const assessmentReport = readAssessmentReport(reportPath);
    if (assessmentReport) {
      data.tasks.forEach((task) => addAssessmentToTask(task, assessmentReport));
    }

    // Filter tasks by status if specified
    let filteredTasks;
    if (statusFilter && statusFilter.toLowerCase() !== 'all') {
      const allowedStatuses = statusFilter
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      filteredTasks = data.tasks.filter(
        (task) => task.status && allowedStatuses.includes(task.status.toLowerCase())
      );
    } else {
      filteredTasks = data.tasks;
    }
    const totalTasks = data.tasks.length;
    const completedTasks = data.tasks.filter(
      (task) => task.status === 'done' || task.status === 'completed'
    ).length;
    const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Status counts
    const doneCount = completedTasks;
    const inProgressCount = data.tasks.filter((t) => t.status === 'in-progress').length;
    const pendingCount = data.tasks.filter((t) => t.status === 'pending').length;
    const blockedCount = data.tasks.filter((t) => t.status === 'blocked').length;
    const deferredCount = data.tasks.filter((t) => t.status === 'deferred').length;
    const cancelledCount = data.tasks.filter((t) => t.status === 'cancelled').length;
    const reviewCount = data.tasks.filter((t) => t.status === 'review').length;

    // Count steps (subtasks) - support both field names
    let totalSteps = 0;
    let completedSteps = 0;
    let inProgressSteps = 0;
    let pendingSteps = 0;
    let blockedSteps = 0;
    let deferredSteps = 0;
    let cancelledSteps = 0;

    data.tasks.forEach((task) => {
      const steps = task.steps || task.subtasks || [];
      if (steps.length > 0) {
        totalSteps += steps.length;
        completedSteps += steps.filter((st) => st.status === 'done' || st.status === 'completed').length;
        inProgressSteps += steps.filter((st) => st.status === 'in-progress').length;
        pendingSteps += steps.filter((st) => st.status === 'pending').length;
        blockedSteps += steps.filter((st) => st.status === 'blocked').length;
        deferredSteps += steps.filter((st) => st.status === 'deferred').length;
        cancelledSteps += steps.filter((st) => st.status === 'cancelled').length;
      }
    });

    const stepCompletionPercentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Link (dependency) statistics
    const completedTaskIds = new Set(
      data.tasks
        .filter((t) => t.status === 'done' || t.status === 'completed')
        .map((t) => t.id)
    );

    const tasksWithNoLinks = data.tasks.filter(
      (t) => t.status !== 'done' && t.status !== 'completed' &&
        (!(t.dependencies || t.links) || (t.dependencies || t.links).length === 0)
    ).length;

    const tasksWithAllLinksSatisfied = data.tasks.filter((t) => {
      if (t.status === 'done' || t.status === 'completed') return false;
      const deps = t.dependencies || t.links || [];
      return deps.length > 0 && deps.every((depId) => completedTaskIds.has(depId));
    }).length;

    const tasksWithUnsatisfiedLinks = data.tasks.filter((t) => {
      if (t.status === 'done' || t.status === 'completed') return false;
      const deps = t.dependencies || t.links || [];
      return deps.length > 0 && !deps.every((depId) => completedTaskIds.has(depId));
    }).length;

    const tasksReadyToWork = tasksWithNoLinks + tasksWithAllLinksSatisfied;

    // Find most linked-to task
    const linkCount = {};
    data.tasks.forEach((task) => {
      const deps = task.dependencies || task.links || [];
      deps.forEach((depId) => {
        linkCount[depId] = (linkCount[depId] || 0) + 1;
      });
    });

    let mostLinkedTaskId = null;
    let maxDependents = 0;
    for (const [taskId, count] of Object.entries(linkCount)) {
      if (count > maxDependents) {
        maxDependents = count;
        mostLinkedTaskId = parseInt(taskId);
      }
    }

    const mostLinkedTask = mostLinkedTaskId !== null
      ? data.tasks.find((t) => t.id === mostLinkedTaskId)
      : null;

    // Average links per task
    const totalLinks = data.tasks.reduce(
      (sum, task) => sum + ((task.dependencies || task.links || []).length),
      0
    );
    const avgLinksPerTask = totalLinks / data.tasks.length;

    // Find next task
    const nextItem = findNextTask(data.tasks, assessmentReport);
    if (outputFormat === 'json') {
      const tasksWithoutDetails = filteredTasks.map((task) => {
        const { details, ...taskRest } = task;
        const steps = taskRest.steps || taskRest.subtasks;
        if (steps && Array.isArray(steps)) {
          taskRest.steps = steps.map((step) => {
            const { details: stepDetails, ...stepRest } = step;
            return stepRest;
          });
          delete taskRest.subtasks;
        }
        return taskRest;
      });

      return {
        tasks: tasksWithoutDetails,
        filter: statusFilter || 'all',
        stats: {
          total: totalTasks,
          completed: doneCount,
          inProgress: inProgressCount,
          pending: pendingCount,
          blocked: blockedCount,
          deferred: deferredCount,
          cancelled: cancelledCount,
          review: reviewCount,
          completionPercentage,
          steps: {
            total: totalSteps,
            completed: completedSteps,
            inProgress: inProgressSteps,
            pending: pendingSteps,
            blocked: blockedSteps,
            deferred: deferredSteps,
            cancelled: cancelledSteps,
            completionPercentage: stepCompletionPercentage
          }
        }
      };
    }

    // Text output with dashboard
    const taskStatusBreakdown = {
      'in-progress': totalTasks > 0 ? (inProgressCount / totalTasks) * 100 : 0,
      pending: totalTasks > 0 ? (pendingCount / totalTasks) * 100 : 0,
      blocked: totalTasks > 0 ? (blockedCount / totalTasks) * 100 : 0,
      deferred: totalTasks > 0 ? (deferredCount / totalTasks) * 100 : 0,
      cancelled: totalTasks > 0 ? (cancelledCount / totalTasks) * 100 : 0,
      review: totalTasks > 0 ? (reviewCount / totalTasks) * 100 : 0
    };

    const stepStatusBreakdown = {
      'in-progress': totalSteps > 0 ? (inProgressSteps / totalSteps) * 100 : 0,
      pending: totalSteps > 0 ? (pendingSteps / totalSteps) * 100 : 0,
      blocked: totalSteps > 0 ? (blockedSteps / totalSteps) * 100 : 0,
      deferred: totalSteps > 0 ? (deferredSteps / totalSteps) * 100 : 0,
      cancelled: totalSteps > 0 ? (cancelledSteps / totalSteps) * 100 : 0
    };
    const taskProgressBar = createProgressBar(completionPercentage, 30, taskStatusBreakdown);
    const stepProgressBar = createProgressBar(stepCompletionPercentage, 30, stepStatusBreakdown);
    let terminalWidth = process.stdout.columns || 80;
    terminalWidth = Math.max(terminalWidth, 80);
    const projectDashboardContent =
      chalk.white.bold('Project Dashboard') +
      '\n' +
      `Tasks Progress: ${chalk.greenBright(taskProgressBar)} ${completionPercentage.toFixed(0)}%\n` +
      `Done: ${chalk.green(doneCount)}  In Progress: ${chalk.blue(inProgressCount)}  Pending: ${chalk.yellow(pendingCount)}  Blocked: ${chalk.red(blockedCount)}  Deferred: ${chalk.gray(deferredCount)}  Cancelled: ${chalk.gray(cancelledCount)}\n\n` +
      `Steps Progress: ${chalk.cyan(stepProgressBar)} ${stepCompletionPercentage.toFixed(0)}%\n` +
      `Completed: ${chalk.green(completedSteps)}/${totalSteps}  In Progress: ${chalk.blue(inProgressSteps)}  Pending: ${chalk.yellow(pendingSteps)}  Blocked: ${chalk.red(blockedSteps)}\n\n` +
      chalk.cyan.bold('Priority Breakdown:') +
      '\n' +
      `${chalk.red('•')} ${chalk.white('High priority:')} ${data.tasks.filter((t) => t.priority === 'high').length}\n` +
      `${chalk.yellow('•')} ${chalk.white('Medium priority:')} ${data.tasks.filter((t) => t.priority === 'medium').length}\n` +
      `${chalk.green('•')} ${chalk.white('Low priority:')} ${data.tasks.filter((t) => t.priority === 'low').length}`;

    const linkDashboardContent =
      chalk.white.bold('Links & Next Task') +
      '\n' +
      chalk.cyan.bold('Link Metrics:') +
      '\n' +
      `${chalk.green('•')} ${chalk.white('Tasks with no links:')} ${tasksWithNoLinks}\n` +
      `${chalk.green('•')} ${chalk.white('Tasks ready to work on:')} ${tasksReadyToWork}\n` +
      `${chalk.yellow('•')} ${chalk.white('Tasks blocked by links:')} ${tasksWithUnsatisfiedLinks}\n` +
      `${chalk.magenta('•')} ${chalk.white('Most linked-to task:')} ${mostLinkedTask ? chalk.cyan(`#${mostLinkedTaskId} (${maxDependents} dependents)`) : chalk.gray('None')}\n` +
      `${chalk.blue('•')} ${chalk.white('Avg links per task:')} ${avgLinksPerTask.toFixed(1)}\n\n` +
      chalk.cyan.bold('Next Task to Work On:') +
      '\n' +
      `ID: ${chalk.cyan(nextItem ? nextItem.id : 'N/A')} - ${nextItem ? chalk.white.bold(truncate(nextItem.title, 40)) : chalk.yellow('No task available')}\n` +
      `Priority: ${nextItem ? chalk.white(nextItem.priority || 'medium') : ''}  Links: ${nextItem ? formatDependenciesWithStatus(nextItem.dependencies, data.tasks, true) : ''}\n` +
      `Assessment: ${nextItem && nextItem.assessmentScore ? getAssessmentWithColor(nextItem.assessmentScore) : chalk.gray('N/A')}`;
    const minWidth = 50;
    if (terminalWidth >= minWidth * 2 + 4) {
      const halfWidth = Math.floor(terminalWidth / 2) - 4;

      const dashboardBox = boxen(projectDashboardContent, {
        padding: 1,
        borderColor: 'blue',
        borderStyle: 'round',
        width: halfWidth
      });

      const linkBox = boxen(linkDashboardContent, {
        padding: 1,
        borderColor: 'magenta',
        borderStyle: 'round',
        width: halfWidth
      });

      // Side by side
      const dashboardLines = dashboardBox.split('\n');
      const linkLines = linkBox.split('\n');
      const maxHeight = Math.max(dashboardLines.length, linkLines.length);

      const combinedLines = [];
      for (let i = 0; i < maxHeight; i++) {
        const dashLine = i < dashboardLines.length ? dashboardLines[i] : '';
        const linkLine = i < linkLines.length ? linkLines[i] : '';
        combinedLines.push(dashLine.padEnd(halfWidth + 4) + linkLine);
      }
      console.log(combinedLines.join('\n'));
    } else {
      // Stacked
      console.log(boxen(projectDashboardContent, { padding: 1, borderColor: 'blue', borderStyle: 'round' }));
      console.log(boxen(linkDashboardContent, { padding: 1, borderColor: 'magenta', borderStyle: 'round' }));
    }

    if (filteredTasks.length === 0) {
      console.log(
        boxen(
          statusFilter
            ? chalk.yellow(`No tasks with status '${statusFilter}' found`)
            : chalk.yellow('No tasks found'),
          { padding: 1, borderColor: 'yellow', borderStyle: 'round' }
        )
      );
      return;
    }
    const availableWidth = terminalWidth - 10;
    const idWidth = withSteps ? Math.floor(availableWidth * 0.08) : Math.floor(availableWidth * 0.06);
    const statusWidth = Math.floor(availableWidth * 0.14);
    const priorityWidth = Math.floor(availableWidth * 0.10);
    const linksWidth = Math.floor(availableWidth * 0.18);
    const assessmentWidth = Math.floor(availableWidth * 0.10);
    const titleWidth = availableWidth - idWidth - statusWidth - priorityWidth - linksWidth - assessmentWidth;

    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Priority'),
        chalk.cyan.bold('Links'),
        chalk.cyan.bold('Assessment')
      ],
      colWidths: [idWidth, titleWidth, statusWidth, priorityWidth, linksWidth, assessmentWidth],
      wordWrap: true,
      wrapOnWordBoundary: true
    });

    // Process tasks
    filteredTasks.forEach((task) => {
      const deps = task.dependencies || task.links || [];
      let linkText = deps.length > 0 
        ? formatDependenciesWithStatus(deps, data.tasks, true)
        : chalk.gray('None');

      const cleanTitle = task.title.replace(/\n/g, ' ');
      const priorityColor = { high: chalk.red, medium: chalk.yellow, low: chalk.gray }[task.priority || 'medium'] || chalk.white;

      table.push([
        task.id.toString(),
        truncate(cleanTitle, titleWidth - 3),
        getStatusWithColor(task.status, true),
        priorityColor(truncate(task.priority || 'medium', priorityWidth - 2)),
        linkText,
        task.assessmentScore ? getAssessmentWithColor(task.assessmentScore) : chalk.gray('N/A')
      ]);
      const steps = task.steps || task.subtasks || [];
      if (withSteps && steps.length > 0) {
        steps.forEach((step) => {
          const stepDeps = step.dependencies || step.links || [];
          let stepLinkText = stepDeps.length > 0 
            ? stepDeps.map(d => chalk.cyan(d)).join(', ')
            : chalk.gray('None');

          table.push([
            `${task.id}.${step.id}`,
            chalk.dim(`└─ ${truncate(step.title, titleWidth - 5)}`),
            getStatusWithColor(step.status, true),
            chalk.dim('-'),
            stepLinkText,
            step.assessmentScore ? chalk.gray(step.assessmentScore) : chalk.gray('N/A')
          ]);
        });
      }
    });

    console.log(table.toString());

    // Filter info
    if (statusFilter) {
      console.log(chalk.yellow(`\nFiltered by status: ${statusFilter}`));
      console.log(chalk.yellow(`Showing ${filteredTasks.length} of ${totalTasks} tasks`));
    }

    // Next task box - use TaskMaster AI command names
    if (nextItem) {
      const priorityColors = { high: chalk.red.bold, medium: chalk.yellow, low: chalk.gray };

      console.log(
        boxen(
          chalk.hex('#FF8800').bold(`🔥 Next Task to Work On: #${nextItem.id} - ${nextItem.title}`) +
            '\n\n' +
            `${chalk.white('Priority:')} ${priorityColors[nextItem.priority || 'medium'](nextItem.priority || 'medium')}   ${chalk.white('Status:')} ${getStatusWithColor(nextItem.status, true)}\n` +
            `${chalk.white('Links:')} ${nextItem.dependencies?.length > 0 ? formatDependenciesWithStatus(nextItem.dependencies, data.tasks, true) : chalk.gray('None')}\n\n` +
            `${chalk.cyan('Start working:')} ${chalk.yellow(`taskmaster set-status --id=${nextItem.id} --status=in-progress`)}\n` +
            `${chalk.cyan('View details:')} ${chalk.yellow(`taskmaster show ${nextItem.id}`)}`,
          {
            padding: { left: 2, right: 2, top: 1, bottom: 1 },
            borderColor: '#FF8800',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 },
            title: '⚡ RECOMMENDED NEXT TASK ⚡',
            titleAlignment: 'center',
            width: terminalWidth - 4
          }
        )
      );
    } else {
      console.log(
        boxen(
          chalk.hex('#FF8800').bold('No eligible next task found') +
            '\n\n' +
            'All pending tasks have links that are not yet completed, or all tasks are done.',
          {
            padding: 1,
            borderColor: '#FF8800',
            borderStyle: 'round',
            margin: { top: 1, bottom: 1 },
            title: '⚡ NEXT TASK ⚡',
            titleAlignment: 'center',
            width: terminalWidth - 4
          }
        )
      );
    }

    // Suggested next steps - use TaskMaster AI command names
    console.log(
      boxen(
        chalk.white.bold('Suggested Next Steps:') +
          '\n\n' +
          `${chalk.cyan('1.')} Run ${chalk.yellow('taskmaster next')} to see what to work on next\n` +
          `${chalk.cyan('2.')} Run ${chalk.yellow('taskmaster breakdown --id=<id>')} to break down a task into steps\n` +
          `${chalk.cyan('3.')} Run ${chalk.yellow('taskmaster set-status --id=<id> --status=done')} to mark a task as complete`,
        {
          padding: 1,
          borderColor: 'gray',
          borderStyle: 'round',
          margin: { top: 1 }
        }
      )
    );

  } catch (error) {
    log('error', `Error listing tasks: ${error.message}`);

    if (outputFormat === 'json') {
      throw {
        code: 'TASK_LIST_ERROR',
        message: error.message,
        details: error.stack
      };
    }

    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export default listTasks;
