
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  log,
  readJSON,
  writeJSON,
  truncate,
  isSilentMode,
  findProjectRoot,
  getTasksFilePath
} from '../utils.js';
import { getCurrentContext } from '../context-manager.js';

function clearSteps(tasksPath, taskIds, options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  const root = projectRoot || findProjectRoot() || process.cwd();
  const currentContext = context || getCurrentContext(root);
  
  log('info', `Reading tasks from ${tasksPath}...`);
  const data = readJSON(tasksPath, root, currentContext);
  
  if (!data || !data.tasks) {
    const error = new Error('No valid tasks found.');
    log('error', error.message);
    if (outputFormat === 'json') {
      return { success: false, error: error.message };
    }
    throw error;
  }

  if (outputFormat === 'text' && !isSilentMode()) {
    console.log(
      boxen(chalk.white.bold('Clearing Steps'), {
        padding: 1,
        borderColor: 'blue',
        borderStyle: 'round',
        margin: { top: 1, bottom: 1 }
      })
    );
  }

  // Handle multiple task IDs (comma-separated)
  const taskIdArray = taskIds.split(',').map((id) => id.trim());
  let clearedCount = 0;
  const results = [];
  const summaryTable = new Table({
    head: [
      chalk.cyan.bold('Task ID'),
      chalk.cyan.bold('Task Title'),
      chalk.cyan.bold('Steps Cleared')
    ],
    colWidths: [10, 50, 20],
    style: { head: [], border: [] }
  });

  taskIdArray.forEach((taskId) => {
    const id = parseInt(taskId, 10);
    if (Number.isNaN(id)) {
      log('error', `Invalid task ID: ${taskId}`);
      results.push({ taskId, success: false, error: 'Invalid ID' });
      return;
    }

    const task = data.tasks.find((t) => t.id === id);
    if (!task) {
      log('error', `Task ${id} not found`);
      results.push({ taskId: id, success: false, error: 'Not found' });
      return;
    }
    const steps = task.steps || task.subtasks || [];
    if (steps.length === 0) {
      log('info', `Task ${id} has no steps to clear`);
      summaryTable.push([
        id.toString(),
        truncate(task.title, 47),
        chalk.yellow('No steps')
      ]);
      results.push({ taskId: id, success: true, stepsCleared: 0 });
      return;
    }

    const stepCount = steps.length;
    task.steps = [];
    if (task.subtasks) {
      task.subtasks = undefined;
    }
    clearedCount++;
    log('info', `Cleared ${stepCount} steps from task ${id}`);

    summaryTable.push([
      id.toString(),
      truncate(task.title, 47),
      chalk.green(`${stepCount} steps cleared`)
    ]);
    results.push({ taskId: id, success: true, stepsCleared: stepCount });
  });

  if (clearedCount > 0) {
    writeJSON(tasksPath, data, root, currentContext);

    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        clearedCount,
        results,
        context: currentContext
      };
    }
    if (!isSilentMode()) {
      console.log(
        boxen(chalk.white.bold('Step Clearing Summary:'), {
          padding: { left: 2, right: 2, top: 0, bottom: 0 },
          margin: { top: 1, bottom: 0 },
          borderColor: 'blue',
          borderStyle: 'round'
        })
      );
      console.log(summaryTable.toString());

      // Success message
      console.log(
        boxen(
          chalk.green(
            `Successfully cleared steps from ${chalk.bold(clearedCount)} task(s)`
          ),
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1 }
          }
        )
      );

      // Next steps suggestion
      console.log(
        boxen(
          chalk.white.bold('Next Steps:') +
            '\n\n' +
            `${chalk.cyan('1.')} Run ${chalk.yellow('tm breakdown --id=<id>')} to generate new steps\n` +
            `${chalk.cyan('2.')} Run ${chalk.yellow('tm list --with-steps')} to verify changes`,
          {
            padding: 1,
            borderColor: 'cyan',
            borderStyle: 'round',
            margin: { top: 1 }
          }
        )
      );
    }
  } else {
    if (outputFormat === 'json') {
      return {
        success: true,
        clearedCount: 0,
        results,
        message: 'No steps were cleared'
      };
    }

    if (!isSilentMode()) {
      console.log(
        boxen(chalk.yellow('No steps were cleared'), {
          padding: 1,
          borderColor: 'yellow',
          borderStyle: 'round',
          margin: { top: 1 }
        })
      );
    }
  }

  return { success: true, clearedCount, results };
}

function clearAllSteps(tasksPath, options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  const root = projectRoot || findProjectRoot() || process.cwd();
  const currentContext = context || getCurrentContext(root);
  
  const data = readJSON(tasksPath, root, currentContext);
  if (!data || !data.tasks) {
    throw new Error('No valid tasks found.');
  }
  const taskIdsWithSteps = data.tasks
    .filter(t => (t.steps && t.steps.length > 0) || (t.subtasks && t.subtasks.length > 0))
    .map(t => t.id.toString());

  if (taskIdsWithSteps.length === 0) {
    if (outputFormat === 'json') {
      return { success: true, clearedCount: 0, message: 'No tasks with steps found' };
    }
    if (!isSilentMode()) {
      console.log(chalk.yellow('No tasks with steps found.'));
    }
    return { success: true, clearedCount: 0 };
  }

  return clearSteps(tasksPath, taskIdsWithSteps.join(','), options);
}

export { clearSteps, clearAllSteps };
export default clearSteps;
