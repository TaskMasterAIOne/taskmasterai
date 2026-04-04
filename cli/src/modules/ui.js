/**
 * ui.js
 * Enhanced User Interface components for TaskMaster AI CLI
 * Matching the official task-master-ai CLI look and feel
 */

import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import gradient from 'gradient-string';
import { isSilentMode, truncate, findTaskById, readAssessmentReport } from './utils.js';

const taskmasterGradient = gradient(['#c084fc', '#a855f7', '#9333ea', '#7c3aed']);

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
 * Display the ASCII art banner for TaskMaster AI
 * Styled to match the official task-master-ai CLI
 */
export function displayAsciiBanner(options = {}) {
  if (isSilentMode()) return;

  const { version = '1.0.0', projectName = 'TaskMaster' } = options;

  // ASCII art banner similar to official CLI
  const banner = `
 ████████╗ █████╗ ███████╗██╗  ██╗ ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
 ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝ ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
    ██║   ███████║███████╗█████╔╝  ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
    ██║   ██╔══██║╚════██║██╔═██╗  ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗
    ██║   ██║  ██║███████║██║  ██╗ ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝`;

  console.log(taskmasterGradient(banner));
  console.log('');
  console.log(chalk.gray('by ') + chalk.cyan.underline('https://www.taskmaster.one'));
  console.log('');

  // Version and project info in a box
  console.log(
    boxen(
      chalk.white.bold(`Version: ${version}`) + '   ' + chalk.white.bold(`Project: ${projectName}`),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderColor: 'gray',
        borderStyle: 'round',
      }
    )
  );
  console.log('');
}

/**
 * Display a boxed message with a title
 */
export function displayBoxedMessage(title, options = {}) {
  if (isSilentMode()) return;
  
  const {
    borderColor = 'gray',
    padding = { top: 0, bottom: 0, left: 2, right: 2 },
  } = options;

  console.log(
    boxen(title, {
      padding,
      borderColor,
      borderStyle: 'round',
    })
  );
}

/**
 * Start a loading indicator with an animated spinner
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
 */
export function stopLoadingIndicator(spinner) {
  if (spinner && typeof spinner.stop === 'function') {
    spinner.stop();
  }
}

/**
 * Complete a loading indicator with success
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
 * Complete a loading indicator with warning
 */
export function warnLoadingIndicator(spinner, message = null) {
  if (spinner && typeof spinner.warn === 'function') {
    if (message) {
      spinner.warn(message);
    } else {
      spinner.warn();
    }
  }
}

/**
 * Complete a loading indicator with info
 */
export function infoLoadingIndicator(spinner, message = null) {
  if (spinner && typeof spinner.info === 'function') {
    if (message) {
      spinner.info(message);
    } else {
      spinner.info();
    }
  }
}

/**
 * Create a colored progress bar
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
  
  const trueCompletedFilled = Math.round((percent * length) / 100);
  const effectiveCompletedFilled = Math.round((effectivePercent * length) / 100);

  // The "deferred/cancelled" section
  const deferredCancelledFilled = effectiveCompletedFilled - trueCompletedFilled;
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

  const completedSection = completedColor('█'.repeat(trueCompletedFilled));
  const deferredCancelledSection = chalk.gray('█'.repeat(deferredCancelledFilled));
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
 * Get colored status string
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
    deferred: { color: chalk.gray, icon: '⏱', tableIcon: '⏱' },
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
 * Get colored assessment/complexity score
 */
export function getAssessmentWithColor(score) {
  if (score <= 3) return chalk.green(`● ${score}`);
  if (score <= 6) return chalk.yellow(`● ${score}`);
  return chalk.red(`● ${score}`);
}

// Alias for backward compatibility
export const getComplexityWithColor = getAssessmentWithColor;

/**
 * Format dependencies with status colors
 */
