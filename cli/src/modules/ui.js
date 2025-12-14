/**
 * User Interface functions for TaskMaster AI CLI
 * Copyright (c) 2025 TaskMaster AI LLC
 * Provides rich terminal UI with colors, progress bars, and formatted output
 */

import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { isSilentMode, truncate, findTaskById, readAssessmentReport } from './utils.js';

// Task status configuration
export const TASK_STATUS_OPTIONS = [
  'pending',
  'in-progress',
  'done',
  'blocked',
  'deferred',
  'cancelled',
  'review',
];

/**
 * Start a loading indicator with an animated spinner
 * @param {string} message - Message to display next to the spinner
 * @returns {Object} Spinner object
 */
export function startLoadingIndicator(message) {
  if (isSilentMode()) return null;

  const spinner = ora({
    text: message,
    color: 'cyan',
  }).start();

  return spinner;
}

/**
 * Stop a loading indicator
 * @param {Object} spinner - Spinner object to stop
 */
export function stopLoadingIndicator(spinner) {
  if (spinner && typeof spinner.stop === 'function') {
    spinner.stop();
  }
}

/**
 * Complete a loading indicator with success
 * @param {Object} spinner - Spinner object to complete
 * @param {string} message - Optional success message
 */
export function succeedLoadingIndicator(spinner, message = null) {
  if (spinner && typeof spinner.succeed === 'function') {
    if (message) {
      spinner.succeed(message);
    } else {
      spinner.succeed();
    }
  }
}

/**
 * Complete a loading indicator with failure
 * @param {Object} spinner - Spinner object to fail
 * @param {string} message - Optional failure message
 */
export function failLoadingIndicator(spinner, message = null) {
  if (spinner && typeof spinner.fail === 'function') {
    if (message) {
      spinner.fail(message);
    } else {
      spinner.fail();
    }
  }
}

/**
 * Create a colored progress bar
 * @param {number} percent - The completion percentage
 * @param {number} length - The total length of the progress bar in characters
 * @param {Object} statusBreakdown - Optional breakdown of non-complete statuses
 * @returns {string} The formatted progress bar
 */
export function createProgressBar(percent, length = 30, statusBreakdown = null) {
  // Adjust the percent to treat deferred and cancelled as complete
  const effectivePercent = statusBreakdown
    ? Math.min(
        100,
        percent +
          (statusBreakdown.deferred || 0) +
          (statusBreakdown.cancelled || 0)
      )
    : percent;

  // Calculate how many characters to fill for "true completion"
  const trueCompletedFilled = Math.round((percent * length) / 100);

  // Calculate how many characters to fill for "effective completion"
  const effectiveCompletedFilled = Math.round((effectivePercent * length) / 100);

  // The "deferred/cancelled" section
  const deferredCancelledFilled = effectiveCompletedFilled - trueCompletedFilled;

  // Set the empty section
  const empty = length - effectiveCompletedFilled;

  // Determine color based on percentage
  let completedColor;
  if (percent < 25) {
    completedColor = chalk.red;
  } else if (percent < 50) {
    completedColor = chalk.hex('#FFA500'); // Orange
  } else if (percent < 75) {
    completedColor = chalk.yellow;
  } else if (percent < 100) {
    completedColor = chalk.green;
  } else {
    completedColor = chalk.hex('#006400'); // Dark green
  }

  // Create colored sections
  const completedSection = completedColor('█'.repeat(trueCompletedFilled));
  const deferredCancelledSection = chalk.gray('█'.repeat(deferredCancelledFilled));

  // Create remaining section
  let remainingSection = '';

  if (statusBreakdown && empty > 0) {
    const statusColors = {
      pending: chalk.yellow,
      'in-progress': chalk.hex('#FFA500'),
      blocked: chalk.red,
      review: chalk.magenta,
    };

    const totalRemaining = Object.entries(statusBreakdown)
      .filter(([status]) => !['deferred', 'cancelled', 'done', 'completed'].includes(status))
      .reduce((sum, [_, val]) => sum + val, 0);

    if (totalRemaining <= 0) {
      remainingSection = chalk.gray('░'.repeat(empty));
    } else {
      let addedChars = 0;
      for (const [status, percentage] of Object.entries(statusBreakdown)) {
        if (['deferred', 'cancelled', 'done', 'completed'].includes(status)) continue;
        const statusChars = Math.round((percentage / totalRemaining) * empty);
        const actualChars = Math.min(statusChars, empty - addedChars);
        const colorFn = statusColors[status] || chalk.gray;
        remainingSection += colorFn('░'.repeat(actualChars));
        addedChars += actualChars;
      }
      if (addedChars < empty) {
        remainingSection += chalk.gray('░'.repeat(empty - addedChars));
      }
    }
  } else {
    remainingSection = chalk.gray('░'.repeat(empty));
  }

  const percentTextColor =
    percent === 100
      ? chalk.hex('#006400')
      : effectivePercent === 100
        ? chalk.gray
        : completedColor;

  return `${completedSection}${deferredCancelledSection}${remainingSection} ${percentTextColor(`${effectivePercent.toFixed(0)}%`)}`;
}

