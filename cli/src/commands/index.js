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
} from '../lib/tasks.js';
import {
  generateTasksFromPRD,
  expandTask as aiExpandTask,
  analyzeComplexity,
  generateTask,
} from '../lib/ai.js';
import {
  enforceUsageLimit,
  incrementUsage,
  getUsageSummary,
  checkUsageLimit,
} from '../lib/usage.js';
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
        incrementUsage('tasksParsed', tasks.length);

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
            incrementUsage('tasksExpanded', subtasks.length);
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
        incrementUsage('tasksExpanded', subtasks.length);
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
        incrementUsage('tasksAdded', 1);
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
        
        incrementUsage('complexityAnalyses', 1);
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
          
          incrementUsage('tasksAdded', 1); // Count as AI operation

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
        console.log(chalk.dim('   Get started at: ') + chalk.cyan('https://taskmaster.one/pricing'));
      } else if (summary.limit !== 'Unlimited') {
        const remaining = summary.remaining;
        if (remaining <= 0) {
          console.log(chalk.red.bold('⚠️  You have reached your monthly limit.'));
          console.log(chalk.dim('   Upgrade at: ') + chalk.cyan('https://taskmaster.one/pricing'));
        } else if (remaining <= 50) {
          console.log(chalk.yellow(`⚠️  Only ${remaining} operations remaining this month.`));
          console.log(chalk.dim('   Upgrade at: ') + chalk.cyan('https://taskmaster.one/pricing'));
        }
      }
      console.log('');
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

      // Display current config
      console.log('');
      console.log(chalk.cyan.bold('AI Model Configuration:'));
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

      // Check API keys
      console.log(chalk.cyan.bold('API Key Status:'));
      const providers = ['anthropic', 'openai', 'google', 'perplexity'];
      providers.forEach(provider => {
        const hasKey = !!getApiKey(provider);
        console.log(`  ${provider}: ${hasKey ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`);
      });
      console.log('');
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