export function formatDependenciesWithStatus(dependencies, allTasks, forConsole = false) {
  if (!dependencies || !Array.isArray(dependencies) || dependencies.length === 0) {
    return forConsole ? chalk.gray('None') : 'None';
  }

  const formattedDeps = dependencies.map((depId) => {
    const depIdStr = depId.toString();
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
 * Display the current context/tag indicator
 */
export function displayCurrentTagIndicator(tag, options = {}) {
  if (isSilentMode()) return;

  const { skipIfMain = false, skipIfMaster = false, dim = false } = options;

  // Skip for default tags if requested
  if ((skipIfMain && tag === 'main') || (skipIfMaster && tag === 'master')) return;

  const icon = '📁';
  const displayText = dim
    ? chalk.gray(`${icon} context: ${tag}`)
    : chalk.dim(`${icon} context: `) + chalk.cyan(tag);

  console.log(displayText);
}

/**
 * Display a Project Dashboard with stats
 */
export function displayProjectDashboard(stats, options = {}) {
  if (isSilentMode()) return;

  const {
    tasks = [],
    showDependencyStatus = true,
    showNextTask = true,
  } = options;

  const terminalWidth = process.stdout.columns || 100;
  const boxWidth = Math.min(terminalWidth - 4, 90);

  // Calculate stats
  const taskStats = stats || calculateTaskStats(tasks);
  const subtaskStats = calculateSubtaskStats(tasks);
  const priorityStats = calculatePriorityStats(tasks);

  // Build dashboard content
  let leftColumn = '';
  let rightColumn = '';

  // Left column: Project Dashboard
  leftColumn += chalk.white.bold('Project Dashboard') + '\n';
  leftColumn += chalk.cyan('Tasks Progress:') + ' ' + 
    createProgressBar(taskStats.percentage, 20) + ' ' + 
    chalk.cyan(`${taskStats.done}/${taskStats.total}`) + '\n';
  leftColumn += chalk.gray(`Done: ${chalk.green(taskStats.done)}  Cancelled: ${taskStats.cancelled}  Deferred: ${taskStats.deferred}`) + '\n';
  leftColumn += chalk.gray(`In Progress: ${chalk.yellow(taskStats.inProgress)}  Review: ${taskStats.review}  Pending: ${chalk.yellow(taskStats.pending)}  Blocked: ${chalk.red(taskStats.blocked)}`) + '\n';
  leftColumn += '\n';

  // Subtasks progress
  if (subtaskStats.total > 0) {
    leftColumn += chalk.cyan('Steps Progress:') + ' ' + 
      createProgressBar(subtaskStats.percentage, 20) + ' ' + 
      chalk.cyan(`${subtaskStats.done}/${subtaskStats.total}`) + '\n';
    leftColumn += chalk.gray(`Completed: ${chalk.green(subtaskStats.done)}  Cancelled: ${subtaskStats.cancelled}  Deferred: ${subtaskStats.deferred}`) + '\n';
    leftColumn += chalk.gray(`In Progress: ${chalk.yellow(subtaskStats.inProgress)}  Review: ${subtaskStats.review}  Pending: ${chalk.yellow(subtaskStats.pending)}  Blocked: ${chalk.red(subtaskStats.blocked)}`) + '\n';
    leftColumn += '\n';
  }

  // Priority breakdown
  leftColumn += chalk.cyan('Priority Breakdown:') + '\n';
  leftColumn += chalk.red('• High priority: ') + chalk.white(priorityStats.high) + '\n';
  leftColumn += chalk.yellow('• Medium priority: ') + chalk.white(priorityStats.medium) + '\n';
  leftColumn += chalk.blue('• Low priority: ') + chalk.white(priorityStats.low);

  // Right column: Dependency Status & Next Task
  if (showDependencyStatus) {
    const depStats = calculateDependencyStats(tasks);
    rightColumn += chalk.white.bold('Dependency Status & Next Task') + '\n';
    rightColumn += chalk.cyan('Dependency Metrics:') + '\n';
    rightColumn += chalk.gray(`• Tasks with no dependencies: ${depStats.noDeps}`) + '\n';
    rightColumn += chalk.gray(`• Tasks ready to work on: ${chalk.green(depStats.ready)}`) + '\n';
    rightColumn += chalk.gray(`• Tasks blocked by dependencies: ${chalk.yellow(depStats.blocked)}`) + '\n';
    if (depStats.mostDepended) {
      rightColumn += chalk.gray(`• Most depended-on task: #${depStats.mostDepended.id} (${depStats.mostDepended.count} dependents)`) + '\n';
    }
    rightColumn += chalk.gray(`• Avg dependencies per task: ${depStats.avgDeps.toFixed(1)}`) + '\n';
    rightColumn += '\n';
  }

  if (showNextTask) {
    const nextTask = findNextAvailableTask(tasks);
    if (nextTask) {
      rightColumn += chalk.yellow.bold('Next Task to Work On:') + '\n';
      rightColumn += chalk.white(`ID: ${nextTask.id} – ${truncateString(nextTask.title, 40)}`) + '\n';
      rightColumn += chalk.gray(`Priority: ${nextTask.priority || 'medium'}`) + 
        (nextTask.dependencies?.length > 0 ? chalk.gray(`  Dependencies: ${nextTask.dependencies.join(', ')}`) : '') + '\n';
      if (nextTask.complexityScore) {
        rightColumn += chalk.gray(`Complexity: ${nextTask.complexityScore}`);
      } else {
        rightColumn += chalk.gray('Complexity: N/A');
      }
    }
  }

  const leftLines = leftColumn.split('\n');
  const rightLines = rightColumn.split('\n');
  const maxLines = Math.max(leftLines.length, rightLines.length);
  const halfWidth = Math.floor((boxWidth - 4) / 2);

  let dashboardContent = '';
  for (let i = 0; i < maxLines; i++) {
    const left = leftLines[i] || '';
    const right = rightLines[i] || '';
    dashboardContent += left.padEnd(halfWidth) + '  ' + right + '\n';
  }

  console.log(
    boxen(dashboardContent.trim(), {
      padding: 1,
      borderColor: 'cyan',
      borderStyle: 'round',
    })
  );
}

/**
 * Display AI usage telemetry summary
 */
export function displayAiUsageSummary(telemetry, outputType = 'cli') {
  if (isSilentMode()) return;

  if (!telemetry) return;

  const {
    commandName = 'unknown',
    providerName = 'unknown',
    modelUsed = 'unknown',
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    totalCost = 0,
  } = telemetry;

  const costDisplay = typeof totalCost === 'number' 
    ? `$${totalCost.toFixed(6)}` 
    : '$0.000000';

  console.log('');
  console.log(
    boxen(
      chalk.yellow.bold('💡 Telemetry') + '\n\n' +
      chalk.white.bold('AI Usage Summary:') + '\n' +
      chalk.gray(`  Command: ${commandName}`) + '\n' +
      chalk.gray(`  Provider: ${providerName}`) + '\n' +
      chalk.gray(`  Model: ${modelUsed}`) + '\n' +
      chalk.gray(`  Tokens: ${totalTokens} (Input: ${inputTokens}, Output: ${outputTokens})`) + '\n' +
      chalk.gray(`  Est. Cost: ${costDisplay}`),
      {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderColor: 'yellow',
        borderStyle: 'round',
        dimBorder: true,
      }
    )
  );
}

/**
 * Display Getting Started guide
 */
export function displayGettingStarted(options = {}) {
  if (isSilentMode()) return;

  const content = chalk.white.bold('Things you should do next:') + '\n\n' +
    chalk.cyan('1.') + ' ' + chalk.yellow('Configure AI models (if needed) and add API keys to `.env`') + '\n' +
    chalk.gray('   └─ Models: Use `taskmaster models` commands') + '\n' +
    chalk.gray('   └─ Keys: Add provider API keys to .env (or inside the MCP config file i.e. .cursor/mcp.json)') + '\n\n' +
    chalk.cyan('2.') + ' ' + chalk.yellow('Discuss your idea with AI and ask for a PRD, and save it to .taskmaster-ai/docs/prd.txt') + '\n' +
    chalk.gray('   └─ Simple projects: Use example_prd.txt template') + '\n' +
    chalk.gray('   └─ Complex systems: Use example_prd_rpg.txt template (for dependency-aware task graphs)') + '\n\n' +
    chalk.cyan('3.') + ' Ask Cursor Agent (or run CLI) to parse your PRD and generate initial tasks:\n' +
    chalk.gray('   └─ MCP Tool: plan | CLI: taskmaster plan .taskmaster-ai/docs/prd.txt') + '\n\n' +
    chalk.cyan('4.') + ' Ask Cursor to analyze the complexity of the tasks in your PRD using research\n' +
    chalk.gray('   └─ MCP Tool: assess | CLI: taskmaster assess') + '\n\n' +
    chalk.cyan('5.') + ' Ask Cursor to expand all of your tasks using the complexity analysis\n\n' +
    chalk.cyan('6.') + ' Ask Cursor to begin working on the next task\n\n' +
    chalk.cyan('7.') + ' Add new tasks anytime using the new command or MCP tool\n\n' +
    chalk.cyan('8.') + ' Ask Cursor to set the status of one or many tasks/steps at a time. Use the task id from the task lists.\n\n' +
    chalk.cyan('9.') + ' Ask Cursor to update all tasks from a specific task id based on new learnings or pivots in your project.\n\n' +
    chalk.cyan('10.') + chalk.green.bold(' Ship it!') + '\n\n' +
    chalk.gray('* Review the README.md file to learn how to use other commands via Cursor Agent.') + '\n' +
    chalk.gray('* Use the taskmaster command without arguments to see all available commands.');

  console.log(
    boxen(content, {
      title: 'Getting Started',
      titleAlignment: 'center',
      padding: 1,
      borderColor: 'yellow',
      borderStyle: 'round',
    })
  );
}

/**
 * Display comprehensive help guide
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

  const categories = [
    {
      title: 'Project Setup & Configuration',
      color: 'blue',
      commands: [
        { name: 'init', args: '[--name=<name>] [-y]', desc: 'Initialize a new project with TaskMaster AI structure' },
        { name: 'models', args: '', desc: 'View current AI model configuration and available models' },
        { name: 'models --setup', args: '', desc: 'Run interactive setup to configure AI models' },
      ],
    },
    {
      title: 'Task Generation',
      color: 'cyan',
      commands: [
        { name: 'plan', args: '--input=<file.txt> [--num-tasks=10]', desc: 'Generate tasks from a PRD document' },
        { name: 'generate', args: '', desc: 'Create individual task files from tasks.json' },
      ],
    },
    {
      title: 'Task Management',
      color: 'green',
      commands: [
        { name: 'list', args: '[<status>] [--with-steps]', desc: 'List all tasks with optional status filter' },
        { name: 'show', args: '<id>', desc: 'Display detailed information about a specific task' },
        { name: 'next', args: '', desc: 'Show the next task to work on based on dependencies' },
        { name: 'set-status', args: '<id> <status>', desc: 'Update task status (pending, in-progress, done, blocked, etc.)' },
        { name: 'new', args: '--prompt="<text>"', desc: 'Add a new task using AI' },
        { name: 'edit', args: '--id=<id> --prompt="<text>"', desc: 'Update a task with new information' },
        { name: 'remove-task', args: '--id=<id> [-y]', desc: 'Permanently remove a top-level task' },
      ],
    },
    {
      title: 'Step Management',
      color: 'yellow',
      commands: [
        { name: 'add-step', args: '--parent=<id> --title="<title>"', desc: 'Add a new step to a parent task' },
        { name: 'log', args: '--id=<parentId.stepId> --prompt="<text>"', desc: 'Append information to a step' },
        { name: 'remove-step', args: '--id=<parentId.stepId> [--convert]', desc: 'Remove a step (optionally convert to task)' },
        { name: 'clear-steps', args: '--id=<id>', desc: 'Remove all steps from specified tasks' },
      ],
    },
    {
      title: 'Task Analysis & Breakdown',
      color: 'magenta',
      commands: [
        { name: 'assess', args: '[--research] [--threshold=5]', desc: 'Analyze tasks and generate breakdown recommendations' },
        { name: 'report', args: '[--file=<path>]', desc: 'Display the complexity analysis report' },
        { name: 'breakdown', args: '--id=<id> [--num=5] [--research]', desc: 'Break down tasks into detailed steps' },
        { name: 'ask', args: '"<prompt>" [--tree] [--files=<paths>]', desc: 'Perform AI-powered research queries' },
      ],
    },
    {
      title: 'Context Management',
      color: 'cyan',
      commands: [
        { name: 'contexts', args: '[--show-metadata]', desc: 'List all available contexts with task counts' },
        { name: 'context', args: '<name>', desc: 'Switch to a different context' },
        { name: 'context-add', args: '<name> [--copy-from-current]', desc: 'Create a new context' },
        { name: 'delete-context', args: '<name> [--yes]', desc: 'Delete an existing context and all its tasks' },
        { name: 'clone', args: '<source> <target>', desc: 'Copy a context to create a new one' },
      ],
    },
    {
      title: 'Link (Dependency) Management',
      color: 'blue',
      commands: [
        { name: 'link', args: '--id=<id> --depends-on=<id>', desc: 'Add a dependency to a task' },
        { name: 'unlink', args: '--id=<id> --depends-on=<id>', desc: 'Remove a dependency from a task' },
        { name: 'check-links', args: '', desc: 'Identify invalid dependencies without fixing them' },
        { name: 'fix-links', args: '', desc: 'Fix invalid dependencies automatically' },
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

    const terminalWidth = process.stdout.columns || 100;
    const nameWidth = Math.max(25, Math.floor(terminalWidth * 0.2));
    const argsWidth = Math.max(35, Math.floor(terminalWidth * 0.35));
    const descWidth = Math.max(40, Math.floor(terminalWidth * 0.45) - 10);

    const table = new Table({
      colWidths: [nameWidth, argsWidth, descWidth],
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

  // Quick start box
  console.log(
    boxen(
      chalk.white.bold('Quick Start:') + '\n\n' +
      chalk.cyan('1. Create Project: ') + chalk.white('taskmaster init') + '\n' +
      chalk.cyan('2. Setup Models: ') + chalk.white('taskmaster models --setup') + '\n' +
      chalk.cyan('3. Plan PRD: ') + chalk.white('taskmaster plan --input=<prd-file>') + '\n' +
      chalk.cyan('4. List Tasks: ') + chalk.white('taskmaster list') + '\n' +
      chalk.cyan('5. Find Next Task: ') + chalk.white('taskmaster next'),
      {
        padding: 1,
        borderColor: 'yellow',
        borderStyle: 'round',
        margin: { top: 1 },
      }
    )
  );
}

/**
 * Display a box with content
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
 * Display success message
 */
export function displaySuccess(message) {
  if (isSilentMode()) return;
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display error message
 */
export function displayError(message) {
  if (isSilentMode()) return;
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Display warning message
 */
export function displayWarning(message) {
  if (isSilentMode()) return;
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Display info message
 */
export function displayInfo(message) {
  if (isSilentMode()) return;
  console.log(chalk.blue(`ℹ ${message}`));
}

/**
 * Display next steps box
 */
export function displayNextSteps(steps) {
  if (isSilentMode()) return;

  const content = steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  
  console.log(
    boxen(content, {
      title: 'Next Steps:',
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      borderColor: 'yellow',
      borderStyle: 'round',
    })
  );
}

function truncateString(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function calculateTaskStats(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { total: 0, done: 0, pending: 0, inProgress: 0, blocked: 0, deferred: 0, cancelled: 0, review: 0, percentage: 0 };
  }

  const stats = {
    total: tasks.length,
    done: 0,
    pending: 0,
    inProgress: 0,
    blocked: 0,
    deferred: 0,
    cancelled: 0,
    review: 0,
  };

  for (const task of tasks) {
    const status = (task.status || 'pending').toLowerCase();
    switch (status) {
      case 'done':
      case 'completed':
        stats.done++;
        break;
      case 'pending':
        stats.pending++;
        break;
      case 'in-progress':
        stats.inProgress++;
        break;
      case 'blocked':
        stats.blocked++;
        break;
      case 'deferred':
        stats.deferred++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
      case 'review':
        stats.review++;
        break;
      default:
        stats.pending++;
    }
  }

  stats.percentage = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

function calculateSubtaskStats(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { total: 0, done: 0, pending: 0, inProgress: 0, blocked: 0, deferred: 0, cancelled: 0, review: 0, percentage: 0 };
  }

  const stats = {
    total: 0,
    done: 0,
    pending: 0,
    inProgress: 0,
    blocked: 0,
    deferred: 0,
    cancelled: 0,
    review: 0,
  };

  for (const task of tasks) {
    const subtasks = task.steps || task.subtasks || [];
    stats.total += subtasks.length;

    for (const subtask of subtasks) {
      const status = (subtask.status || 'pending').toLowerCase();
      switch (status) {
        case 'done':
        case 'completed':
          stats.done++;
          break;
        case 'pending':
          stats.pending++;
          break;
        case 'in-progress':
          stats.inProgress++;
          break;
        case 'blocked':
          stats.blocked++;
          break;
        case 'deferred':
          stats.deferred++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
        case 'review':
          stats.review++;
          break;
        default:
          stats.pending++;
      }
    }
  }

  stats.percentage = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

function calculatePriorityStats(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { high: 0, medium: 0, low: 0 };
  }

  const stats = { high: 0, medium: 0, low: 0 };

  for (const task of tasks) {
    const priority = (task.priority || 'medium').toLowerCase();
    if (priority === 'high') stats.high++;
    else if (priority === 'low') stats.low++;
    else stats.medium++;
  }

  return stats;
}

function calculateDependencyStats(tasks) {
  if (!tasks || !Array.isArray(tasks)) {
    return { noDeps: 0, ready: 0, blocked: 0, avgDeps: 0, mostDepended: null };
  }

  let noDeps = 0;
  let ready = 0;
  let blocked = 0;
  let totalDeps = 0;
  const dependentCount = {};

  for (const task of tasks) {
    const deps = task.dependencies || [];
    totalDeps += deps.length;

    if (deps.length === 0) {
      noDeps++;
    }

    // Track which tasks are depended on
    for (const depId of deps) {
      dependentCount[depId] = (dependentCount[depId] || 0) + 1;
    }

    const allDepsDone = deps.every(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && (depTask.status === 'done' || depTask.status === 'completed');
    });

    if (task.status !== 'done' && task.status !== 'completed') {
      if (deps.length === 0 || allDepsDone) {
        ready++;
      } else {
        blocked++;
      }
    }
  }

  // Find most depended-on task
  let mostDepended = null;
  let maxDependents = 0;
  for (const [taskId, count] of Object.entries(dependentCount)) {
    if (count > maxDependents) {
      maxDependents = count;
      mostDepended = { id: taskId, count };
    }
  }

  return {
    noDeps,
    ready,
    blocked,
    avgDeps: tasks.length > 0 ? totalDeps / tasks.length : 0,
    mostDepended,
  };
}

function findNextAvailableTask(tasks) {
  if (!tasks || !Array.isArray(tasks)) return null;

  // Find tasks that are pending or in-progress with all dependencies satisfied
  const availableTasks = tasks.filter(task => {
    if (task.status === 'done' || task.status === 'completed' || 
        task.status === 'cancelled' || task.status === 'deferred') {
      return false;
    }

    const deps = task.dependencies || [];
    return deps.every(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && (depTask.status === 'done' || depTask.status === 'completed');
    });
  });

  if (availableTasks.length === 0) return null;

  // Sort by priority (high > medium > low) and then by id
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  availableTasks.sort((a, b) => {
    const priorityA = priorityOrder[a.priority || 'medium'] || 1;
    const priorityB = priorityOrder[b.priority || 'medium'] || 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return a.id - b.id;
  });

  return availableTasks[0];
}

export default {
  TASK_STATUS_OPTIONS,
  displayAsciiBanner,
  displayBoxedMessage,
  startLoadingIndicator,
  stopLoadingIndicator,
  succeedLoadingIndicator,
  failLoadingIndicator,
  warnLoadingIndicator,
  infoLoadingIndicator,
  createProgressBar,
  getStatusWithColor,
  getAssessmentWithColor,
  getComplexityWithColor,
  formatDependenciesWithStatus,
  displayCurrentTagIndicator,
  displayProjectDashboard,
  displayAiUsageSummary,
  displayGettingStarted,
  displayHelp,
  displayBox,
  displaySuccess,
  displayError,
  displayWarning,
  displayInfo,
  displayNextSteps,
};
