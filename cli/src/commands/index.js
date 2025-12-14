/**
 * Command Registration for TaskMaster AI CLI
 */

import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';
import { 
  ensureProjectConfigDir, 
  findProjectRoot, 
  getDefaultConfig, 
  writeProjectConfig,
  readProjectConfig,
  getTasksFilePath,
  getApiKey,
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

/**
 * Register all CLI commands
 */
export function registerCommands(program) {
  // Init command
  program
    .command('init')
    .description('Initialize TaskMaster AI in the current project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <text>', 'Project description')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .action(async (options) => {
      console.log('');
      console.log(chalk.cyan.bold('Initializing TaskMaster AI...'));
      console.log('');

      const projectRoot = process.cwd();
      
      // Check if already initialized
      if (findProjectRoot(projectRoot)) {
        console.log(chalk.yellow('⚠️  TaskMaster AI is already initialized in this project.'));
        return;
      }

      // Create project structure
      ensureProjectConfigDir(projectRoot);

      // Create config
      const config = getDefaultConfig();
      config.projectName = options.name || path.basename(projectRoot);
      config.projectDescription = options.description || '';
      writeProjectConfig(config, projectRoot);

      // Create initial empty tasks
      const tasksPath = getTasksFilePath(projectRoot);
      const initialTasks = {
        tags: {
          master: {
            tasks: [],
            metadata: {
              createdAt: new Date().toISOString(),
            }
          }
        }
      };
      fs.writeFileSync(tasksPath, JSON.stringify(initialTasks, null, 2));

      console.log(chalk.green('✓ Created .taskmaster directory'));
      console.log(chalk.green('✓ Created config.json'));
      console.log(chalk.green('✓ Created tasks.json'));
      console.log('');
      console.log(chalk.dim('Next steps:'));
      console.log(chalk.dim('  1. Create a PRD file describing your project'));
      console.log(chalk.dim('  2. Run: ') + chalk.cyan('taskmaster parse-prd <your-prd.md>'));
      console.log('');
    });

  // Parse PRD command
  program
    .command('parse-prd')
    .description('Parse a PRD file and generate tasks')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .option('-f, --force', 'Overwrite existing tasks')
    .option('--append', 'Append to existing tasks')
    .option('-r, --research', 'Use research model for better results')
    .action(async (file, options) => {
      const prdPath = file || options.input;
      
      if (!prdPath) {
        console.error(chalk.red('Error: Please provide a PRD file path'));
        process.exit(1);
      }

      if (!fs.existsSync(prdPath)) {
        console.error(chalk.red(`Error: File not found: ${prdPath}`));
        process.exit(1);
      }

      const projectRoot = findProjectRoot() || process.cwd();
      ensureProjectConfigDir(projectRoot);

      // Check for existing tasks
      const existingTasks = getAllTasks(projectRoot);
      if (existingTasks.length > 0 && !options.force && !options.append) {
        console.log(chalk.yellow('⚠️  Tasks already exist. Use --force to overwrite or --append to add.'));
        process.exit(1);
      }

      console.log('');
      console.log(chalk.cyan('Parsing PRD and generating tasks...'));
      console.log('');

      const ora = (await import('ora')).default;
      const spinner = ora('Reading PRD file...').start();

      try {
        // Check usage limit before AI operation
        const numTasks = parseInt(options.numTasks) || 10;
        try {
          enforceUsageLimit(numTasks);
        } catch (limitError) {
          spinner.stop();
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
        spinner.text = 'Generating tasks with AI...';

        const tasks = await generateTasksFromPRD(prdContent, {
          numTasks,
          research: options.research,
        });
        
        // Track usage after successful operation
        await incrementUsage('tasksParsed', tasks.length);

        spinner.stop();

        // Merge or replace tasks
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

        console.log(chalk.green(`✓ Generated ${tasks.length} tasks`));
        console.log('');
        console.log(chalk.dim('Run ') + chalk.cyan('taskmaster list') + chalk.dim(' to see your tasks'));
        console.log('');
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // List tasks command (with table format like official)
  program
    .command('list')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('--with-subtasks', 'Include subtasks')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project. Run "taskmaster init" first.'));
        process.exit(1);
      }

      let tasks = getAllTasks(projectRoot);

      if (options.status) {
        const statuses = options.status.split(',').map(s => s.trim());
        tasks = tasks.filter(t => statuses.includes(t.status));
      }

      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      console.log('');
      
      // Create table (like official version)
      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Status'),
          chalk.cyan('Pri'),
          chalk.cyan('Title'),
          chalk.cyan('Deps'),
        ],
        colWidths: [6, 14, 5, 50, 10],
        wordWrap: true,
      });

      tasks.forEach(task => {
        const statusDisplay = getStatusDisplay(task.status);
        const priorityDisplay = getPriorityBadge(task.priority);
        const depsDisplay = task.dependencies?.length > 0 
          ? task.dependencies.map(d => {
              const depTask = tasks.find(t => t.id === d);
              return depTask?.status === 'done' ? chalk.green(d) : chalk.yellow(d);
            }).join(',')
          : '-';
        
        table.push([
          chalk.white(task.id),
          statusDisplay,
          priorityDisplay,
          truncateText(task.title, 48),
          depsDisplay,
        ]);

        if (options.withSubtasks && task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach(subtask => {
            const subStatusDisplay = getStatusDisplay(subtask.status);
            table.push([
              chalk.gray(`  ${task.id}.${subtask.id}`),
              subStatusDisplay,
              '',
              chalk.dim(truncateText(subtask.title, 46)),
              '',
            ]);
          });
        }
      });

      console.log(table.toString());
      console.log('');

      // Show stats
      const stats = getTaskStats(projectRoot);
      const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      
      console.log(
        chalk.dim('Progress: ') + 
        chalk.cyan(`${progress}%`) + 
        chalk.dim(` (${stats.done}/${stats.total} tasks)`) +
        chalk.dim(' | ') +
        chalk.green(`✓ ${stats.done}`) +
        chalk.dim(' | ') +
        chalk.yellow(`◐ ${stats.inProgress}`) +
        chalk.dim(' | ') +
        chalk.gray(`○ ${stats.pending}`)
      );
      console.log('');
    });

  // Show task command
  program
    .command('show')
    .description('Show detailed information for a task')
    .argument('<id>', 'Task ID (e.g., 1 or 1.2 for subtask)')
    .action(async (id) => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const task = findTaskById(id, projectRoot);

      if (!task) {
        console.error(chalk.red(`Task ${id} not found.`));
        process.exit(1);
      }

      console.log('');
      console.log(
        boxen(
          chalk.cyan.bold(`Task ${id}: ${task.title}`) + '\n\n' +
          chalk.white.bold('Status: ') + getStatusColor(task.status)(task.status) + '\n' +
          chalk.white.bold('Priority: ') + (task.priority || 'medium') + '\n' +
          (task.dependencies?.length > 0 
            ? chalk.white.bold('Dependencies: ') + task.dependencies.join(', ') + '\n' 
            : '') +
          '\n' +
          chalk.white.bold('Description:') + '\n' +
          chalk.dim(task.description || 'No description') + '\n\n' +
          chalk.white.bold('Details:') + '\n' +
          chalk.dim(task.details || 'No details') + '\n\n' +
          (task.testStrategy 
            ? chalk.white.bold('Test Strategy:') + '\n' + chalk.dim(task.testStrategy) + '\n'
            : ''),
          {
            padding: 1,
            borderColor: 'cyan',
            borderStyle: 'round'
          }
        )
      );

      if (task.subtasks && task.subtasks.length > 0) {
        console.log(chalk.white.bold('Subtasks:'));
        task.subtasks.forEach(subtask => {
          const statusColor = getStatusColor(subtask.status);
          console.log(
            '  ' + chalk.gray(`[${task.id}.${subtask.id}]`) + ' ' +
            statusColor(`[${subtask.status}]`) + ' ' +
            subtask.title
          );
        });
      }

      console.log('');
    });

  // Next task command
  program
    .command('next')
    .description('Show the next task to work on')
    .action(async () => {
      const projectRoot = findProjectRoot();
      
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const task = getNextTask(projectRoot);

      if (!task) {
        console.log(chalk.green('🎉 All tasks completed! No pending tasks.'));
        return;
      }

      console.log('');
      console.log(chalk.cyan.bold('Next Task:'));
      console.log('');
      console.log(
        boxen(
          chalk.white.bold(`[${task.id}] ${task.title}`) + '\n\n' +
          chalk.dim(task.description || 'No description') + '\n\n' +
          chalk.white.bold('Priority: ') + getPriorityBadge(task.priority) + '\n' +
          (task.dependencies?.length > 0 
            ? chalk.white.bold('Dependencies: ') + chalk.green('✓ All complete')
            : ''),
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
      console.log('');
      console.log(chalk.dim('Start with: ') + chalk.cyan(`taskmaster set-status --id ${task.id} --status in-progress`));
      console.log('');
    });

  // Set status command
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

  // Expand task command
  program
    .command('expand')
    .description('Expand a task into subtasks using AI')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-n, --num <number>', 'Number of subtasks to generate', '5')
    .option('-p, --prompt <text>', 'Additional context for expansion')
    .option('--force', 'Replace existing subtasks')
    .option('-r, --research', 'Use research model')
    .option('--all', 'Expand all pending tasks')
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

        // Check usage limit for all tasks
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

      // Check usage limit
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

  // Add task command
  program
    .command('add-task')
    .description('Add a new task')
    .option('-p, --prompt <text>', 'Task description (required)')
    .option('-d, --dependencies <ids>', 'Comma-separated dependency IDs')
    .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
    .option('-r, --research', 'Use research model')
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

      // Check usage limit
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

  // Analyze complexity command
  program
    .command('analyze-complexity')
    .description('Analyze task complexity')
    .option('-r, --research', 'Use research model')
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

      // Check usage limit (1 operation for complexity analysis)
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

        // Save report
        const reportPath = path.join(projectRoot, '.taskmaster', 'reports', 'complexity-report.json');
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

  // Add dependency command
  program
    .command('add-dependency')
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

  // Remove dependency command
  program
    .command('remove-dependency')
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

  // Update subtask command (append timestamped notes)
  program
    .command('update-subtask')
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

      // Append timestamped note (like official version)
      const timestamp = new Date().toISOString();
      const newNote = `\n\n--- Update [${timestamp}] ---\n${options.prompt}`;
      
      subtask.details = (subtask.details || '') + newNote;
      
      saveAllTasks(tasks, projectRoot);

      console.log(chalk.green(`✓ Appended note to subtask ${options.id}`));
      console.log(chalk.dim(`  Timestamp: ${timestamp}`));
    });

  // Update task command
  program
    .command('update-task')
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
        // Check usage limit
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

  // Clear subtasks command
  program
    .command('clear-subtasks')
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
      
      // Show synced config info
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
        console.log(chalk.dim('  Tip: Run ') + chalk.cyan('taskmaster sync') + chalk.dim(' to refresh config from dashboard'));
        console.log('');
      } else {
        console.log(chalk.dim('No dashboard config synced. Run ') + chalk.cyan('taskmaster sync') + chalk.dim(' after adding API keys in the dashboard.'));
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
    .option('--setup', 'Run interactive setup')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const config = readProjectConfig(projectRoot);

      if (options.setMain || options.setResearch || options.setFallback) {
        if (options.setMain) {
          config.models.main.modelId = options.setMain;
        }
        if (options.setResearch) {
          config.models.research.modelId = options.setResearch;
        }
        if (options.setFallback) {
          config.models.fallback.modelId = options.setFallback;
        }
        writeProjectConfig(config, projectRoot);
        console.log(chalk.green('✓ Model configuration updated'));
        return;
      }

      // Check if models are from dashboard sync
      const cachedConfig = readCachedConfig();
      const hasModelSync = cachedConfig?.models;
      
      // Display current config
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

      // Check API keys (show source: env or dashboard)
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

  // ============================================
  // TAG MANAGEMENT COMMANDS
  // ============================================

  // List tags command
  program
    .command('tags')
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

  // Add tag command
  program
    .command('add-tag')
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

  // Use tag command
  program
    .command('use-tag')
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

  // Delete tag command
  program
    .command('delete-tag')
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

  // Rename tag command
  program
    .command('rename-tag')
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

  // Copy tag command
  program
    .command('copy-tag')
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

  // ============================================
  // DEPENDENCY MANAGEMENT COMMANDS
  // ============================================

  // Validate dependencies command
  program
    .command('validate-dependencies')
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

  // Fix dependencies command
  program
    .command('fix-dependencies')
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

  // ============================================
  // TASK ORGANIZATION COMMANDS
  // ============================================

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

  // Add subtask command
  program
    .command('add-subtask')
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

  // ============================================
  // ANALYSIS COMMANDS
  // ============================================

  // Complexity report command
  program
    .command('complexity-report')
    .description('Display the task complexity analysis report')
    .option('-f, --file <path>', 'Path to complexity report')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const reportPath = options.file || 
        path.join(projectRoot, '.taskmaster', 'reports', 'complexity-report.json');

      if (!fs.existsSync(reportPath)) {
        console.log(chalk.yellow('No complexity report found.'));
        console.log(chalk.dim('Run ') + chalk.cyan('taskmaster analyze-complexity') + chalk.dim(' first'));
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

  // Research command
  program
    .command('research')
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

      // Check usage limit
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

        // Save to task if specified
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

  // ============================================
  // BATCH OPERATIONS
  // ============================================

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

      // Check usage limit
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

  // ============================================
  // AUTOPILOT COMMANDS
  // ============================================

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
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Get color function for status
 */
function getStatusColor(status) {
  switch (status) {
    case 'done':
      return chalk.green;
    case 'in-progress':
      return chalk.yellow;
    case 'pending':
      return chalk.gray;
    case 'blocked':
      return chalk.red;
    case 'cancelled':
      return chalk.dim;
    case 'deferred':
      return chalk.blue;
    default:
      return chalk.white;
  }
}

/**
 * Get status display with color and symbol (like official)
 */
function getStatusDisplay(status) {
  switch (status) {
    case 'done':
      return chalk.green('✓ done');
    case 'in-progress':
      return chalk.yellow('◐ in-progress');
    case 'pending':
      return chalk.gray('○ pending');
    case 'blocked':
      return chalk.red('✗ blocked');
    case 'cancelled':
      return chalk.dim('⊘ cancelled');
    case 'deferred':
      return chalk.blue('◑ deferred');
    default:
      return chalk.white(status);
  }
}

/**
 * Get priority badge
 */
function getPriorityBadge(priority) {
  switch (priority) {
    case 'high':
      return chalk.red('▲');
    case 'low':
      return chalk.blue('▼');
    default:
      return chalk.yellow('●');
  }
}

export default { registerCommands };