/**
 * Get a colored status string based on the status value
 * @param {string} status - Task status
 * @param {boolean} forTable - Whether for table display
 * @returns {string} Colored status string
 */
export function getStatusWithColor(status, forTable = false) {
  if (!status) {
    return chalk.gray('? unknown');
  }

  const statusConfig = {
    done: { color: chalk.green, icon: '✓', tableIcon: '✓' },
    completed: { color: chalk.green, icon: '✓', tableIcon: '✓' },
    pending: { color: chalk.yellow, icon: '○', tableIcon: '○' },
    'in-progress': { color: chalk.hex('#FFA500'), icon: '►', tableIcon: '►' },
    deferred: { color: chalk.gray, icon: 'x', tableIcon: 'x' },
    blocked: { color: chalk.red, icon: '!', tableIcon: '!' },
    review: { color: chalk.magenta, icon: '?', tableIcon: '?' },
    cancelled: { color: chalk.gray, icon: 'x', tableIcon: 'x' },
  };

  const config = statusConfig[status.toLowerCase()] || {
    color: chalk.red,
    icon: 'x',
    tableIcon: 'x',
  };

  if (forTable) {
    return config.color(`${config.tableIcon} ${status}`);
  }

  return config.color(`${config.icon} ${status}`);
}

/**
 * Get colored assessment score (TaskMaster AI uses "assessment" not "complexity")
 * @param {number} score - Assessment score (1-10)
 * @returns {string} Colored assessment score
 */
export function getAssessmentWithColor(score) {
  if (score <= 3) return chalk.green(`● ${score}`);
  if (score <= 6) return chalk.yellow(`● ${score}`);
  return chalk.red(`● ${score}`);
}

// Alias for backward compatibility
export const getComplexityWithColor = getAssessmentWithColor;

/**
 * Format dependencies list with status indicators
 * @param {Array} dependencies - Array of dependency IDs
 * @param {Array} allTasks - Array of all tasks
 * @param {boolean} forConsole - Whether for console display
 * @returns {string} Formatted dependencies string
 */
export function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
    return forConsole ? chalk.gray('None') : 'None';
  }

  const formattedDeps = dependencies.map((depId) => {
    const depIdStr = depId.toString();

    // Check if it's a step ID (TaskMaster AI uses "steps" instead of "subtasks")
    if (depIdStr.includes('.')) {
      const [parentId, stepId] = depIdStr.split('.').map((id) => parseInt(id, 10));
      const parentTask = allTasks.find((t) => t.id === parentId);
      
      // Support both "steps" (new) and "subtasks" (legacy) field names
      const steps = parentTask?.steps || parentTask?.subtasks;
      
      if (!parentTask || !steps) {
        return forConsole
          ? chalk.red(`${depIdStr} (Not found)`)
          : `${depIdStr} (Not found)`;
      }

      const step = steps.find((st) => st.id === stepId);
      if (!step) {
        return forConsole
          ? chalk.red(`${depIdStr} (Not found)`)
          : `${depIdStr} (Not found)`;
      }

      const status = step.status || 'pending';
      const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
      const isInProgress = status.toLowerCase() === 'in-progress';

      if (forConsole) {
        if (isDone) return chalk.green.bold(depIdStr);
        if (isInProgress) return chalk.hex('#FFA500').bold(depIdStr);
        return chalk.red.bold(depIdStr);
      }

      return depIdStr;
    }

    // Regular task dependency
    const numericDepId = typeof depId === 'string' ? parseInt(depId, 10) : depId;
    const depTask = allTasks.find((t) => t.id === numericDepId);

    if (!depTask) {
      return forConsole
        ? chalk.red(`${depIdStr} (Not found)`)
        : `${depIdStr} (Not found)`;
    }

    const status = depTask.status || 'pending';
    const isDone = status.toLowerCase() === 'done' || status.toLowerCase() === 'completed';
    const isInProgress = status.toLowerCase() === 'in-progress';

    if (forConsole) {
      if (isDone) return chalk.green.bold(depIdStr);
      if (isInProgress) return chalk.yellow.bold(depIdStr);
      return chalk.red.bold(depIdStr);
    }

    return depIdStr;
  });

  return formattedDeps.join(', ');
}

/**
 * Display the ASCII art banner for the CLI
 * @param {object} options - Display options
 */
export function displayAsciiBanner(options = {}) {
  if (isSilentMode()) return;

  const { version = '1.0.0', projectName = 'TaskMaster AI' } = options;

  const banner = `
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   ████████╗ █████╗ ███████╗██╗  ██╗███╗   ███╗ █████╗ ███████╗ ║
║   ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝████╗ ████║██╔══██╗██╔════╝ ║
║      ██║   ███████║███████╗█████╔╝ ██╔████╔██║███████║███████╗ ║
║      ██║   ██╔══██║╚════██║██╔═██╗ ██║╚██╔╝██║██╔══██║╚════██║ ║
║      ██║   ██║  ██║███████║██║  ██╗██║ ╚═╝ ██║██║  ██║███████║ ║
║      ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝ ║
║                          ████████╗██████╗                      ║
║                          ╚══██╔══╝██╔══██╗                     ║
║                             ██║   ██████╔╝                     ║
║                             ██║   ██╔══██╗                     ║
║                             ██║   ██║  ██║                     ║
║                             ╚═╝   ╚═╝  ╚═╝                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝`;

  console.log(chalk.cyan(banner));
  console.log(chalk.gray(`  v${version} | ${projectName}`));
  console.log('');
}

