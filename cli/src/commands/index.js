import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { 
  ensureProjectConfigDir, 
  findProjectRoot, 
  getDefaultConfig, 
  writeProjectConfig,
  readProjectConfig,
  getTasksFilePath,
  getApiKey,
  writeState,
} from '../lib/config.js';
import {
  getAllTasks,
  findTaskById,
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
  saveAllTasks,
  getCurrentTag,
  getAllTags,
  createTag,
  deleteTagData,
  switchTag,
  renameTag,
  copyTag,
  validateDependencies,
  fixDependencies,
  moveTask,
  addSingleSubtask,
  generateTaskFiles,
  getReadyTasks,
  getBlockingTasks,
  getTasksForTag,
} from '../lib/tasks.js';
import {
  generateTasksFromPRD,
  expandTask as aiExpandTask,
  analyzeComplexity,
  generateTask,
  performResearch,
  batchUpdateTasks,
} from '../lib/ai.js';
import {
  enforceUsageLimit,
  incrementUsage,
  getUsageSummary,
  checkUsageLimit,
} from '../lib/usage.js';
import {
  readCachedConfig,
} from '../lib/license.js';
import Table from 'cli-table3';
import {
  displayAsciiBanner,
  displayBoxedMessage,
  displayCurrentTagIndicator,
  displayProjectDashboard,
  displayAiUsageSummary,
  displayGettingStarted,
  displaySuccess,
  displayError,
  displayWarning,
  displayInfo,
  displayNextSteps,
  createProgressBar,
  getStatusWithColor,
  getAssessmentWithColor,
  startLoadingIndicator,
  stopLoadingIndicator,
  succeedLoadingIndicator,
  failLoadingIndicator,
} from '../modules/ui.js';

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function getStatusColor(status) {
  switch (status) {
    case 'done':
    case 'completed':
      return chalk.green;
    case 'in-progress':
      return chalk.hex('#FFA500');
    case 'pending':
      return chalk.yellow;
    case 'blocked':
      return chalk.red;
    case 'cancelled':
      return chalk.gray;
    case 'deferred':
      return chalk.blue;
    case 'review':
      return chalk.magenta;
    default:
      return chalk.white;
  }
}

function getStatusDisplay(status) {
  switch (status) {
    case 'done':
    case 'completed':
      return chalk.green('✓ done');
    case 'in-progress':
      return chalk.hex('#FFA500')('► in-progress');
    case 'pending':
      return chalk.yellow('○ pending');
    case 'blocked':
      return chalk.red('! blocked');
    case 'cancelled':
      return chalk.gray('x cancelled');
    case 'deferred':
      return chalk.blue('⏱ deferred');
    case 'review':
      return chalk.magenta('? review');
    default:
      return chalk.white(status || 'pending');
  }
}

function getPriorityBadge(priority) {
  switch (priority) {
    case 'high':
      return chalk.red('▲ high');
    case 'low':
      return chalk.blue('▼ low');
    default:
      return chalk.yellow('● medium');
  }
}