/**
 * Display the current tag indicator
 * @param {string} tag - The tag name
 * @param {object} options - Display options
 */
export function displayCurrentTagIndicator(tag, options = {}) {
  if (isSilentMode()) return;

  const { skipIfMaster = false, dim = false } = options;

  if (skipIfMaster && tag === 'master') return;

  const displayText = dim
    ? chalk.gray(`[tag] ${tag}`)
    : chalk.dim('[tag] ') + chalk.cyan(tag);

  console.log(displayText);
}

/**
 * Display a help guide
 */
export function displayHelp() {
  console.log(
    boxen(chalk.white.bold('TaskMaster AI CLI'), {
      padding: 1,
      borderColor: 'blue',
      borderStyle: 'round',
      margin: { top: 1, bottom: 1 },
    })
  );

  // TaskMaster AI uses distinct command names from the original
  const categories = [
    {
      title: 'Project Setup',
      color: 'blue',
      commands: [
        { name: 'init', args: '[--name=<name>] [-y]', desc: 'Initialize a new project' },
        { name: 'models', args: '', desc: 'View AI model configuration' },
      ],
    },
    {
      title: 'Task Management',
      color: 'green',
      commands: [
        { name: 'list', args: '[<status>] [--with-steps]', desc: 'List all tasks' },
        { name: 'show', args: '<id>', desc: 'Show task details' },
        { name: 'next', args: '', desc: 'Show next task to work on' },
        { name: 'set-status', args: '<id> <status>', desc: 'Update task status' },
        { name: 'new', args: '--prompt="<text>"', desc: 'Add a new task using AI' },
      ],
    },
    {
      title: 'Task Breakdown',
      color: 'magenta',
      commands: [
        { name: 'plan', args: '<prd-file>', desc: 'Generate tasks from PRD' },
        { name: 'breakdown', args: '--id=<id>', desc: 'Break down task into steps' },
        { name: 'assess', args: '', desc: 'Assess task complexity' },
      ],
    },
    {
      title: 'Context Management',
      color: 'cyan',
      commands: [
        { name: 'contexts', args: '', desc: 'List all contexts' },
        { name: 'context', args: '<name>', desc: 'Switch to a context' },
        { name: 'clone', args: '<source> <target>', desc: 'Clone a context' },
      ],
    },
  ];

  for (const category of categories) {
    console.log(
      boxen(chalk[category.color].bold(category.title), {
        padding: { left: 2, right: 2, top: 0, bottom: 0 },
        margin: { top: 1, bottom: 0 },
        borderColor: category.color,
        borderStyle: 'round',
      })
    );

    const table = new Table({
      colWidths: [25, 35, 40],
      chars: {
        top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
        bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
        left: '', 'left-mid': '', mid: '', 'mid-mid': '',
        right: '', 'right-mid': '', middle: ' ',
      },
      style: { border: [], 'padding-left': 4 },
      wordWrap: true,
    });

    for (const cmd of category.commands) {
      table.push([
        chalk.yellow.bold(cmd.name),
        chalk.white(cmd.args),
        chalk.dim(cmd.desc),
      ]);
    }

    console.log(table.toString());
    console.log('');
  }
}

/**
 * Display a boxed message
 * @param {string} content - Message content
 * @param {object} options - Boxen options
 */
export function displayBox(content, options = {}) {
  if (isSilentMode()) return;

  const defaultOptions = {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'blue',
  };

  console.log(boxen(content, { ...defaultOptions, ...options }));
}

/**
 * Display a success message
 * @param {string} message - Success message
 */
export function displaySuccess(message) {
  if (isSilentMode()) return;
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display an error message
 * @param {string} message - Error message
 */
export function displayError(message) {
  if (isSilentMode()) return;
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Display a warning message
 * @param {string} message - Warning message
 */
export function displayWarning(message) {
  if (isSilentMode()) return;
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Display an info message
 * @param {string} message - Info message
 */
export function displayInfo(message) {
  if (isSilentMode()) return;
  console.log(chalk.blue(`ℹ ${message}`));
}

export default {
  TASK_STATUS_OPTIONS,
  startLoadingIndicator,
  stopLoadingIndicator,
  succeedLoadingIndicator,
  failLoadingIndicator,
  createProgressBar,
  getStatusWithColor,
  getAssessmentWithColor,
  getComplexityWithColor, // Alias for backward compatibility
  formatDependenciesWithStatus,
  displayAsciiBanner,
  displayCurrentTagIndicator,
  displayHelp,
  displayBox,
  displaySuccess,
  displayError,
  displayWarning,
  displayInfo,
};