export function registerCommands(program) {
  // Init command
  program
    .command('init')
    .description('Initialize TaskMaster AI in the current project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <text>', 'Project description')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(async (options) => {
      // Display banner
      const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
      displayAsciiBanner({ version: pkg.version, projectName: 'TaskMaster AI' });

      const projectRoot = process.cwd();
      if (findProjectRoot(projectRoot)) {
        displayWarning('TaskMaster AI is already initialized in this project.');
        return;
      }

      displayBoxedMessage(chalk.white('Initializing') + ' your new project', { borderColor: 'cyan' });
      console.log('');

      ensureProjectConfigDir(projectRoot);
      const config = getDefaultConfig();
      config.projectName = options.name || path.basename(projectRoot);
      config.projectDescription = options.description || '';
      writeProjectConfig(config, projectRoot);
      
      const tasksPath = getTasksFilePath(projectRoot);
      // Use 'main' as default context per terminology
      const initialTasks = {
        tags: {
          main: {
            tasks: [],
            metadata: {
              createdAt: new Date().toISOString(),
              description: 'Main project context'
            }
          }
        }
      };
      fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));

      const initialState = {
        currentTag: 'main',
        lastSwitched: new Date().toISOString(),
        migrationNoticeShown: true,
      };
      writeState(initialState, projectRoot);

      const templatesDir = path.join(projectRoot, '.taskmaster-ai', 'templates');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }

      const docsDir = path.join(projectRoot, '.taskmaster-ai', 'docs');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      const reportsDir = path.join(projectRoot, '.taskmaster-ai', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Write example PRD template
      const examplePrd = `# Project Requirements Document (PRD)

## Project Overview
[Describe your project here - what it does, who it's for, and the main goals]

## Core Features
1. [Feature 1] - [Brief description]
2. [Feature 2] - [Brief description]
3. [Feature 3] - [Brief description]

## Technical Requirements
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]

## User Stories
- As a [user type], I want to [action] so that [benefit]
- As a [user type], I want to [action] so that [benefit]

## Success Criteria
- [Criterion 1]
- [Criterion 2]

## Out of Scope
- [What's not included in this version]

## Timeline
- Phase 1: [Description]
- Phase 2: [Description]
`;
      fs.writeFileSync(path.join(templatesDir, 'example_prd.txt'), examplePrd);

      displaySuccess('Created .taskmaster-ai directory');
      displaySuccess('Created config.json');
      displaySuccess('Created tasks.json');
      displaySuccess('Created templates/example_prd.txt');
      displayInfo('Default context set to "main" for task organization');
      console.log('');

      // Display getting started guide
      displayGettingStarted();
    });

  program
    .command('parse-prd')
    .alias('plan')
    .description('Parse a PRD file and generate tasks')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .option('-f, --force', 'Overwrite existing tasks')
    .option('--append', 'Append to existing tasks')
    .option('-r, --research', 'Use research model for better results')
    .option('-v, --verbose', 'Show detailed progress and model info')
    .action(async (file, options) => {
      const prdPath = file || options.input;
      
      if (!prdPath) {
        displayError('Please provide a PRD file path');
        process.exit(1);
      }

      if (!fs.existsSync(prdPath)) {
        displayError(`File not found: ${prdPath}`);
        process.exit(1);
      }

      const projectRoot = findProjectRoot() || process.cwd();
      ensureProjectConfigDir(projectRoot);
      
      // Display banner
      const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
      const config = readProjectConfig(projectRoot);
      displayAsciiBanner({ version: pkg.version, projectName: config.projectName || 'TaskMaster' });

      // Show current context
      const currentTag = getCurrentTag(projectRoot);
      displayCurrentTagIndicator(currentTag);

      const existingTasks = getAllTasks(projectRoot);
      if (existingTasks.length > 0 && !options.force && !options.append) {
        displayWarning('Tasks already exist. Use --force to overwrite or --append to add.');
        process.exit(1);
      }

      console.log(chalk.cyan(`Parsing PRD file: ${prdPath}`));
      const numTasks = parseInt(options.numTasks) || 10;
      console.log(chalk.cyan(`Generating ${numTasks} tasks...`));
      console.log('');

      const spinner = startLoadingIndicator('Parsing PRD and generating tasks...');

      try {
        try {
          enforceUsageLimit(numTasks);
        } catch (limitError) {
          stopLoadingIndicator(spinner);
          console.log('');
          console.log(
            boxen(
              chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
              chalk.white(limitError.message) + '\n\n' +
              chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
              { padding: 1, borderColor: 'red', borderStyle: 'round' }
            )
          );
          process.exit(1);
        }

        const prdContent = fs.readFileSync(prdPath, 'utf-8');
        
        // Show model info in verbose mode
        const modelConfig = options.research ? config.models.research : config.models.main;
        
        if (options.verbose) {
          displayInfo(`Using ${modelConfig.provider}/${modelConfig.modelId}`);
        }

        // Progress tracker - updates spinner every second with elapsed time
        const startTime = Date.now();
        const progressInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          if (spinner) {
            spinner.text = `Calling AI service to generate tasks from PRD... (${elapsed}s)`;
          }
        }, 1000);

        let result;
        try {
          result = await generateTasksFromPRD(prdContent, {
            numTasks,
            research: options.research,
          });
          
          clearInterval(progressInterval);
        } catch (err) {
          clearInterval(progressInterval);
          throw err;
        }

        // Handle both array (legacy) and object with telemetry (new) returns
        const tasks = Array.isArray(result) ? result : (result.tasks || result);
        const telemetryData = Array.isArray(result) ? null : result.telemetryData;
        
        await incrementUsage('tasksParsed', tasks.length);

        succeedLoadingIndicator(spinner, 'Tasks generated successfully!');
        
        let finalTasks;
        if (options.append) {
          const maxId = existingTasks.length > 0 
            ? Math.max(...existingTasks.map(t => t.id)) 
            : 0;
          finalTasks = [
            ...existingTasks,
            ...tasks.map((t, i) => ({ ...t, id: maxId + i + 1 }))
          ];
        } else {
          finalTasks = tasks.map((t, i) => ({ ...t, id: i + 1 }));
        }

        saveAllTasks(finalTasks, projectRoot);

        console.log('');
        console.log(
          boxen(
            chalk.green(`Successfully generated ${tasks.length} new tasks. Total tasks in ${getTasksFilePath(projectRoot)}: ${finalTasks.length}`),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'green',
              borderStyle: 'round',
            }
          )
        );
        console.log('');

        // Display next steps
        displayNextSteps([
          `Run ${chalk.cyan('taskmaster list')} to view all tasks`,
          `Run ${chalk.cyan('taskmaster breakdown --id=<id>')} to break down a task into steps`,
        ]);

        // Display telemetry if available
        if (telemetryData) {
          displayAiUsageSummary(telemetryData, 'cli');
        } else {

          displayAiUsageSummary({
            commandName: 'plan',
            providerName: modelConfig.provider,
            modelUsed: modelConfig.modelId,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
          }, 'cli');
        }
      } catch (error) {
        failLoadingIndicator(spinner, 'Failed to generate tasks');
        console.log('');
        displayError(`Error generating tasks: ${error.message}`);
        
        if (options.verbose || process.env.TASKMASTER_DEBUG === 'true') {
          console.log('');
          console.log(chalk.dim('Full error details:'));
          console.log(chalk.dim(error.stack || error.toString()));
        }
        
        console.log('');
        console.log(chalk.dim('Troubleshooting:'));
        console.log(chalk.dim('  1. Check your model configuration: ') + chalk.cyan('taskmaster models'));
        console.log(chalk.dim('  2. Verify API keys are set: ') + chalk.cyan('taskmaster models'));
        console.log(chalk.dim('  3. Run with --verbose flag: ') + chalk.cyan('taskmaster plan prd.md --verbose'));
        console.log(chalk.dim('  4. Enable debug mode: ') + chalk.cyan('TASKMASTER_DEBUG=true taskmaster plan ...'));
        console.log('');
        process.exit(1);
      }
    });

  // List tasks command (with table format and dashboard)
  program
    .command('list')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('--with-subtasks', 'Include subtasks/steps')
    .option('--with-steps', 'Include subtasks/steps (alias)')
    .option('--ready', 'Show only tasks whose dependencies are satisfied')
    .option('--blocking', 'Show only tasks that other tasks depend on')
    .option('--all-tags', 'List tasks across all tags (use with --ready)')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        displayError('Not in a TaskMaster project. Run "taskmaster init" first.');
        process.exit(1);
      }

      const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
      const config = readProjectConfig(projectRoot);
      displayAsciiBanner({ version: pkg.version, projectName: config.projectName || 'TaskMaster' });

      const currentTag = getCurrentTag(projectRoot);
      displayCurrentTagIndicator(currentTag);

      console.log(chalk.gray(`Listing tasks from: ${getTasksFilePath(projectRoot)}`));
      console.log('');

      let tasks;
      if (options.allTags) {
        const tags = getAllTags(projectRoot);
        tasks = [];
        for (const tag of tags) {
          const tagTasks = getTasksForTag(tag.name, projectRoot);
          tagTasks.forEach(t => tasks.push({ ...t, _tag: tag.name }));
        }
      } else {
        tasks = getAllTasks(projectRoot);
      }
      const allTasks = [...tasks];

      if (options.status) {
        const statuses = options.status.split(',').map(s => s.trim());
        tasks = tasks.filter(t => statuses.includes(t.status));
      }

      if (options.ready) {
        const completedIds = new Set(
          allTasks.filter(t => t.status === 'done' || t.status === 'completed').map(t => t.id)
        );
        const actionable = new Set(['pending', 'in-progress']);
        tasks = tasks.filter(t =>
          actionable.has(t.status) &&
          (t.dependencies || []).every(dep => completedIds.has(dep))
        );
      }

      if (options.blocking) {
        const depTargets = new Set();
        for (const t of allTasks) {
          for (const d of (t.dependencies || [])) depTargets.add(d);
        }
        tasks = tasks.filter(t => depTargets.has(t.id));
      }

      // Display project dashboard with all tasks (unfiltered)
      displayProjectDashboard(null, {
        tasks: allTasks,
        showDependencyStatus: true,
        showNextTask: true,
      });

      if (tasks.length === 0) {
        displayWarning('No tasks found matching the filter criteria.');
        return;
      }

      console.log('');

      // Calculate terminal width for responsive columns
      const terminalWidth = process.stdout.columns || 100;
      const idWidth = 8;
      const statusWidth = 16;
      const priorityWidth = 12;
      const depsWidth = 14;
      const titleWidth = Math.max(30, terminalWidth - idWidth - statusWidth - priorityWidth - depsWidth - 10);

      // Build "blocks" map for the Blocks column
      const blocksMap = new Map();
      if (options.blocking) {
        for (const t of allTasks) {
          for (const d of (t.dependencies || [])) {
            if (!blocksMap.has(d)) blocksMap.set(d, []);
            blocksMap.get(d).push(t.id);
          }
        }
      }

      const headCols = [];
      const colWidths = [];

      if (options.allTags) {
        headCols.push(chalk.cyan.bold('Tag'));
        colWidths.push(12);
      }

      headCols.push(
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('Title'),
        chalk.cyan.bold('Status'),
        chalk.cyan.bold('Priority'),
        chalk.cyan.bold('Dependencies'),
      );

      const extraCols = (options.allTags ? 12 : 0) + (options.blocking ? 14 : 0);
      const adjustedTitleWidth = Math.max(24, titleWidth - extraCols);

      colWidths.push(idWidth, adjustedTitleWidth, statusWidth, priorityWidth, depsWidth);

      if (options.blocking) {
        headCols.push(chalk.cyan.bold('Blocks'));
        colWidths.push(14);
      }

      const table = new Table({
        head: headCols,
        colWidths,
        wordWrap: true,
        style: {
          head: [],
          border: [],
        },
      });

      tasks.forEach(task => {
        const statusDisplay = getStatusDisplay(task.status);
        const priorityDisplay = getPriorityBadge(task.priority);
        const depsDisplay = task.dependencies?.length > 0 
          ? task.dependencies.map(d => {
              const depTask = allTasks.find(t => t.id === d);
              return depTask?.status === 'done' ? chalk.green(d) : chalk.yellow(d);
            }).join(', ')
          : chalk.gray('-');
        
        const row = [];
        if (options.allTags) row.push(chalk.magenta(task._tag || '-'));
        row.push(
          chalk.white(task.id),
          truncateText(task.title, adjustedTitleWidth - 2),
          statusDisplay,
          priorityDisplay,
          depsDisplay,
        );
        if (options.blocking) {
          const blocked = blocksMap.get(task.id);
          row.push(blocked ? blocked.join(', ') : chalk.gray('-'));
        }
        table.push(row);

        const showSteps = options.withSubtasks || options.withSteps;
        const steps = task.steps || task.subtasks || [];
        
        if (showSteps && steps.length > 0) {
          steps.forEach(step => {
            const stepStatusDisplay = getStatusDisplay(step.status);
            const stepRow = [];
            if (options.allTags) stepRow.push('');
            stepRow.push(
              chalk.gray(`  ${task.id}.${step.id}`),
              chalk.dim(truncateText(step.title, adjustedTitleWidth - 4)),
              stepStatusDisplay,
              '',
              '',
            );
            if (options.blocking) stepRow.push('');
            table.push(stepRow);
          });
        }
      });

      console.log(table.toString());
      console.log('');
    });
  program
    .command('show')
    .description('Show detailed information for a task')
    .argument('<id>', 'Task ID (e.g., 1 or 1.2 for step)')
    .action(async (id) => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        displayError('Not in a TaskMaster project.');
        process.exit(1);
      }

      // Display banner
      const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
      const config = readProjectConfig(projectRoot);
      displayAsciiBanner({ version: pkg.version, projectName: config.projectName || 'TaskMaster' });

      // Show current context
      const currentTag = getCurrentTag(projectRoot);
      displayCurrentTagIndicator(currentTag);

      const task = findTaskById(id, projectRoot);

      if (!task) {
        displayError(`Task ${id} not found.`);
        process.exit(1);
      }

      // Build task header box
      const priorityColors = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.blue,
      };
      const priorityColor = priorityColors[task.priority || 'medium'] || chalk.white;

      console.log(
        boxen(
          chalk.white.bold(`Task #${id} - ${task.title}`),
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderColor: 'blue',
            borderStyle: 'round',
          }
        )
      );

      // Task details table
      const detailsTable = new Table({
        style: { head: [], border: [], compact: true },
        chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
        colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
        wordWrap: true,
      });

      detailsTable.push(
        [chalk.cyan.bold('ID:'), id],
        [chalk.cyan.bold('Title:'), task.title],
        [chalk.cyan.bold('Status:'), getStatusWithColor(task.status)],
        [chalk.cyan.bold('Priority:'), priorityColor(task.priority || 'medium')],
      );

      if (task.dependencies?.length > 0) {
        const allTasks = getAllTasks(projectRoot);
        const depsFormatted = task.dependencies.map(depId => {
          const depTask = allTasks.find(t => t.id === depId);
          if (depTask) {
            return depTask.status === 'done' ? chalk.green(depId) : chalk.yellow(depId);
          }
          return chalk.red(`${depId} (not found)`);
        }).join(', ');
        detailsTable.push([chalk.cyan.bold('Dependencies:'), depsFormatted]);
      }

      detailsTable.push([chalk.cyan.bold('Description:'), task.description || chalk.gray('No description')]);

      console.log(detailsTable.toString());

      // Implementation details box
      if (task.details && task.details.trim().length > 0) {
        console.log(
          boxen(
            chalk.white.bold('Implementation Details:') + '\n\n' + task.details,
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'cyan',
              borderStyle: 'round',
              margin: { top: 1, bottom: 0 },
            }
          )
        );
      }

      // Test strategy box
      if (task.testStrategy) {
        console.log(
          boxen(
            chalk.white.bold('Test Strategy:') + '\n\n' + task.testStrategy,
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'yellow',
              borderStyle: 'round',
              margin: { top: 1, bottom: 0 },
            }
          )
        );
      }

      // Display steps/subtasks
      const steps = task.steps || task.subtasks || [];
      if (steps.length > 0) {
        console.log(
          boxen(
            chalk.white.bold('Steps'),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 0 },
              borderColor: 'magenta',
              borderStyle: 'round',
            }
          )
        );

        const stepsTable = new Table({
          head: [
            chalk.magenta.bold('ID'),
            chalk.magenta.bold('Status'),
            chalk.magenta.bold('Title'),
          ],
          colWidths: [10, 16, 60],
          style: { head: [], border: [], compact: true },
          wordWrap: true,
        });

        steps.forEach(step => {
          stepsTable.push([
            `${id}.${step.id}`,
            getStatusWithColor(step.status),
            step.title,
          ]);
        });

        console.log(stepsTable.toString());
      }

      // Suggested actions
      const suggestedActions = [
        `Mark as in-progress: ${chalk.yellow(`taskmaster set-status --id ${id} --status in-progress`)}`,
        `Mark as done: ${chalk.yellow(`taskmaster set-status --id ${id} --status done`)}`,
      ];
      
      if (steps.length === 0) {
        suggestedActions.push(`Break down into steps: ${chalk.yellow(`taskmaster breakdown --id=${id}`)}`);
      } else {
        suggestedActions.push(`Update step status: ${chalk.yellow(`taskmaster set-status --id ${id}.1 --status done`)}`);
      }

      console.log(
        boxen(
          chalk.white.bold('Suggested Actions:') + '\n' +
          suggestedActions.map((action, i) => `${chalk.cyan(i + 1 + '.')} ${action}`).join('\n'),
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1 },
          }
        )
      );
    });

  // Next task command
  program
    .command('next')
    .description('Show the next task to work on')
    .action(async () => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        displayError('Not in a TaskMaster project.');
        process.exit(1);
      }

      // Display banner
      const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
      const config = readProjectConfig(projectRoot);
      displayAsciiBanner({ version: pkg.version, projectName: config.projectName || 'TaskMaster' });

      // Show current context
      const currentTag = getCurrentTag(projectRoot);
      displayCurrentTagIndicator(currentTag);

      const task = getNextTask(projectRoot);

      if (!task) {
        console.log(
          boxen(
            chalk.yellow('No eligible tasks found!') + '\n\n' +
            'All pending tasks have unsatisfied dependencies, or all tasks are completed.',
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'yellow',
              borderStyle: 'round',
            }
          )
        );
        return;
      }

      // Build task header box
      console.log(
        boxen(
          chalk.white.bold(`Next Task: #${task.id} - ${task.title}`),
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderColor: 'blue',
            borderStyle: 'round',
          }
        )
      );

      // Task details table
      const priorityColors = {
        high: chalk.red.bold,
        medium: chalk.yellow,
        low: chalk.gray,
      };
      const priorityColor = priorityColors[task.priority || 'medium'] || chalk.white;

      const allTasks = getAllTasks(projectRoot);
      const depsFormatted = (task.dependencies?.length > 0)
        ? task.dependencies.map(depId => {
            const depTask = allTasks.find(t => t.id === depId);
            if (depTask) {
              return depTask.status === 'done' ? chalk.green(depId) : chalk.yellow(depId);
            }
            return chalk.red(`${depId} (not found)`);
          }).join(', ')
        : chalk.gray('None');

      const detailsTable = new Table({
        style: { head: [], border: [], compact: true },
        chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
        colWidths: [15, Math.min(75, process.stdout.columns - 20 || 60)],
        wordWrap: true,
      });

      detailsTable.push(
        [chalk.cyan.bold('ID:'), task.id.toString()],
        [chalk.cyan.bold('Title:'), task.title],
        [chalk.cyan.bold('Priority:'), priorityColor(task.priority || 'medium')],
        [chalk.cyan.bold('Dependencies:'), depsFormatted],
        [chalk.cyan.bold('Complexity:'), task.complexityScore ? getAssessmentWithColor(task.complexityScore) : chalk.gray('N/A')],
        [chalk.cyan.bold('Description:'), task.description || chalk.gray('No description')],
      );

      console.log(detailsTable.toString());

      // Implementation details box
      if (task.details && task.details.trim().length > 0) {
        console.log(
          boxen(
            chalk.white.bold('Implementation Details:') + '\n\n' + task.details,
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'cyan',
              borderStyle: 'round',
              margin: { top: 1, bottom: 0 },
            }
          )
        );
      }

      // Display steps/subtasks
      const steps = task.steps || task.subtasks || [];
      if (steps.length > 0) {
        console.log(
          boxen(
            chalk.white.bold('Steps'),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              margin: { top: 1, bottom: 0 },
              borderColor: 'magenta',
              borderStyle: 'round',
            }
          )
        );

        const stepsTable = new Table({
          head: [
            chalk.magenta.bold('ID'),
            chalk.magenta.bold('Status'),
            chalk.magenta.bold('Title'),
            chalk.magenta.bold('Deps'),
          ],
          colWidths: [10, 16, 50, 15],
          style: { head: [], border: [], compact: true },
          wordWrap: true,
        });

        steps.forEach(step => {
          const stepDeps = step.dependencies?.length > 0 
            ? step.dependencies.map(d => {
                const targetStep = steps.find(s => s.id === d);
                if (targetStep) {
                  return targetStep.status === 'done' ? chalk.green(`${task.id}.${d}`) : chalk.yellow(`${task.id}.${d}`);
                }
                return chalk.red(`${task.id}.${d}`);
              }).join(', ')
            : chalk.gray('None');

          stepsTable.push([
            `${task.id}.${step.id}`,
            getStatusWithColor(step.status),
            step.title,
            stepDeps,
          ]);
        });

        console.log(stepsTable.toString());
      } else {
        // Suggest expanding if no steps
        console.log(
          boxen(
            chalk.yellow('No steps found. Consider breaking down this task:') + '\n' +
            chalk.white(`Run: ${chalk.cyan(`taskmaster breakdown --id=${task.id}`)}`),
            {
              padding: { top: 0, bottom: 0, left: 1, right: 1 },
              borderColor: 'yellow',
              borderStyle: 'round',
              margin: { top: 1, bottom: 0 },
            }
          )
        );
      }

      // Suggested actions
      const suggestedActions = [
        `Mark as in-progress: ${chalk.yellow(`taskmaster set-status --id ${task.id} --status in-progress`)}`,
        `Mark as done when completed: ${chalk.yellow(`taskmaster set-status --id ${task.id} --status done`)}`,
      ];
      
      if (steps.length > 0) {
        suggestedActions.push(`Update step status: ${chalk.yellow(`taskmaster set-status --id ${task.id}.1 --status done`)}`);
      } else {
        suggestedActions.push(`Break down into steps: ${chalk.yellow(`taskmaster breakdown --id=${task.id}`)}`);
      }

      console.log(
        boxen(
          chalk.white.bold('Suggested Actions:') + '\n' +
          suggestedActions.map((action, i) => `${chalk.cyan(i + 1 + '.')} ${action}`).join('\n'),
          {
            padding: { top: 0, bottom: 0, left: 1, right: 1 },
            borderColor: 'green',
            borderStyle: 'round',
            margin: { top: 1 },
          }
        )
      );
    });
  program
    .command('set-status')
    .description('Update task status')
    .option('-i, --id <id>', 'Task ID (required)')
    .option('-s, --status <status>', 'New status (required)')
    .action(async (options) => {
      if (!options.id || !options.status) {
        console.error(chalk.red('Error: Both --id and --status are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const validStatuses = ['pending', 'in-progress', 'done', 'blocked', 'cancelled', 'deferred'];
      if (!validStatuses.includes(options.status)) {
        console.error(chalk.red(`Error: Invalid status. Use one of: ${validStatuses.join(', ')}`));
        process.exit(1);
      }

      // Handle multiple IDs
      const ids = options.id.split(',').map(id => id.trim());
      
      for (const id of ids) {
        const result = setTaskStatus(id, options.status, projectRoot);
        if (result) {
          console.log(chalk.green(`✓ Task ${id} status set to ${options.status}`));
        } else {
          console.log(chalk.red(`✗ Task ${id} not found`));
        }
      }
    });

  // Expand task command (alias: breakdown)
  program
    .command('expand')
    .alias('breakdown')
    .description('Expand a task into subtasks using AI')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-n, --num <number>', 'Number of subtasks to generate', '5')
    .option('-p, --prompt <text>', 'Additional context for expansion')
    .option('--force', 'Replace existing subtasks')
    .option('-r, --research', 'Use research model')
    .option('--all', 'Expand all pending tasks')
    .option('-v, --verbose', 'Show detailed progress and model info')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const ora = (await import('ora')).default;

      if (options.all) {
        // Expand all pending tasks without subtasks
        const tasks = getAllTasks(projectRoot);
        const toExpand = tasks.filter(t => 
          t.status === 'pending' && (!t.subtasks || t.subtasks.length === 0 || options.force)
        );
        const totalSubtasks = toExpand.length * (parseInt(options.num) || 5);
        try {
          enforceUsageLimit(totalSubtasks);
        } catch (limitError) {
          console.log('');
          console.log(
            boxen(
              chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
              chalk.white(limitError.message) + '\n\n' +
              chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
              { padding: 1, borderColor: 'red', borderStyle: 'round' }
            )
          );
          process.exit(1);
        }

        console.log('');
        console.log(chalk.cyan(`Expanding ${toExpand.length} tasks...`));

        for (const task of toExpand) {
          const spinner = ora(`Expanding task ${task.id}...`).start();
          try {
            const subtasks = await aiExpandTask(task, {
              numSubtasks: parseInt(options.num) || 5,
              research: options.research,
              prompt: options.prompt,
            });
            addSubtasks(task.id, subtasks, options.force, projectRoot);
            await incrementUsage('tasksExpanded', subtasks.length);
            spinner.succeed(`Task ${task.id}: Added ${subtasks.length} subtasks`);
          } catch (error) {
            spinner.fail(`Task ${task.id}: ${error.message}`);
          }
        }
        console.log('');
        return;
      }

      if (!options.id) {
        console.error(chalk.red('Error: --id is required (or use --all)'));
        process.exit(1);
      }

      const task = findTaskById(options.id, projectRoot);
      if (!task) {
        console.error(chalk.red(`Task ${options.id} not found.`));
        process.exit(1);
      }
      const numSubtasks = parseInt(options.num) || 5;
      try {
        enforceUsageLimit(numSubtasks);
      } catch (limitError) {
        console.log('');
        console.log(
          boxen(
            chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
            chalk.white(limitError.message) + '\n\n' +
            chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      const spinner = ora('Generating subtasks with AI...').start();

      try {
        const subtasks = await aiExpandTask(task, {
          numSubtasks,
          research: options.research,
          prompt: options.prompt,
        });

        addSubtasks(options.id, subtasks, options.force, projectRoot);
        await incrementUsage('tasksExpanded', subtasks.length);
        spinner.stop();

        console.log(chalk.green(`✓ Added ${subtasks.length} subtasks to task ${options.id}`));
        console.log('');
        subtasks.forEach((s, i) => {
          console.log(chalk.gray(`  [${options.id}.${i + 1}]`) + ' ' + s.title);
        });
        console.log('');
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
  program
    .command('add-task')
    .alias('new')
    .description('Add a new task')
    .option('-p, --prompt <text>', 'Task description (required)')
    .option('-d, --dependencies <ids>', 'Comma-separated dependency IDs')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .option('-r, --research', 'Use research model')
    .option('-v, --verbose', 'Show detailed progress and model info')
    .action(async (options) => {
      if (!options.prompt) {
        console.error(chalk.red('Error: --prompt is required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project. Run "taskmaster init" first.'));
        process.exit(1);
      }
      try {
        enforceUsageLimit(1);
      } catch (limitError) {
        console.log('');
        console.log(
          boxen(
            chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
            chalk.white(limitError.message) + '\n\n' +
            chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      const ora = (await import('ora')).default;
      const spinner = ora('Creating task with AI...').start();

      try {
        const dependencies = options.dependencies 
          ? options.dependencies.split(',').map(id => parseInt(id.trim()))
          : [];

        const taskData = await generateTask(options.prompt, {
          priority: options.priority,
          dependencies,
          research: options.research,
        });

        const newTask = addTask(taskData, projectRoot);
        await incrementUsage('tasksAdded', 1);
        spinner.stop();

        console.log(chalk.green(`✓ Created task ${newTask.id}: ${newTask.title}`));
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Analyze complexity command (alias: assess)
  program
    .command('analyze-complexity')
    .alias('assess')
    .description('Analyze task complexity')
    .option('-r, --research', 'Use research model')
    .option('-v, --verbose', 'Show detailed progress and model info')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const tasks = getAllTasks(projectRoot);
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks to analyze.'));
        return;
      }
      try {
        enforceUsageLimit(1);
      } catch (limitError) {
        console.log('');
        console.log(
          boxen(
            chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
            chalk.white(limitError.message) + '\n\n' +
            chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      const ora = (await import('ora')).default;
      const spinner = ora('Analyzing task complexity...').start();

      try {
        const analysis = await analyzeComplexity(tasks, {
          research: options.research,
        });
        
        await incrementUsage('complexityAnalyses', 1);
        spinner.stop();

        console.log('');
        console.log(chalk.cyan.bold('Complexity Analysis:'));
        console.log('');

        analysis.forEach(item => {
          const task = tasks.find(t => t.id === item.taskId);
          const complexityColor = item.complexity >= 7 ? chalk.red : 
                                  item.complexity >= 4 ? chalk.yellow : chalk.green;
          
          console.log(
            chalk.gray(`[${item.taskId}]`) + ' ' +
            complexityColor(`[${item.complexity}/10]`) + ' ' +
            chalk.white(task?.title || 'Unknown') + ' ' +
            chalk.dim(`(${item.recommendedSubtasks} subtasks)`)
          );
        });

        console.log('');

        const reportPath = path.join(projectRoot, '.taskmaster-ai', 'reports', 'complexity-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
          generatedAt: new Date().toISOString(),
          analysis,
        }, null, 2));

        console.log(chalk.dim(`Report saved to: ${reportPath}`));
        console.log('');
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
  program
    .command('add-dependency')
    .alias('link')
    .description('Add a dependency to a task')
    .option('-i, --id <id>', 'Task ID')
    .option('-d, --depends-on <id>', 'Dependency task ID')
    .action(async (options) => {
      if (!options.id || !options.dependsOn) {
        console.error(chalk.red('Error: Both --id and --depends-on are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const result = addDependency(options.id, options.dependsOn, projectRoot);
        if (result) {
          console.log(chalk.green(`✓ Task ${options.id} now depends on task ${options.dependsOn}`));
        } else {
          console.error(chalk.red('Task(s) not found.'));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Remove dependency command (alias: unlink)
  program
    .command('remove-dependency')
    .alias('unlink')
    .description('Remove a dependency from a task')
    .option('-i, --id <id>', 'Task ID')
    .option('-d, --depends-on <id>', 'Dependency task ID to remove')
    .action(async (options) => {
      if (!options.id || !options.dependsOn) {
        console.error(chalk.red('Error: Both --id and --depends-on are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const result = removeDependency(options.id, options.dependsOn, projectRoot);
      if (result) {
        console.log(chalk.green(`✓ Removed dependency on task ${options.dependsOn} from task ${options.id}`));
      } else {
        console.error(chalk.red('Task not found.'));
      }
    });
  program
    .command('update-subtask')
    .alias('log')
    .description('Append timestamped notes to a subtask')
    .option('-i, --id <id>', 'Subtask ID (e.g., 1.2)')
    .option('-p, --prompt <text>', 'Notes to append')
    .option('-r, --research', 'Use research model')
    .action(async (options) => {
      if (!options.id || !options.prompt) {
        console.error(chalk.red('Error: Both --id and --prompt are required'));
        process.exit(1);
      }

      if (!options.id.includes('.')) {
        console.error(chalk.red('Error: --id must be a subtask ID (e.g., 1.2)'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const [parentId, subtaskId] = options.id.split('.').map(Number);
      const tasks = getAllTasks(projectRoot);
      const parentTask = tasks.find(t => t.id === parentId);

      if (!parentTask) {
        console.error(chalk.red(`Parent task ${parentId} not found.`));
        process.exit(1);
      }

      if (!parentTask.subtasks) {
        console.error(chalk.red(`Task ${parentId} has no subtasks.`));
        process.exit(1);
      }

      const subtask = parentTask.subtasks.find(s => s.id === subtaskId);
      if (!subtask) {
        console.error(chalk.red(`Subtask ${options.id} not found.`));
        process.exit(1);
      }

      // Append timestamped note ( version)
      const timestamp = new Date().toISOString();
      const newNote = `\n\n--- Update [${timestamp}] ---\n${options.prompt}`;
      
      subtask.details = (subtask.details || '') + newNote;
      
      saveAllTasks(tasks, projectRoot);

      console.log(chalk.green(`✓ Appended note to subtask ${options.id}`));
      console.log(chalk.dim(`  Timestamp: ${timestamp}`));
    });
  program
    .command('update-task')
    .alias('edit')
    .description('Update a task with new information')
    .option('-i, --id <id>', 'Task ID')
    .option('-p, --prompt <text>', 'Update information')
    .option('--append', 'Append to details instead of regenerating')
    .option('-r, --research', 'Use research model')
    .action(async (options) => {
      if (!options.id || !options.prompt) {
        console.error(chalk.red('Error: Both --id and --prompt are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const task = findTaskById(options.id, projectRoot);
      if (!task) {
        console.error(chalk.red(`Task ${options.id} not found.`));
        process.exit(1);
      }

      if (options.append) {
        // Append mode - add timestamped note like update-subtask
        const timestamp = new Date().toISOString();
        const newNote = `\n\n--- Update [${timestamp}] ---\n${options.prompt}`;
        
        const updatedTask = updateTask(options.id, {
          details: (task.details || '') + newNote
        }, projectRoot);

        if (updatedTask) {
          console.log(chalk.green(`✓ Appended note to task ${options.id}`));
        }
      } else {
        // Full update mode - would use AI to regenerate
        try {
          enforceUsageLimit(1);
        } catch (limitError) {
          console.log('');
          console.log(
            boxen(
              chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
              chalk.white(limitError.message) + '\n\n' +
              chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
              { padding: 1, borderColor: 'red', borderStyle: 'round' }
            )
          );
          process.exit(1);
        }

        const ora = (await import('ora')).default;
        const spinner = ora('Updating task with AI...').start();

        try {
          const { generateAIText } = await import('../lib/ai.js');
          
          const prompt = `Update the following task based on new information:

Current Task:
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'None'}

New Information:
${options.prompt}

Provide updated details that incorporate the new information.`;

          const result = await generateAIText(prompt, {
            role: options.research ? 'research' : 'main',
          });

          updateTask(options.id, {
            details: result.text.trim()
          }, projectRoot);
          
          await incrementUsage('tasksAdded', 1); // Count as AI operation

          spinner.stop();
          console.log(chalk.green(`✓ Task ${options.id} updated`));
        } catch (error) {
          spinner.stop();
          console.error(chalk.red('Error:'), error.message);
          process.exit(1);
        }
      }
    });

  // Clear subtasks command (alias: clear-steps)
  program
    .command('clear-subtasks')
    .alias('clear-steps')
    .description('Remove all subtasks from a task')
    .option('-i, --id <id>', 'Task ID')
    .option('--all', 'Clear subtasks from all tasks')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      if (options.all) {
        const tasks = getAllTasks(projectRoot);
        let cleared = 0;
        tasks.forEach(task => {
          if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks = [];
            cleared++;
          }
        });
        saveAllTasks(tasks, projectRoot);
        console.log(chalk.green(`✓ Cleared subtasks from ${cleared} tasks`));
      } else if (options.id) {
        const result = clearSubtasks(options.id, projectRoot);
        if (result) {
          console.log(chalk.green(`✓ Cleared subtasks from task ${options.id}`));
        } else {
          console.error(chalk.red(`Task ${options.id} not found.`));
        }
      } else {
        console.error(chalk.red('Error: Provide --id or use --all'));
        process.exit(1);
      }
    });

  // Remove task command
  program
    .command('remove-task')
    .description('Remove a task or subtask')
    .option('-i, --id <id>', 'Task or subtask ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
      if (!options.id) {
        console.error(chalk.red('Error: --id is required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const task = findTaskById(options.id, projectRoot);
      if (!task) {
        console.error(chalk.red(`Task ${options.id} not found.`));
        process.exit(1);
      }

      if (!options.yes) {
        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete task "${task.title}"?`,
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      const result = deleteTask(options.id, projectRoot);
      if (result) {
        console.log(chalk.green(`✓ Task ${options.id} removed`));
      } else {
        console.error(chalk.red('Failed to remove task.'));
      }
    });

  // Usage command
  program
    .command('usage')
    .description('View your current usage and plan limits')
    .action(async () => {
      const summary = getUsageSummary();
      
      console.log('');
      console.log(chalk.cyan.bold('📊 Usage Summary'));
      console.log('');
      
      const planDisplay = summary.plan === 'None' 
        ? chalk.red('No plan activated')
        : chalk.green(summary.plan);
      
      console.log(chalk.white.bold('Plan: ') + planDisplay);
      console.log('');
      
      // Usage bar
      const barWidth = 30;
      const filled = summary.limit === 'Unlimited' 
        ? 0 
        : Math.round((summary.used / summary.limit) * barWidth);
      const empty = barWidth - filled;
      
      const barColor = summary.percentage >= 90 ? chalk.red : 
                       summary.percentage >= 70 ? chalk.yellow : chalk.green;
      
      const bar = barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
      
      console.log(chalk.white.bold('AI Operations This Month:'));
      console.log(`  [${bar}]`);
      console.log(`  ${chalk.cyan(summary.used)} / ${chalk.white(summary.limit)} ${summary.limit !== 'Unlimited' ? `(${summary.percentage}%)` : ''}`);
      console.log('');
      
      console.log(chalk.white.bold('Breakdown:'));
      console.log(`  Tasks from PRD: ${chalk.cyan(summary.breakdown.tasksParsed)}`);
      console.log(`  Tasks expanded: ${chalk.cyan(summary.breakdown.tasksExpanded)}`);
      console.log(`  Tasks added: ${chalk.cyan(summary.breakdown.tasksAdded)}`);
      console.log(`  Complexity analyses: ${chalk.cyan(summary.breakdown.complexityAnalyses)}`);
      console.log('');
      
      if (summary.plan === 'None') {
        console.log(chalk.red.bold('⚠️  No license activated.'));
        console.log(chalk.dim('   Get started at: ') + chalk.cyan('https://www.taskmaster.one/pricing'));
      } else if (summary.limit !== 'Unlimited') {
        const remaining = summary.remaining;
        if (remaining <= 0) {
          console.log(chalk.red.bold('⚠️  You have reached your monthly limit.'));
          console.log(chalk.dim('   Upgrade at: ') + chalk.cyan('https://www.taskmaster.one/pricing'));
        } else if (remaining <= 50) {
          console.log(chalk.yellow(`⚠️  Only ${remaining} operations remaining this month.`));
          console.log(chalk.dim('   Upgrade at: ') + chalk.cyan('https://www.taskmaster.one/pricing'));
        }
      }
      console.log('');
      const cachedConfig = readCachedConfig();
      if (cachedConfig) {
        console.log(chalk.white.bold('Dashboard Config Sync:'));
        const apiKeyCount = Object.keys(cachedConfig.apiKeys || {}).length;
        const hasModels = !!cachedConfig.models;
        const syncedAt = cachedConfig.syncedAt ? new Date(cachedConfig.syncedAt).toLocaleString() : 'Never';
        
        console.log(`  API Keys: ${chalk.cyan(apiKeyCount + ' provider(s)')} synced from dashboard`);
        console.log(`  Models: ${chalk.cyan(hasModels ? 'Custom config' : 'Using defaults')}`);
        console.log(`  Last sync: ${chalk.dim(syncedAt)}`);
        
        if (apiKeyCount > 0) {
          console.log('');
          console.log(chalk.dim('  Configured providers:'));
          for (const provider of Object.keys(cachedConfig.apiKeys)) {
            console.log(chalk.dim('    • ') + chalk.cyan(provider));
          }
        }
        console.log('');
        console.log(chalk.dim('  Tip: Run ') + chalk.cyan('taskmaster sync-keys') + chalk.dim(' to refresh config from dashboard'));
        console.log('');
      } else {
        console.log(chalk.dim('No dashboard config synced. Run ') + chalk.cyan('taskmaster sync-keys') + chalk.dim(' after adding API keys in the dashboard.'));
        console.log('');
      }
    });

  // Models command
  program
    .command('models')
    .description('View or configure AI models')
    .option('--set-main <model>', 'Set main model')
    .option('--set-research <model>', 'Set research model')
    .option('--set-fallback <model>', 'Set fallback model')
    .option('--list', 'List all available models')
    .option('--list-provider <provider>', 'List models for specific provider')
    .option('--setup', 'Run interactive setup')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      // List models option
      if (options.list || options.listProvider) {
        const supportedModelsPath = path.join(findProjectRoot() || process.cwd(), 'node_modules', '@taskmasterai', 'cli', 'src', 'modules', 'supported-models.json');
        let supportedModels;
        
        try {
          // Try to load from installed package
          supportedModels = JSON.parse(fs.readFileSync(supportedModelsPath, 'utf-8'));
        } catch (err) {
          // Fallback to local development path
          const localPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'modules', 'supported-models.json');
          try {
            supportedModels = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
          } catch (err2) {
            console.error(chalk.red('Error: Could not load supported models list'));
            process.exit(1);
          }
        }

        console.log('');
        console.log(chalk.cyan.bold('Available AI Models'));
        console.log('');

        const providersToShow = options.listProvider 
          ? [options.listProvider.toLowerCase()]
          : Object.keys(supportedModels);

        for (const provider of providersToShow) {
          const models = supportedModels[provider];
          if (!models) {
            console.error(chalk.red(`Unknown provider: ${provider}`));
            continue;
          }

          console.log(chalk.white.bold(`${provider.charAt(0).toUpperCase() + provider.slice(1)}:`));
          models.forEach(model => {
            const rolesBadge = model.allowed_roles.map(r => {
              if (r === 'main') return chalk.blue('M');
              if (r === 'research') return chalk.yellow('R');
              if (r === 'fallback') return chalk.green('F');
              return r;
            }).join('');
            console.log(`  ${chalk.gray(model.id.padEnd(40))} ${rolesBadge}  ${chalk.dim(model.description)}`);
          });
          console.log('');
        }

        console.log(chalk.dim('Legend: ') + chalk.blue('M') + chalk.dim('=Main ') + chalk.yellow('R') + chalk.dim('=Research ') + chalk.green('F') + chalk.dim('=Fallback'));
        console.log('');
        console.log(chalk.dim('Set model: ') + chalk.cyan('taskmaster models --set-main <model-id>'));
        console.log('');
        return;
      }

      const config = readProjectConfig(projectRoot);

      // Helper function to detect provider from model ID
      const detectProvider = (modelId) => {
        // Try multiple paths to find supported-models.json
        const possiblePaths = [
          path.join(__dirname, '..', 'modules', 'supported-models.json'),
          path.join(findProjectRoot() || process.cwd(), 'node_modules', '@taskmasterai', 'cli', 'src', 'modules', 'supported-models.json'),
          path.join(findProjectRoot() || process.cwd(), 'node_modules', 'taskmaster-ai-cli', 'src', 'modules', 'supported-models.json'),
        ];
        
        let supportedModels;
        
        for (const modelPath of possiblePaths) {
          try {
            if (fs.existsSync(modelPath)) {
              supportedModels = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        if (!supportedModels) {
          return null;
        }

        for (const [provider, models] of Object.entries(supportedModels)) {
          if (models.some(m => m.id === modelId)) {
            return provider;
          }
        }
        return null;
      };

      if (options.setMain || options.setResearch || options.setFallback) {
        if (options.setMain) {
          const provider = detectProvider(options.setMain);
          if (provider) {
            config.models.main.provider = provider;
            config.models.main.modelId = options.setMain;
          } else {
            console.log(chalk.yellow(`⚠ Warning: Model '${options.setMain}' not found in supported list`));
            config.models.main.modelId = options.setMain;
          }
        }
        if (options.setResearch) {
          const provider = detectProvider(options.setResearch);
          if (provider) {
            config.models.research.provider = provider;
            config.models.research.modelId = options.setResearch;
          } else {
            console.log(chalk.yellow(`⚠ Warning: Model '${options.setResearch}' not found in supported list`));
            config.models.research.modelId = options.setResearch;
          }
        }
        if (options.setFallback) {
          const provider = detectProvider(options.setFallback);
          if (provider) {
            config.models.fallback.provider = provider;
            config.models.fallback.modelId = options.setFallback;
          } else {
            console.log(chalk.yellow(`⚠ Warning: Model '${options.setFallback}' not found in supported list`));
            config.models.fallback.modelId = options.setFallback;
          }
        }
        writeProjectConfig(config, projectRoot);
        console.log(chalk.green('✓ Model configuration updated'));
        return;
      }
      const cachedConfig = readCachedConfig();
      const hasModelSync = cachedConfig?.models;
      console.log('');
      console.log(chalk.cyan.bold('AI Model Configuration:'));
      if (hasModelSync) {
        console.log(chalk.dim('  (Synced from dashboard)'));
      }
      console.log('');
      console.log(chalk.white.bold('Main Model:'));
      console.log(`  Provider: ${config.models.main.provider}`);
      console.log(`  Model: ${config.models.main.modelId}`);
      console.log('');
      console.log(chalk.white.bold('Research Model:'));
      console.log(`  Provider: ${config.models.research.provider}`);
      console.log(`  Model: ${config.models.research.modelId}`);
      console.log('');
      console.log(chalk.white.bold('Fallback Model:'));
      console.log(`  Provider: ${config.models.fallback.provider}`);
      console.log(`  Model: ${config.models.fallback.modelId}`);
      console.log('');
      console.log(chalk.cyan.bold('API Key Status:'));
      const syncedApiKeys = cachedConfig?.apiKeys || {};
      const providers = ['anthropic', 'openai', 'google', 'perplexity', 'mistral', 'xai', 'openrouter'];
      providers.forEach(provider => {
        const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
        const syncedKey = syncedApiKeys[provider];
        
        if (envKey) {
          console.log(`  ${provider}: ${chalk.green('✓ Set')} ${chalk.dim('(from env)')}`);
        } else if (syncedKey) {
          console.log(`  ${provider}: ${chalk.green('✓ Set')} ${chalk.cyan('(from dashboard)')}`);
        } else {
          console.log(`  ${provider}: ${chalk.red('✗ Not set')}`);
        }
      });
      console.log('');
      console.log(chalk.dim('  Tip: Configure API keys in the dashboard at ') + chalk.cyan('https://www.taskmaster.one/app/api-keys'));
      console.log('');
    });

  // List tags command (alias: contexts)
  program
    .command('tags')
    .alias('contexts')
    .description('List all tags')
    .option('--show-metadata', 'Show detailed metadata')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const tags = getAllTags(projectRoot);
      
      console.log('');
      console.log(chalk.cyan.bold('Tags:'));
      console.log('');

      const table = new Table({
        head: [
          chalk.cyan('Name'),
          chalk.cyan('Tasks'),
          chalk.cyan('Done'),
          chalk.cyan('%'),
          chalk.cyan('Current'),
        ],
        colWidths: [20, 8, 8, 8, 10],
      });

      tags.forEach(tag => {
        table.push([
          tag.name,
          tag.taskCount,
          tag.completedCount,
          `${tag.percentage}%`,
          tag.isCurrent ? chalk.green('✓') : '',
        ]);
      });

      console.log(table.toString());
      console.log('');

      if (options.showMetadata) {
        console.log(chalk.cyan.bold('Metadata:'));
        tags.forEach(tag => {
          console.log(`  ${chalk.white.bold(tag.name)}:`);
          if (tag.metadata.description) {
            console.log(`    Description: ${tag.metadata.description}`);
          }
          if (tag.metadata.createdAt) {
            console.log(`    Created: ${new Date(tag.metadata.createdAt).toLocaleString()}`);
          }
        });
        console.log('');
      }
    });
  program
    .command('add-tag')
    .alias('context-add')
    .description('Create a new tag')
    .argument('<name>', 'Tag name')
    .option('--from-branch', 'Create tag from current git branch name')
    .option('--copy-from-current', 'Copy tasks from current tag')
    .option('--copy-from <tag>', 'Copy tasks from specified tag')
    .option('-d, --description <text>', 'Tag description')
    .action(async (name, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      let tagName = name;

      // Handle --from-branch
      if (options.fromBranch) {
        try {
          const { execSync } = await import('child_process');
          const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
          tagName = branch.replace(/\//g, '-');
        } catch (error) {
          console.error(chalk.red('Error: Could not get git branch name'));
          process.exit(1);
        }
      }

      try {
        createTag(tagName, {
          copyFrom: options.copyFrom,
          copyFromCurrent: options.copyFromCurrent,
          description: options.description,
        }, projectRoot);

        console.log(chalk.green(`✓ Created tag '${tagName}'`));
        
        if (options.copyFrom || options.copyFromCurrent) {
          console.log(chalk.dim('  Tasks copied from source tag'));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
  program
    .command('use-tag')
    .alias('context')
    .description('Switch to a different tag')
    .argument('<name>', 'Tag name')
    .action(async (name) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        switchTag(name, projectRoot);
        console.log(chalk.green(`✓ Switched to tag '${name}'`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('delete-tag')
    .alias('delete-context')
    .description('Delete a tag')
    .argument('<name>', 'Tag name')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (name, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      if (!options.yes) {
        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete tag '${name}' and all its tasks?`,
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      try {
        deleteTagData(name, projectRoot);
        console.log(chalk.green(`✓ Deleted tag '${name}'`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Rename tag command (alias: rename-context)
  program
    .command('rename-tag')
    .alias('rename-context')
    .description('Rename a tag')
    .argument('<oldName>', 'Current tag name')
    .argument('<newName>', 'New tag name')
    .action(async (oldName, newName) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        renameTag(oldName, newName, projectRoot);
        console.log(chalk.green(`✓ Renamed tag '${oldName}' to '${newName}'`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Copy tag command (alias: clone)
  program
    .command('copy-tag')
    .alias('clone')
    .description('Copy a tag with all its tasks')
    .argument('<source>', 'Source tag name')
    .argument('<target>', 'Target tag name')
    .option('-d, --description <text>', 'Description for new tag')
    .action(async (source, target, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        copyTag(source, target, { description: options.description }, projectRoot);
        console.log(chalk.green(`✓ Copied tag '${source}' to '${target}'`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('validate-dependencies')
    .alias('check-links')
    .description('Validate all task dependencies')
    .action(async () => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const issues = validateDependencies(projectRoot);

      console.log('');
      if (issues.length === 0) {
        console.log(chalk.green('✓ All dependencies are valid'));
      } else {
        console.log(chalk.red(`Found ${issues.length} dependency issue(s):`));
        console.log('');
        issues.forEach(issue => {
          const icon = issue.type === 'missing' ? '❌' : '🔄';
          console.log(`  ${icon} ${issue.message}`);
        });
        console.log('');
        console.log(chalk.dim('Run ') + chalk.cyan('taskmaster fix-dependencies') + chalk.dim(' to fix these issues'));
      }
      console.log('');
    });

  // Fix dependencies command (alias: fix-links)
  program
    .command('fix-dependencies')
    .alias('fix-links')
    .description('Automatically fix dependency issues')
    .action(async () => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const result = fixDependencies(projectRoot);

      console.log('');
      if (result.fixedCount === 0) {
        console.log(chalk.green('✓ No dependency issues to fix'));
      } else {
        console.log(chalk.green(`✓ Fixed dependencies in ${result.fixedCount} task(s)`));
      }
      console.log('');
    });

  // Move task command
  program
    .command('move')
    .description('Move a task or subtask to a new position')
    .option('--from <id>', 'Source task/subtask ID')
    .option('--to <id>', 'Destination task/subtask ID')
    .action(async (options) => {
      if (!options.from || !options.to) {
        console.error(chalk.red('Error: Both --from and --to are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        moveTask(options.from, options.to, projectRoot);
        console.log(chalk.green(`✓ Moved task ${options.from} to ${options.to}`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });
  program
    .command('add-subtask')
    .alias('add-step')
    .description('Add a subtask to a parent task')
    .option('-p, --parent <id>', 'Parent task ID')
    .option('-t, --title <text>', 'Subtask title')
    .option('-d, --description <text>', 'Subtask description')
    .option('--details <text>', 'Implementation details')
    .option('--dependencies <ids>', 'Comma-separated dependency IDs')
    .option('-s, --status <status>', 'Initial status', 'pending')
    .action(async (options) => {
      if (!options.parent || !options.title) {
        console.error(chalk.red('Error: Both --parent and --title are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const dependencies = options.dependencies
          ? options.dependencies.split(',').map(id => id.trim())
          : [];

        const result = addSingleSubtask(options.parent, {
          title: options.title,
          description: options.description || '',
          details: options.details || '',
          dependencies,
          status: options.status,
        }, projectRoot);

        console.log(chalk.green(`✓ Added subtask ${options.parent}.${result.subtask.id}: ${result.subtask.title}`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Generate task files command
  program
    .command('generate')
    .description('Generate individual task markdown files')
    .option('-o, --output <dir>', 'Output directory')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const files = generateTaskFiles(projectRoot, options.output);
        console.log(chalk.green(`✓ Generated ${files.length} task file(s)`));
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Complexity report command (alias: report)
  program
    .command('complexity-report')
    .alias('report')
    .description('Display the task complexity analysis report')
    .option('-f, --file <path>', 'Path to complexity report')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const possiblePaths = [
        options.file,
        path.join(projectRoot, '.taskmaster-ai', 'reports', 'complexity-report.json'),
        path.join(os.homedir(), '.taskmaster-ai', 'reports', 'complexity-report.json'),
      ].filter(Boolean);

      let reportPath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          reportPath = p;
          break;
        }
      }

      if (!reportPath) {
        console.log(chalk.yellow('No complexity report found.'));
        console.log(chalk.dim('Checked:'));
        possiblePaths.forEach(p => console.log(chalk.dim(`  - ${p}`)));
        console.log('');
        console.log(chalk.dim('Run ') + chalk.cyan('taskmaster assess') + chalk.dim(' first'));
        return;
      }

      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        const tasks = getAllTasks(projectRoot);

        console.log('');
        console.log(chalk.cyan.bold('Complexity Analysis Report'));
        console.log(chalk.dim(`Generated: ${new Date(report.generatedAt).toLocaleString()}`));
        console.log('');

        const table = new Table({
          head: [
            chalk.cyan('ID'),
            chalk.cyan('Complexity'),
            chalk.cyan('Title'),
            chalk.cyan('Recommended'),
          ],
          colWidths: [6, 12, 45, 14],
        });

        report.analysis.forEach(item => {
          const task = tasks.find(t => t.id === item.taskId);
          const complexityColor = item.complexity >= 7 ? chalk.red : 
                                  item.complexity >= 4 ? chalk.yellow : chalk.green;
          
          table.push([
            item.taskId,
            complexityColor(`${item.complexity}/10`),
            truncateText(task?.title || 'Unknown', 43),
            `${item.recommendedSubtasks} subtasks`,
          ]);
        });

        console.log(table.toString());
        console.log('');
      } catch (error) {
        console.error(chalk.red('Error reading report:'), error.message);
        process.exit(1);
      }
    });

  // Research command (alias: ask)
  program
    .command('research')
    .alias('ask')
    .description('Perform AI-powered research')
    .argument('[query]', 'Research query')
    .option('-q, --query <text>', 'Research query (alternative)')
    .option('--save-to <id>', 'Save results to task/subtask')
    .option('--tree', 'Include project tree in context')
    .option('--files <paths>', 'Include specific files in context')
    .option('--detail <level>', 'Detail level: low, medium, high', 'medium')
    .action(async (queryArg, options) => {
      const query = queryArg || options.query;
      
      if (!query) {
        console.error(chalk.red('Error: Research query is required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }
      try {
        enforceUsageLimit(1);
      } catch (limitError) {
        console.log('');
        console.log(
          boxen(
            chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
            chalk.white(limitError.message) + '\n\n' +
            chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      const ora = (await import('ora')).default;
      const spinner = ora('Researching...').start();

      try {
        const result = await performResearch(query, {
          detailLevel: options.detail,
        });

        await incrementUsage('tasksAdded', 1); // Count as AI operation
        spinner.stop();

        console.log('');
        console.log(chalk.cyan.bold('Research Results:'));
        console.log(chalk.dim(`Model: ${result.provider}/${result.model}`));
        console.log('');
        console.log(result.text);
        console.log('');
        if (options.saveTo) {
          const timestamp = new Date().toISOString();
          const note = `\n\n--- Research [${timestamp}] ---\nQuery: ${query}\n\n${result.text}`;
          
          updateTask(options.saveTo, {
            details: (findTaskById(options.saveTo, projectRoot)?.details || '') + note
          }, projectRoot);
          
          console.log(chalk.green(`✓ Research saved to task ${options.saveTo}`));
        }
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Batch update command
  program
    .command('update')
    .description('Update multiple tasks from a specific ID')
    .option('--from <id>', 'Starting task ID (required)')
    .option('-p, --prompt <text>', 'Update context/changes (required)')
    .option('-r, --research', 'Use research model')
    .action(async (options) => {
      if (!options.from || !options.prompt) {
        console.error(chalk.red('Error: Both --from and --prompt are required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const tasks = getAllTasks(projectRoot);
      const fromId = parseInt(options.from);
      const tasksToUpdate = tasks.filter(t => t.id >= fromId && t.status !== 'done');

      if (tasksToUpdate.length === 0) {
        console.log(chalk.yellow('No tasks to update.'));
        return;
      }
      try {
        enforceUsageLimit(tasksToUpdate.length);
      } catch (limitError) {
        console.log('');
        console.log(
          boxen(
            chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
            chalk.white(limitError.message) + '\n\n' +
            chalk.dim('Upgrade your plan to continue using TaskMaster AI'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      const ora = (await import('ora')).default;
      const spinner = ora(`Updating ${tasksToUpdate.length} task(s)...`).start();

      try {
        const updates = await batchUpdateTasks(tasks, fromId, options.prompt, {
          research: options.research,
        });

        // Apply updates
        for (const update of updates) {
          updateTask(update.id, {
            title: update.title,
            description: update.description,
            details: update.details,
            testStrategy: update.testStrategy,
          }, projectRoot);
        }

        await incrementUsage('tasksAdded', updates.length);
        spinner.stop();

        console.log(chalk.green(`✓ Updated ${updates.length} task(s)`));
        console.log('');
        updates.forEach(u => {
          console.log(chalk.gray(`  [${u.id}]`) + ' ' + u.title);
        });
        console.log('');
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Autopilot parent command
  const autopilot = program
    .command('autopilot')
    .description('TDD workflow automation');

  // Autopilot start
  autopilot
    .command('start')
    .description('Start a TDD workflow for a task')
    .argument('<taskId>', 'Task ID to work on')
    .option('--max-attempts <number>', 'Maximum attempts per subtask', '3')
    .option('--force', 'Force start even if workflow exists')
    .option('--json', 'Output JSON')
    .action(async (taskId, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = await orchestrator.start(taskId, {
          maxAttempts: parseInt(options.maxAttempts),
          force: options.force,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.green(`✓ Workflow started for task ${taskId}`));
          console.log(chalk.green(`✓ Created branch: ${result.branchName}`));
          console.log(chalk.cyan(`✓ Current phase: ${result.tddPhase}`));
          console.log(chalk.white(`✓ Subtask 1/${result.progress.total}: ${result.currentSubtask?.title}`));
          console.log(chalk.dim(`→ Next action: Write a failing test`));
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot next
  autopilot
    .command('next')
    .description('Get the next action to perform')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = orchestrator.getNextAction();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.cyan.bold(`Phase: ${result.tddPhase}`));
          console.log(chalk.white.bold(`Action: ${result.action}`));
          console.log(chalk.dim(result.description));
          console.log('');
          if (result.currentSubtask) {
            console.log(chalk.white(`Subtask: ${result.currentSubtask.title}`));
          }
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot status
  autopilot
    .command('status')
    .description('Get current workflow status')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = orchestrator.getStatus();

        if (!result) {
          if (options.json) {
            console.log(JSON.stringify({ active: false }));
          } else {
            console.log(chalk.yellow('No active workflow'));
          }
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.cyan.bold('Workflow Status'));
          console.log('');
          console.log(chalk.white.bold('Task: ') + result.taskId);
          console.log(chalk.white.bold('Branch: ') + result.branchName);
          console.log(chalk.white.bold('Phase: ') + result.phase);
          console.log(chalk.white.bold('TDD Phase: ') + (result.tddPhase || 'N/A'));
          console.log('');
          console.log(chalk.white.bold('Progress: ') + 
            `${result.progress.completed}/${result.progress.total} (${result.progress.percentage}%)`);
          console.log('');
          if (result.currentSubtask) {
            console.log(chalk.white.bold('Current Subtask: ') + result.currentSubtask.title);
          }
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot resume
  autopilot
    .command('resume')
    .description('Resume an interrupted workflow')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = orchestrator.resume();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.green('✓ Workflow resumed'));
          console.log(chalk.white(`  Task ${result.taskId} - subtask ${result.progress.completed + 1}/${result.progress.total}`));
          console.log(chalk.cyan(`  Current phase: ${result.tddPhase}`));
          console.log(chalk.dim('  → Continue from where you left off'));
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot complete
  autopilot
    .command('complete')
    .description('Complete the current TDD phase')
    .option('--results <json>', 'Test results JSON')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      if (!options.results) {
        console.error(chalk.red('Error: --results is required'));
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const testResults = JSON.parse(options.results);
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = orchestrator.completePhase(testResults);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.green(`✓ Completed phase`));
          console.log(chalk.cyan(`  Current phase: ${result.tddPhase}`));
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot commit
  autopilot
    .command('commit')
    .description('Commit changes and advance to next subtask')
    .option('--message <text>', 'Custom commit message')
    .option('--files <paths>', 'Specific files to stage')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const files = options.files ? options.files.split(',').map(f => f.trim()) : undefined;
        const result = await orchestrator.commit({
          customMessage: options.message,
          files,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('');
          console.log(chalk.green(`✓ Committed: ${result.commit.message}`));
          if (result.isComplete) {
            console.log(chalk.green.bold('🎉 Workflow complete!'));
          } else {
            console.log(chalk.cyan(`  Advanced to subtask ${result.progress.completed + 1}/${result.progress.total}`));
            console.log(chalk.dim(`  → Next action: Write a failing test`));
          }
          console.log('');
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot finalize
  autopilot
    .command('finalize')
    .description('Finalize the workflow after all subtasks are complete')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const status = orchestrator.getStatus();
        
        if (!status) {
          if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'No active workflow to finalize' }));
          } else {
            console.error(chalk.red('Error: No active workflow to finalize'));
          }
          process.exit(1);
        }

        // Mark parent task as done
        setTaskStatus(status.taskId, 'done', projectRoot);
        
        // Clear workflow state
        orchestrator.abort();

        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            taskId: status.taskId,
            message: `Workflow finalized. Task ${status.taskId} marked as done.`
          }, null, 2));
        } else {
          console.log(chalk.green(`✓ Workflow finalized. Task ${status.taskId} marked as done.`));
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // Autopilot abort
  autopilot
    .command('abort')
    .description('Abort the current workflow')
    .option('--force', 'Skip confirmation')
    .option('--json', 'Output JSON')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      if (!options.force && !options.json) {
        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to abort the workflow?',
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      try {
        const { WorkflowOrchestrator } = await import('../lib/autopilot/index.js');
        const orchestrator = new WorkflowOrchestrator(projectRoot);
        
        const result = orchestrator.abort();

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(chalk.green('✓ Workflow aborted'));
        }
      } catch (error) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: error.message }));
        } else {
          console.error(chalk.red('Error:'), error.message);
        }
        process.exit(1);
      }
    });

  // ── scope-up (AI) ──
  program
    .command('scope-up')
    .description('Increase the scope/complexity of a task via AI')
    .option('-i, --id <id>', 'Task ID')
    .option('-s, --strength <level>', 'Strength: light | regular | aggressive', 'regular')
    .option('-p, --prompt <text>', 'Additional guidance for scope increase')
    .option('-r, --research', 'Use research model for deeper context')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        displayError('Not in a TaskMaster project. Run "taskmaster init" first.');
        process.exit(1);
      }
      if (!options.id) {
        displayError('--id is required');
        process.exit(1);
      }

      const task = findTaskById(options.id, projectRoot);
      if (!task || task.isSubtask) {
        displayError(`Task ${options.id} not found or is a subtask (scope-up applies to top-level tasks).`);
        process.exit(1);
      }

      const spinner = startLoadingIndicator('Increasing task scope via AI…');
      try {
        await enforceUsageLimit(1);
        const { aiExpandTask } = await import('../lib/ai.js');

        const systemPrompt = `You are increasing the scope of an existing task. Strength: ${options.strength}.
${options.prompt ? `User guidance: ${options.prompt}` : ''}
Add more subtasks and make the task more comprehensive. Return a JSON object with keys: "title" (string), "description" (string), "details" (string), "subtasks" (array of {title, description, status:"pending"}).`;

        const result = await aiExpandTask(task, {
          num: options.strength === 'aggressive' ? 8 : options.strength === 'light' ? 3 : 5,
          prompt: systemPrompt,
          research: options.research,
          projectRoot,
        });

        if (result && result.subtasks) {
          addSubtasks(task.id, result.subtasks, false, projectRoot);
          if (result.details) updateTask(task.id, { details: result.details }, projectRoot);
        }

        await incrementUsage('tasksAdded', 1);
        succeedLoadingIndicator(spinner, `Scope increased for task ${options.id}`);
      } catch (error) {
        failLoadingIndicator(spinner, error.message);
        process.exit(1);
      }
    });

  // ── scope-down (AI) ──
  program
    .command('scope-down')
    .description('Decrease the scope/complexity of a task via AI')
    .option('-i, --id <id>', 'Task ID')
    .option('-s, --strength <level>', 'Strength: light | regular | aggressive', 'regular')
    .option('-p, --prompt <text>', 'Additional guidance for scope decrease')
    .option('-r, --research', 'Use research model')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        displayError('Not in a TaskMaster project. Run "taskmaster init" first.');
        process.exit(1);
      }
      if (!options.id) {
        displayError('--id is required');
        process.exit(1);
      }

      const task = findTaskById(options.id, projectRoot);
      if (!task || task.isSubtask) {
        displayError(`Task ${options.id} not found or is a subtask.`);
        process.exit(1);
      }

      const subtasks = task.subtasks || task.steps || [];
      const pendingOnly = subtasks.filter(s => s.status === 'pending');
      const keepCount = options.strength === 'aggressive' ? 1
                      : options.strength === 'light'      ? Math.max(1, pendingOnly.length - 1)
                      :                                     Math.max(1, Math.ceil(pendingOnly.length / 2));

      if (pendingOnly.length <= keepCount) {
        displayInfo(`Task ${options.id} already has ${pendingOnly.length} pending subtask(s); nothing to remove.`);
        return;
      }

      const toRemove = pendingOnly.slice(keepCount);
      const stepsKey = task.steps ? 'steps' : 'subtasks';
      const remaining = (task[stepsKey] || []).filter(s => !toRemove.some(r => r.id === s.id));
      updateTask(task.id, { [stepsKey]: remaining }, projectRoot);

      displaySuccess(`Removed ${toRemove.length} pending subtask(s) from task ${options.id}`);
    });

  // ── sync-readme ──
  program
    .command('sync-readme')
    .description('Sync task list into the project README.md')
    .option('--with-subtasks', 'Include subtasks in the output')
    .option('-s, --status <status>', 'Filter by status')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        displayError('Not in a TaskMaster project. Run "taskmaster init" first.');
        process.exit(1);
      }

      let tasks = getAllTasks(projectRoot);

      if (options.status) {
        const statuses = options.status.split(',').map(s => s.trim());
        tasks = tasks.filter(t => statuses.includes(t.status));
      }

      let mdSection = '## Tasks\n\n| ID | Title | Status | Priority |\n|---|---|---|---|\n';
      for (const t of tasks) {
        const statusIcon = t.status === 'done' ? '✅' : t.status === 'in-progress' ? '🔄' : '⬜';
        mdSection += `| ${t.id} | ${t.title} | ${statusIcon} ${t.status} | ${t.priority || 'medium'} |\n`;

        if (options.withSubtasks && Array.isArray(t.subtasks)) {
          for (const s of t.subtasks) {
            const sIcon = s.status === 'done' ? '✅' : s.status === 'in-progress' ? '🔄' : '⬜';
            mdSection += `| ${t.id}.${s.id} | ↳ ${s.title} | ${sIcon} ${s.status} | |\n`;
          }
        }
      }

      const readmePath = path.join(projectRoot, 'README.md');
      const marker = { start: '<!-- taskmaster:tasks:start -->', end: '<!-- taskmaster:tasks:end -->' };

      let readme = '';
      if (fs.existsSync(readmePath)) {
        readme = fs.readFileSync(readmePath, 'utf-8');
      }

      const wrapped = `${marker.start}\n${mdSection}\n${marker.end}`;
      if (readme.includes(marker.start) && readme.includes(marker.end)) {
        const re = new RegExp(`${marker.start}[\\s\\S]*?${marker.end}`, 'g');
        readme = readme.replace(re, wrapped);
      } else {
        readme += `\n${wrapped}\n`;
      }

      fs.writeFileSync(readmePath, readme, 'utf-8');
      displaySuccess('README.md updated with task list');
    });

  // ── lang (response language) ──
  program
    .command('lang')
    .description('View or set the response language for AI output')
    .option('--response <language>', 'Set the response language (e.g. en, es, ja)')
    .option('--setup', 'Interactive language setup')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        displayError('Not in a TaskMaster project. Run "taskmaster init" first.');
        process.exit(1);
      }

      const config = readProjectConfig(projectRoot);

      if (options.setup) {
        const inquirer = (await import('inquirer')).default;
        const { lang } = await inquirer.prompt([{
          type: 'input',
          name: 'lang',
          message: 'Response language code (e.g. en, es, ja, zh):',
          default: config.responseLanguage || 'en',
        }]);
        config.responseLanguage = lang;
        writeProjectConfig(config, projectRoot);
        displaySuccess(`Response language set to: ${lang}`);
        return;
      }

      if (options.response) {
        config.responseLanguage = options.response;
        writeProjectConfig(config, projectRoot);
        displaySuccess(`Response language set to: ${options.response}`);
        return;
      }

      console.log(chalk.cyan('Response language: ') + (config.responseLanguage || 'en (default)'));
    });

  // ── migrate ──
  program
    .command('migrate')
    .description('Migrate project layout from legacy to .taskmaster-ai')
    .option('-f, --force', 'Overwrite existing .taskmaster-ai directory')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Show what would be migrated without changes')
    .action(async (options) => {
      const projectRoot = process.cwd();
      const legacyDir = path.join(projectRoot, '.taskmaster');
      const newDir    = path.join(projectRoot, '.taskmaster-ai');

      if (!fs.existsSync(legacyDir)) {
        displayInfo('No legacy .taskmaster directory found. Nothing to migrate.');
        return;
      }

      if (fs.existsSync(newDir) && !options.force) {
        displayWarning('.taskmaster-ai already exists. Use --force to overwrite.');
        return;
      }

      if (options.dryRun) {
        displayInfo(`Would migrate: ${legacyDir} → ${newDir}`);
        return;
      }

      if (!options.yes) {
        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Migrate ${legacyDir} → ${newDir}?`,
          default: true,
        }]);
        if (!confirm) {
          displayInfo('Migration cancelled.');
          return;
        }
      }

      fs.cpSync(legacyDir, newDir, { recursive: true });
      displaySuccess(`Migrated .taskmaster → .taskmaster-ai`);
      displayInfo('You can safely delete .taskmaster after verifying the migration.');
    });

  // ── rules ──
  program
    .command('rules')
    .description('Add or remove IDE rule profiles (.cursor/rules, etc.)')
    .argument('[action]', '"add" or "remove"')
    .argument('[profiles...]', 'Profile names: cursor, windsurf, vscode, etc.')
    .option('-f, --force', 'Overwrite existing rules files')
    .action(async (action, profiles, options) => {
      const projectRoot = findProjectRoot() || process.cwd();

      if (!action || !['add', 'remove'].includes(action)) {
        displayError('Usage: taskmaster rules <add|remove> <profile ...>');
        process.exit(1);
      }

      if (!profiles || profiles.length === 0) {
        displayError('Specify at least one profile: cursor, windsurf, vscode');
        process.exit(1);
      }

      for (const profile of profiles) {
        const target = getRuleTargetPath(projectRoot, profile);
        if (!target) {
          displayWarning(`Unknown profile: ${profile}`);
          continue;
        }

        if (action === 'add') {
          if (fs.existsSync(target) && !options.force) {
            displayWarning(`${target} already exists. Use --force to overwrite.`);
            continue;
          }
          fs.mkdirSync(path.dirname(target), { recursive: true });
          const content = generateRuleContent(profile, projectRoot);
          fs.writeFileSync(target, content, 'utf-8');
          displaySuccess(`Created ${target}`);
        } else {
          if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            displaySuccess(`Removed ${target}`);
          } else {
            displayInfo(`${target} does not exist.`);
          }
        }
      }
    });
}

function getRuleTargetPath(projectRoot, profile) {
  const map = {
    cursor:   path.join(projectRoot, '.cursor', 'rules', 'taskmaster.mdc'),
    windsurf: path.join(projectRoot, '.windsurf', 'rules', 'taskmaster.md'),
    vscode:   path.join(projectRoot, '.vscode', 'settings.json'),
  };
  return map[profile] || null;
}

function generateRuleContent(profile) {
  return `# TaskMaster AI — ${profile} rules
# Auto-generated by \`taskmaster rules add ${profile}\`
# Customize as needed.

- Use \`taskmaster next\` to find the next task to work on.
- Use \`taskmaster show <id>\` for task details before implementing.
- Mark tasks done with \`taskmaster set-status -i <id> -s done\`.
- Expand complex tasks with \`taskmaster expand -i <id>\`.
`;
}

export default { registerCommands };
