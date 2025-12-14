/**
 * Command Registration for TaskMaster AI CLI
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * Uses the new modular architecture from src/modules/
 */

import chalk from 'chalk';
import boxen from 'boxen';
import fs from 'fs';
import path from 'path';
import Table from 'cli-table3';

// Import from new modular structure
import {
  // Utils
  log,
  readJSON,
  writeJSON,
  findProjectRoot,
  getConfigDir,
  getTasksFilePath,
  isSilentMode,
  
  // UI
  getStatusWithColor,
  startLoadingIndicator,
  stopLoadingIndicator,
  
  // Task Manager
  findNextTask,
  listTasks,
  setStatus,
  showTask,
  logStep,
  addStep,
  removeStep,
  clearSteps,
  newTask,
  removeTask,
  moveTask,
  editTask,
  editTasks,
  breakdownTask,
  breakdownAll,
  assessComplexity,
  showAssessmentReport,
  ask,
  plan,
  scopeUp,
  scopeDown,
  initProject,
  isProjectInitialized,
  generateTaskFiles,
  showModelsConfig,
  listAvailableModels,
  setRoleModel,
  taskExists,
  findTask,
  
  // Status & Priority
  isValidStatus,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  DEFAULT_PRIORITY,
  
  // Link Manager
  addLink,
  removeLink,
  validateLinks,
  checkLinksCommand,
  fixLinksCommand,
  
  // Context Manager
  getCurrentContext,
  listContexts,
  createContext,
  useContext,
  deleteContext,
  cloneContext,
  renameContext,
  createContextFromBranch,
  
  // Sync README
  syncReadme,
  
  // Config Manager
  loadConfig,
  saveConfig,
  getConfigValue,
  getSupportedModels,
  findModelById,
  getApiKey,
  isApiKeySet,
  
  // Models
  SUPPORTED_MODELS
} from '../modules/index.js';

// Keep legacy imports for features not yet ported
import {
  ensureProjectConfigDir, 
  getDefaultConfig, 
  writeProjectConfig,
  readProjectConfig,
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
  moveTask as legacyMoveTask,
  addSingleSubtask,
  generateTaskFiles as legacyGenerateTaskFiles,
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
  syncPendingUsage,
} from '../lib/usage.js';
import {
  readCachedConfig,
  syncUserConfig,
  readStoredLicense,
  formatUsageSummary,
  activateLicense,
  removeLicenseData,
  getLicenseStatus,
  formatLicenseStatus,
  deactivateLicense,
} from '../lib/license.js';

/**
 * Display Getting Started guide after initialization
 */
function displayGettingStarted() {
  const border = chalk.dim('─'.repeat(60));
  
  console.log(border);
  console.log(chalk.white.bold('                      Getting Started'));
  console.log(border);
  console.log('');
  console.log(chalk.white.bold('Next steps:'));
  console.log('');
  console.log(chalk.white('1. ') + chalk.cyan('Configure AI models and add API keys'));
  console.log(chalk.dim('   ├─ Models: ') + chalk.cyan('taskmaster models --setup'));
  console.log(chalk.dim('   └─ Keys: Add to .env or configure in dashboard at ') + chalk.cyan('https://taskmaster.one/app/api-keys'));
  console.log('');
  console.log(chalk.white('2. ') + chalk.cyan('Create a PRD (Product Requirements Document)'));
  console.log(chalk.dim('   ├─ Template available at: .taskmaster-ai/templates/example_prd.txt'));
  console.log(chalk.dim('   └─ Save your PRD to: .taskmaster-ai/docs/prd.txt'));
  console.log('');
  console.log(chalk.white('3. ') + chalk.cyan('Generate tasks from your PRD'));
  console.log(chalk.dim('   └─ Run: ') + chalk.cyan('taskmaster plan .taskmaster-ai/docs/prd.txt'));
  console.log('');
  console.log(chalk.white('4. ') + chalk.cyan('Analyze task complexity'));
  console.log(chalk.dim('   └─ Run: ') + chalk.cyan('taskmaster assess'));
  console.log('');
  console.log(chalk.white('5. ') + chalk.cyan('Break down complex tasks into subtasks'));
  console.log(chalk.dim('   └─ Run: ') + chalk.cyan('taskmaster breakdown --all'));
  console.log('');
  console.log(chalk.white('6. ') + chalk.cyan('Start working on tasks'));
  console.log(chalk.dim('   └─ Run: ') + chalk.cyan('taskmaster next') + chalk.dim(' to see what to work on'));
  console.log('');
  console.log(chalk.white('7. ') + chalk.cyan('Update task status as you progress'));
  console.log(chalk.dim('   └─ Run: ') + chalk.cyan('taskmaster set-status --id <id> --status done'));
  console.log('');
  console.log(chalk.white('8. ') + chalk.green.bold('Ship it! 🚀'));
  console.log('');
  console.log(chalk.dim('Run ') + chalk.cyan('taskmaster --help') + chalk.dim(' to see all available commands.'));
  console.log('');
  console.log(border);
  console.log('');
}

/**
 * Available AI models (matching web app Models.tsx)
 */
const AVAILABLE_MODELS = {
  anthropic: [
    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Most powerful' },
    { id: 'claude-4.1-opus', name: 'Claude 4.1 Opus', description: 'Advanced reasoning' },
    { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Best balance' },
    { id: 'claude-sonnet-4.5-reasoning', name: 'Claude Sonnet 4.5 (Reasoning)', description: 'Enhanced reasoning' },
    { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', description: 'High capability' },
    { id: 'claude-4-sonnet-reasoning', name: 'Claude 4 Sonnet (Reasoning)', description: 'With reasoning' },
    { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', description: 'Previous gen' },
    { id: 'claude-3.7-sonnet-reasoning', name: 'Claude 3.7 Sonnet (Reasoning)', description: 'With reasoning' },
    { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', description: 'Fast & efficient' },
    { id: 'claude-haiku-4.5-reasoning', name: 'Claude Haiku 4.5 (Reasoning)', description: 'Fast with reasoning' },
  ],
  openai: [
    { id: 'gpt-5', name: 'GPT 5', description: 'Most capable' },
    { id: 'gpt-5-reasoning', name: 'GPT 5 (Reasoning)', description: 'With reasoning' },
    { id: 'gpt-5.2-instant', name: 'GPT 5.2 (Instant)', description: 'Fast responses' },
    { id: 'gpt-5.2-reasoning', name: 'GPT 5.2 (Reasoning)', description: 'Enhanced reasoning' },
    { id: 'gpt-5.1-instant', name: 'GPT 5.1 (Instant)', description: 'Quick tasks' },
    { id: 'gpt-5.1-reasoning', name: 'GPT 5.1 (Reasoning)', description: 'Reasoning mode' },
    { id: 'gpt-5-mini', name: 'GPT 5 Mini', description: 'Compact & fast' },
    { id: 'gpt-5-nano', name: 'GPT 5 Nano', description: 'Ultra light' },
    { id: 'gpt-4.1', name: 'GPT 4.1', description: 'Stable release' },
    { id: 'gpt-4.1-mini', name: 'GPT 4.1 Mini', description: 'Cost-effective' },
    { id: 'gpt-4.1-nano', name: 'GPT 4.1 Nano', description: 'Lightweight' },
    { id: 'gpt-4o', name: 'GPT 4o', description: 'Multimodal' },
    { id: 'gpt-4o-mini', name: 'GPT 4o Mini', description: 'Fast multimodal' },
    { id: 'o3-mini', name: 'o3 Mini', description: 'Reasoning model' },
    { id: 'o3-pro', name: 'o3 Pro', description: 'Advanced reasoning' },
    { id: 'o4-mini', name: 'o4 Mini', description: 'Latest reasoning' },
  ],
  google: [
    { id: 'gemini-3-pro', name: 'Gemini 3 Pro', description: 'Most powerful' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced tasks' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast & capable' },
    { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash (Thinking)', description: 'With reasoning' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Lightweight' },
  ],
  deepseek: [
    { id: 'deepseek-v3', name: 'DeepSeek V3', description: 'Latest version' },
    { id: 'deepseek-v3.2-exp', name: 'DeepSeek V3.2 Exp', description: 'Experimental' },
    { id: 'deepseek-v3.2-exp-thinking', name: 'DeepSeek V3.2 Exp (Thinking)', description: 'With reasoning' },
    { id: 'deepseek-v3.1', name: 'DeepSeek V3.1', description: 'Stable release' },
    { id: 'deepseek-v3.1-thinking', name: 'DeepSeek V3.1 (Thinking)', description: 'With reasoning' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Reasoning focused' },
  ],
  xai: [
    { id: 'grok-4', name: 'Grok 4', description: 'Latest Grok' },
    { id: 'grok-4-fast', name: 'Grok 4 Fast', description: 'Quick responses' },
    { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast (Reasoning)', description: 'Fast reasoning' },
    { id: 'grok-3', name: 'Grok 3', description: 'Previous gen' },
    { id: 'grok-3-mini', name: 'Grok 3 Mini', description: 'Compact' },
  ],
  meta: [
    { id: 'llama-4-maverick', name: 'Llama 4 Maverick', description: 'Most capable' },
    { id: 'llama-4-scout', name: 'Llama 4 Scout', description: 'Efficient' },
    { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', description: 'Large model' },
  ],
  zhipu: [
    { id: 'glm-4.6', name: 'GLM 4.6', description: 'Latest GLM' },
    { id: 'glm-4.6-thinking', name: 'GLM 4.6 (Thinking)', description: 'With reasoning' },
    { id: 'glm-4.5', name: 'GLM 4.5', description: 'Standard' },
    { id: 'glm-4.5-air', name: 'GLM 4.5 Air', description: 'Lightweight' },
  ],
  moonshot: [
    { id: 'kimi-k2', name: 'Kimi K2', description: 'Latest Kimi' },
    { id: 'kimi-k2-thinking', name: 'Kimi K2 (Thinking)', description: 'With reasoning' },
  ],
  perplexity: [
    { id: 'sonar', name: 'Sonar', description: 'Lightweight search' },
    { id: 'sonar-pro', name: 'Sonar Pro', description: 'Advanced search' },
    { id: 'sonar-reasoning', name: 'Sonar Reasoning', description: 'Real-time reasoning' },
    { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', description: 'DeepSeek-R1 powered' },
    { id: 'sonar-deep-research', name: 'Sonar Deep Research', description: 'Comprehensive research' },
  ],
};

// Default/recommended models
const RECOMMENDED_MODELS = {
  main: 'claude-sonnet-4.5',
  research: 'sonar-pro',
  fallback: 'gemini-2.5-flash',
};

/**
 * Register all CLI commands
 */
// Import auth commands
import { registerAuthCommands } from './auth.js';

export function registerCommands(program) {
  // Register authentication commands (login, logout, whoami)
  registerAuthCommands(program);
  // Init command with interactive prompts like official version
  program
    .command('init')
    .description('Initialize TaskMaster AI in the current project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <text>', 'Project description')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('--rules <profiles>', 'Comma-separated rule profiles to include')
    .option('--no-git', 'Skip git repository initialization')
    .option('--aliases', 'Add shell aliases (tm, taskmaster)')
    .action(async (options) => {
      const { displayBanner } = await import('../index.js');
      const { getCurrentUser, isLoggedIn } = await import('../lib/auth.js');
      const { getLicenseStatus } = await import('../lib/license.js');
      
      console.log('');
      await displayBanner({ showVersion: false });
      
      console.log(
        boxen(
          chalk.cyan.bold('Initializing') + chalk.white(' your new project'),
          {
            padding: { top: 0, bottom: 0, left: 2, right: 2 },
            borderColor: '#7C3AED',
            borderStyle: 'round'
          }
        )
      );
      console.log('');

      // ============================================
      // AUTH & LICENSE CHECK (Beautiful UI)
      // ============================================
      const loggedIn = await isLoggedIn();
      const currentUser = loggedIn ? await getCurrentUser() : null;
      const licenseStatus = loggedIn ? await getLicenseStatus() : null;

      if (!loggedIn) {
        // Beautiful login prompt
        console.log(
          boxen(
            chalk.bold.white('🔐 Authentication Required\n\n') +
            chalk.dim('TaskMaster AI requires an active subscription.\n') +
            chalk.dim('Please login to continue.\n\n') +
            chalk.cyan('→ New user? Sign up at: ') + chalk.underline('https://taskmaster.one/signup') + '\n' +
            chalk.cyan('→ Have an account? Login below'),
            {
              padding: 1,
              margin: { top: 0, bottom: 1 },
              borderColor: 'yellow',
              borderStyle: 'round',
              textAlignment: 'center'
            }
          )
        );

        const inquirer = (await import('inquirer')).default;
        const { loginMethod } = await inquirer.prompt([
          {
            type: 'list',
            name: 'loginMethod',
            message: 'How would you like to login?',
            choices: [
              { name: '🔑 Email & Password', value: 'email' },
              { name: '🌐 Google Account', value: 'google' },
              { name: '❌ Cancel', value: 'cancel' }
            ]
          }
        ]);

        if (loginMethod === 'cancel') {
          console.log(chalk.yellow('\n⚠️  Initialization cancelled. Login required to continue.\n'));
          return;
        }

        // Perform login
        const { loginWithEmail, loginWithGoogle } = await import('../lib/auth.js');
        let loginResult;

        if (loginMethod === 'google') {
          console.log(chalk.dim('\n🌐 Opening browser for Google login...\n'));
          loginResult = await loginWithGoogle();
        } else {
          const credentials = await inquirer.prompt([
            {
              type: 'input',
              name: 'email',
              message: 'Email:',
              validate: (input) => input.includes('@') || 'Enter a valid email'
            },
            {
              type: 'password',
              name: 'password',
              message: 'Password:',
              mask: '*'
            }
          ]);

          console.log(chalk.dim('\n🔓 Authenticating...\n'));
          loginResult = await loginWithEmail(credentials.email, credentials.password);
        }

        if (!loginResult.success) {
          console.log(
            boxen(
              chalk.red.bold('✗ Login Failed\n\n') +
              chalk.white(loginResult.error),
              {
                padding: 1,
                borderColor: 'red',
                borderStyle: 'round'
              }
            )
          );
          console.log();
          return;
        }

        // Show success with license info
        console.log(
          boxen(
            chalk.green.bold('✓ Login Successful!\n\n') +
            chalk.white('Email: ') + chalk.cyan(loginResult.email) + '\n' +
            (loginResult.license?.hasLicense 
              ? chalk.white('Plan:  ') + chalk.bold.magenta(loginResult.license.planName) + chalk.dim(` (${loginResult.license.tasksPerMonth} tasks/month)`)
              : chalk.yellow('⚠️  No active license - Subscribe at: ') + chalk.cyan('https://taskmaster.one/pricing')
            ),
            {
              padding: 1,
              margin: { top: 0, bottom: 1 },
              borderColor: 'green',
              borderStyle: 'round'
            }
          )
        );

        if (!loginResult.license?.hasLicense) {
          console.log(chalk.yellow('⚠️  You need an active subscription to use TaskMaster AI.\n'));
          return;
        }
      } else {
        // Already logged in - show status
        const hasValidLicense = licenseStatus?.valid && licenseStatus?.activated;
        
        console.log(
          boxen(
            chalk.green('✓ Logged in as ') + chalk.cyan(currentUser.email) + '\n' +
            (hasValidLicense
              ? chalk.white('Plan: ') + chalk.bold.magenta(licenseStatus.planName) + chalk.dim(` • ${licenseStatus.tasksPerMonth} tasks/month`)
              : chalk.yellow('⚠️  No active license')),
            {
              padding: { top: 0, bottom: 0, left: 2, right: 2 },
              margin: { bottom: 1 },
              borderColor: hasValidLicense ? 'green' : 'yellow',
              borderStyle: 'round'
            }
          )
        );

        if (!hasValidLicense) {
          console.log(chalk.yellow('⚠️  You need an active subscription to continue.'));
          console.log(chalk.dim('   Subscribe at: ') + chalk.cyan('https://taskmaster.one/pricing\n'));
          return;
        }
      }

      const projectRoot = process.cwd();
      
      // Check if already initialized
      if (findProjectRoot(projectRoot)) {
        console.log(chalk.yellow('⚠️  TaskMaster AI is already initialized in this project.'));
        return;
      }

      const inquirer = (await import('inquirer')).default;
      
      // Project settings
      let settings = {
        name: options.name || path.basename(projectRoot),
        description: options.description || '',
        addAliases: options.aliases || false,
        initGit: options.git !== false,
        storeInGit: true,
        rules: options.rules ? options.rules.split(',').map(r => r.trim()) : null,
      };

      // Interactive prompts if not using --yes
      if (!options.yes) {
        if (!options.rules) {
          console.log(chalk.yellow('ℹ️ No rules specified; interactive setup will be launched to select profiles.'));
        }
        console.log(chalk.yellow('ℹ️ Required options not provided, proceeding with prompts.'));
        console.log('');

        const projectAnswers = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addAliases',
            message: `Add shell aliases for task-master? This lets you type "${chalk.cyan('tm')}" instead of "${chalk.cyan('task-master')}"`,
            default: true,
          },
          {
            type: 'confirm',
            name: 'initGit',
            message: 'Initialize a Git repository in project root?',
            default: false,
          },
          {
            type: 'confirm',
            name: 'storeInGit',
            message: 'Store tasks in Git (tasks.json and tasks/ directory)?',
            default: true,
          },
        ]);

        settings = { ...settings, ...projectAnswers };

        // Show settings confirmation
        console.log('');
        console.log(chalk.white.bold('Task Master Project settings:'));
        console.log(`  Add shell aliases (so you can use "${chalk.cyan('tm')}" instead of "${chalk.cyan('task-master')}"): ${settings.addAliases ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Initialize Git repository in project root: ${settings.initGit ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`  Store tasks in Git (tasks.json and tasks/ directory): ${settings.storeInGit ? chalk.green('Yes') : chalk.red('No')}`);
        console.log('');

        const { confirmSettings } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmSettings',
            message: 'Do you want to continue with these settings?',
            default: true,
          },
        ]);

        if (!confirmSettings) {
          console.log(chalk.yellow('Initialization cancelled.'));
          return;
        }
      }

      // Rule profile selection
      const availableRules = [
        { name: 'Amp', value: 'amp', desc: 'Amp AI integration' },
        { name: 'Claude Code', value: 'claude', desc: 'Rule profile and MCP config' },
        { name: 'Cline', value: 'cline', desc: 'Rule profile and MCP config' },
        { name: 'Codex', value: 'codex', desc: 'Rule profile' },
        { name: 'Cursor', value: 'cursor', desc: 'Rule profile, MCP config' },
        { name: 'Gemini', value: 'gemini', desc: 'Gemini integration' },
        { name: 'Kilo Code', value: 'kilo', desc: 'Rule profile and MCP config' },
        { name: 'Kiro', value: 'kiro', desc: 'Rule profile and MCP config' },
        { name: 'OpenCode', value: 'opencode', desc: 'Integration guide and MCP config' },
        { name: 'Roo Code', value: 'roo', desc: 'Rule profile, MCP config, and agent modes' },
        { name: 'Trae', value: 'trae', desc: 'Rule profile' },
        { name: 'VS Code', value: 'vscode', desc: 'Rule profile and MCP config' },
        { name: 'Windsurf', value: 'windsurf', desc: 'Rule profile and MCP config' },
        { name: 'Zed', value: 'zed', desc: 'Integration guide and MCP config' },
      ];

      let selectedRules = settings.rules;
      
      if (!selectedRules && !options.yes) {
        console.log('');
        console.log(chalk.dim('Available rule profiles:'));
        availableRules.forEach(rule => {
          console.log(`  • ${chalk.yellow(rule.name)} – ${rule.desc}`);
        });
        console.log('');

        const { rules } = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'rules',
            message: 'Which rule profiles would you like to add to your project?',
            choices: availableRules.map(r => ({
              name: `${r.name} – ${r.desc}`,
              value: r.value,
              checked: false, // No default selection
            })),
            pageSize: 15,
          },
        ]);
        selectedRules = rules;
      }

      // Create project structure
      const ora = (await import('ora')).default;
      const spinner = ora('Creating project structure...').start();

      try {
        ensureProjectConfigDir(projectRoot);

        // Create config
        const config = getDefaultConfig();
        config.projectName = settings.name;
        config.projectDescription = settings.description;
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

        // Create .gitignore entries if not storing in git
        if (!settings.storeInGit) {
          const gitignorePath = path.join(projectRoot, '.gitignore');
          const gitignoreEntries = '\n# TaskMaster AI\n.taskmaster-ai/tasks.json\n.taskmaster-ai/tasks/\n';
          if (fs.existsSync(gitignorePath)) {
            fs.appendFileSync(gitignorePath, gitignoreEntries);
          } else {
            fs.writeFileSync(gitignorePath, gitignoreEntries);
          }
        }

        // Create rule directories for selected profiles
        if (selectedRules && selectedRules.length > 0) {
          for (const rule of selectedRules) {
            const ruleDir = rule === 'cursor' ? '.cursor/rules' :
                           rule === 'claude' ? '.claude' :
                           rule === 'roo' ? '.roo/rules' :
                           rule === 'windsurf' ? '.windsurf/rules' :
                           rule === 'cline' ? '.cline' :
                           rule === 'vscode' ? '.vscode' :
                           `.${rule}`;
            const ruleDirPath = path.join(projectRoot, ruleDir);
            if (!fs.existsSync(ruleDirPath)) {
              fs.mkdirSync(ruleDirPath, { recursive: true });
            }
          }
        }

        // Create templates directory with example PRD
        const templatesDir = path.join(projectRoot, '.taskmaster-ai', 'templates');
        fs.mkdirSync(templatesDir, { recursive: true });
        
        const examplePRD = `# Project Requirements Document (PRD)

## Project Overview
[Describe your project here - what problem does it solve? Who is it for?]

## Goals and Objectives
- [Primary goal 1]
- [Primary goal 2]
- [Primary goal 3]

## Features and Requirements

### Core Features
1. **Feature 1**: [Description]
2. **Feature 2**: [Description]
3. **Feature 3**: [Description]

### Technical Requirements
- [Tech stack, frameworks, libraries]
- [Performance requirements]
- [Security requirements]

### User Stories
- As a [user type], I want to [action] so that [benefit]
- As a [user type], I want to [action] so that [benefit]

## Success Criteria
- [Measurable outcome 1]
- [Measurable outcome 2]

## Timeline and Milestones
- Phase 1: [Description]
- Phase 2: [Description]

---
Save this file and run: taskmaster plan <filename>
`;
        fs.writeFileSync(path.join(templatesDir, 'example_prd.txt'), examplePRD);

        // Create docs directory
        const docsDir = path.join(projectRoot, '.taskmaster-ai', 'docs');
        fs.mkdirSync(docsDir, { recursive: true });

        // Create reports directory
        const reportsDir = path.join(projectRoot, '.taskmaster-ai', 'reports');
        fs.mkdirSync(reportsDir, { recursive: true });

        spinner.stop();

        console.log('');
        console.log(chalk.green('✓') + chalk.white(' Created .taskmaster-ai directory'));
        console.log(chalk.green('✓') + chalk.white(' Created config.json'));
        console.log(chalk.green('✓') + chalk.white(' Created tasks.json'));
        console.log(chalk.green('✓') + chalk.white(' Created templates/example_prd.txt'));
        if (selectedRules && selectedRules.length > 0) {
          console.log(chalk.green('✓') + chalk.white(` Created rule directories for: ${selectedRules.join(', ')}`));
        }
        console.log('');

        // Display Getting Started guide
        displayGettingStarted();

      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Plan command (generate tasks from PRD)
  program
    .command('plan')
    .description('Generate tasks from a PRD or requirements file')
    .argument('[file]', 'Path to the PRD file')
    .option('-i, --input <file>', 'Path to the PRD file')
    .option('-n, --num-tasks <number>', 'Number of tasks to generate', '10')
    .option('-f, --force', 'Overwrite existing tasks')
    .option('--append', 'Append to existing tasks')
    .option('-r, --research', 'Use research model for better results')
    .action(async (file, options) => {
      const { displayBanner } = await import('../index.js');
      await displayBanner();
      
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

      // Show tag context
      const currentTag = getCurrentTag(projectRoot);
      console.log(chalk.yellow('🏷 tag: ') + chalk.white.bold(currentTag));

      // Check for existing tasks
      const existingTasks = getAllTasks(projectRoot);
      if (existingTasks.length > 0 && !options.force && !options.append) {
        console.log(chalk.yellow('⚠️  Tasks already exist. Use --force to overwrite or --append to add.'));
        process.exit(1);
      }

      const numTasks = parseInt(options.numTasks) || 10;
      console.log(chalk.cyan(`Parsing PRD file: `) + chalk.white(path.resolve(prdPath)));
      console.log(chalk.cyan(`Generating ${numTasks} tasks...`));
      console.log('');

      try {
        // Check usage limit before AI operation
        try {
          enforceUsageLimit(numTasks);
        } catch (limitError) {
          console.log('');
          console.log(
            boxen(
              chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
              chalk.white(limitError.message) + '\n\n' +
              chalk.dim('Upgrade your plan at ') + chalk.cyan('https://taskmaster.one/pricing'),
              { padding: 1, borderColor: 'red', borderStyle: 'round' }
            )
          );
          process.exit(1);
        }

        // Check if tag is empty
        if (existingTasks.length === 0) {
          console.log(chalk.blue('[INFO]') + chalk.dim(` Tag '${currentTag}' is empty. Creating new tasks.`));
        }

        console.log(chalk.blue('[INFO]') + chalk.dim(' Parsing PRD and generating tasks...'));
        console.log(chalk.blue('[INFO]') + chalk.dim(' Calling AI service to generate tasks from PRD...'));

        const prdContent = fs.readFileSync(prdPath, 'utf-8');

        const tasks = await generateTasksFromPRD(prdContent, {
          numTasks,
          research: options.research,
        });
        
        // Track usage after successful operation
        await incrementUsage('tasksParsed', tasks.length);

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

        console.log('');
        console.log(chalk.green('✓ ') + chalk.white.bold(`Generated ${tasks.length} tasks`));
        console.log('');
        
        // Show generated tasks summary
        const table = new Table({
          head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Priority')],
          colWidths: [6, 55, 12],
          style: { head: [], border: ['gray'] },
        });
        
        finalTasks.slice(0, 10).forEach(task => {
          const priorityColor = task.priority === 'high' ? chalk.red : 
                               task.priority === 'low' ? chalk.blue : chalk.yellow;
          table.push([
            task.id,
            truncateText(task.title, 53),
            priorityColor(task.priority || 'medium'),
          ]);
        });
        
        console.log(table.toString());
        if (finalTasks.length > 10) {
          console.log(chalk.dim(`  ... and ${finalTasks.length - 10} more tasks`));
        }
        console.log('');
        
        // Suggested next steps
        console.log(
          boxen(
            chalk.white.bold('Next Steps:') + '\n\n' +
            chalk.white('1. Run ') + chalk.cyan('taskmaster list') + chalk.white(' to see all tasks') + '\n' +
            chalk.white('2. Run ') + chalk.cyan('taskmaster assess') + chalk.white(' to analyze complexity') + '\n' +
            chalk.white('3. Run ') + chalk.cyan('taskmaster breakdown --all') + chalk.white(' to generate subtasks'),
            {
              padding: 1,
              borderColor: 'green',
              borderStyle: 'round'
            }
          )
        );
        console.log('');
      } catch (error) {
        console.error(chalk.red('[ERROR]'), error.message);
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

      console.log('');
      
      // Show current tag context
      const currentTag = getCurrentTag(projectRoot);
      console.log(chalk.yellow('🏷 tag: ') + chalk.white.bold(currentTag));
      
      if (tasks.length === 0) {
        console.log(chalk.yellow('No tasks found.'));
        return;
      }

      console.log('');
      
      // Create enhanced table
      const table = new Table({
        head: [
          chalk.cyan('ID'),
          chalk.cyan('Title'),
          chalk.cyan('Status'),
          chalk.cyan('Priority'),
          chalk.cyan('Dependencies'),
          chalk.cyan('Complexity'),
        ],
        colWidths: [6, 45, 14, 10, 16, 12],
        wordWrap: true,
        style: { head: [], border: ['gray'] },
      });

      tasks.forEach(task => {
        const statusDisplay = getStatusDisplay(task.status);
        const priorityColor = task.priority === 'high' ? chalk.red : 
                             task.priority === 'low' ? chalk.blue : chalk.yellow;
        const depsDisplay = task.dependencies?.length > 0 
          ? task.dependencies.map(d => {
              const depTask = tasks.find(t => t.id === d);
              return depTask?.status === 'done' ? chalk.green(d) : chalk.yellow(d);
            }).join(', ')
          : chalk.dim('None');
        
        table.push([
          chalk.white(task.id),
          truncateText(task.title, 43),
          statusDisplay,
          priorityColor(task.priority || 'medium'),
          depsDisplay,
          chalk.dim('N/A'),
        ]);

        if (options.withSubtasks && task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach(subtask => {
            const subStatusDisplay = getStatusDisplay(subtask.status);
            table.push([
              chalk.gray(`  ${task.id}.${subtask.id}`),
              chalk.dim(truncateText(subtask.title, 41)),
              subStatusDisplay,
              '',
              '',
              '',
            ]);
          });
        }
      });

      console.log(table.toString());
      console.log('');

      // Show stats with progress bars
      const stats = getTaskStats(projectRoot);
      const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      
      // Progress bar
      const barWidth = 30;
      const filled = Math.round((progress / 100) * barWidth);
      const empty = barWidth - filled;
      const progressBar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
      
      console.log(chalk.white.bold('Tasks Progress:') + ` [${progressBar}] ${chalk.cyan(progress + '%')} ${stats.done}/${stats.total}`);
      console.log(
        chalk.dim('Completed: ') + chalk.green(stats.done) + 
        chalk.dim('  Cancelled: ') + chalk.gray('0') +
        chalk.dim('  Deferred: ') + chalk.gray('0')
      );
      console.log(
        chalk.dim('In Progress: ') + chalk.yellow(stats.inProgress) +
        chalk.dim('  Review: ') + chalk.gray('0') +
        chalk.dim('  Pending: ') + chalk.cyan(stats.pending) +
        chalk.dim('  Blocked: ') + chalk.red('0')
      );
      console.log('');
      
      // Priority breakdown
      const highPriority = tasks.filter(t => t.priority === 'high').length;
      const mediumPriority = tasks.filter(t => t.priority === 'medium' || !t.priority).length;
      const lowPriority = tasks.filter(t => t.priority === 'low').length;
      
      console.log(chalk.white.bold('Priority Breakdown:'));
      console.log(`  • High priority: ${chalk.red(highPriority)}`);
      console.log(`  • Medium priority: ${chalk.yellow(mediumPriority)}`);
      console.log(`  • Low priority: ${chalk.blue(lowPriority)}`);
      console.log('');
      
      // Show next task recommendation
      const nextTask = getNextTask(projectRoot);
      if (nextTask) {
        const separator = chalk.yellow('─'.repeat(20) + ' ⚡ RECOMMENDED NEXT TASK ⚡ ' + '─'.repeat(20));
        console.log(separator);
        console.log('');
        console.log(chalk.yellow('🔥 Next Task to Work On: ') + chalk.white.bold(`#${nextTask.id} - ${nextTask.title}`));
        console.log('');
        console.log(chalk.white.bold('Priority: ') + chalk.red(nextTask.priority || 'medium') + 
          chalk.white.bold('  Status: ') + getStatusDisplay(nextTask.status));
        console.log(chalk.white.bold('Dependencies: ') + (nextTask.dependencies?.length > 0 ? nextTask.dependencies.join(', ') : chalk.dim('None')));
        console.log('');
        console.log(chalk.dim(nextTask.description || 'No description'));
        console.log('');
        console.log(chalk.cyan('Start working: ') + chalk.white(`taskmaster set-status --id=${nextTask.id} --status=in-progress`));
        console.log(chalk.cyan('View details: ') + chalk.white(`taskmaster show ${nextTask.id}`));
        console.log('');
        
        // Suggested next steps box
        console.log(
          boxen(
            chalk.white.bold('Suggested Next Steps:') + '\n\n' +
            chalk.white('1. Run ') + chalk.cyan('taskmaster next') + chalk.white(' to see what to work on next') + '\n' +
            chalk.white('2. Run ') + chalk.cyan('taskmaster breakdown --id=<id>') + chalk.white(' to break down a task into subtasks') + '\n' +
            chalk.white('3. Run ') + chalk.cyan('taskmaster set-status --id=<id> --status=done') + chalk.white(' to mark a task as complete'),
            {
              padding: 1,
              borderColor: 'gray',
              borderStyle: 'round'
            }
          )
        );
      }
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

      const priorityColor = task.priority === 'high' ? chalk.red : 
                           task.priority === 'low' ? chalk.blue : chalk.yellow;

      console.log('');
      
      // Task header
      console.log(chalk.white.bold(`Task ${id}: `) + chalk.cyan.bold(task.title));
      console.log('');
      console.log(chalk.white.bold('Priority: ') + priorityColor(task.priority || 'medium') + 
        chalk.white.bold('  Status: ') + getStatusDisplay(task.status));
      console.log(chalk.white.bold('Dependencies: ') + 
        (task.dependencies?.length > 0 ? task.dependencies.join(', ') : chalk.dim('None')));
      console.log('');
      
      // Description box
      console.log(
        boxen(
          chalk.white.bold('Description:') + '\n\n' +
          chalk.white(task.description || 'No description provided'),
          {
            padding: 1,
            borderColor: 'gray',
            borderStyle: 'round'
          }
        )
      );
      
      // Details box (if available)
      if (task.details) {
        console.log(
          boxen(
            chalk.white.bold('Implementation Details:') + '\n\n' +
            chalk.dim(task.details),
            {
              padding: 1,
              borderColor: 'gray',
              borderStyle: 'round'
            }
          )
        );
      }
      
      // Test strategy box (if available)
      if (task.testStrategy) {
        console.log(
          boxen(
            chalk.white.bold('Test Strategy:') + '\n\n' +
            chalk.dim(task.testStrategy),
            {
              padding: 1,
              borderColor: 'gray',
              borderStyle: 'round'
            }
          )
        );
      }

      // Subtasks (if any)
      if (task.subtasks && task.subtasks.length > 0) {
        console.log(chalk.white.bold('Subtasks:'));
        console.log('');
        
        const subtaskTable = new Table({
          head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Status')],
          colWidths: [10, 50, 14],
          style: { head: [], border: ['gray'] },
        });
        
        task.subtasks.forEach(subtask => {
          subtaskTable.push([
            `${task.id}.${subtask.id}`,
            truncateText(subtask.title, 48),
            getStatusDisplay(subtask.status),
          ]);
        });
        
        console.log(subtaskTable.toString());
        console.log('');
      }

      // Suggested actions
      const isSubtask = id.includes('.');
      const suggestedActions = isSubtask ? 
        `1. Run ${chalk.cyan(`taskmaster set-status --id=${id} --status=in-progress`)} to start working\n` +
        `2. Run ${chalk.cyan(`taskmaster log --id=${id} --prompt="..."`)} to log progress\n` +
        `3. Run ${chalk.cyan(`taskmaster set-status --id=${id} --status=done`)} to mark complete` :
        `1. Run ${chalk.cyan(`taskmaster set-status --id=${id} --status=in-progress`)} to start working\n` +
        `2. Run ${chalk.cyan(`taskmaster breakdown --id=${id}`)} to create subtasks\n` +
        `3. Run ${chalk.cyan(`taskmaster edit --id=${id} --prompt="..."`)} to update details`;

      console.log(
        boxen(
          chalk.white.bold('Suggested Actions:') + '\n\n' + suggestedActions,
          {
            padding: 1,
            borderColor: 'gray',
            borderStyle: 'round'
          }
        )
      );
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

  // Breakdown task command
  program
    .command('breakdown')
    .description('Break down a task into smaller steps using AI')
    .option('-i, --id <id>', 'Task ID to expand')
    .option('-n, --num <number>', 'Number of subtasks to generate', '5')
    .option('-p, --prompt <text>', 'Additional context for expansion')
    .option('--force', 'Replace existing subtasks')
    .option('-r, --research', 'Use research model')
    .option('--all', 'Expand all pending tasks')
    .action(async (options) => {
      const { displayBanner } = await import('../index.js');
      await displayBanner();
      
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      // Show tag context
      const currentTag = getCurrentTag(projectRoot);
      console.log(chalk.yellow('🏷 tag: ') + chalk.white.bold(currentTag));

      if (options.all) {
        // Expand all pending tasks without subtasks
        const tasks = getAllTasks(projectRoot);
        const toExpand = tasks.filter(t => 
          t.status === 'pending' && (!t.subtasks || t.subtasks.length === 0 || options.force)
        );

        // Check usage limit for all tasks
        const numSubtasks = parseInt(options.num) || 5;
        const totalSubtasks = toExpand.length * numSubtasks;
        try {
          enforceUsageLimit(totalSubtasks);
        } catch (limitError) {
          console.log('');
          console.log(
            boxen(
              chalk.red.bold('⚠️  Usage Limit Reached') + '\n\n' +
              chalk.white(limitError.message) + '\n\n' +
              chalk.dim('Upgrade your plan at ') + chalk.cyan('https://taskmaster.one/pricing'),
              { padding: 1, borderColor: 'red', borderStyle: 'round' }
            )
          );
          process.exit(1);
        }

        console.log(chalk.cyan(`Expanding ${toExpand.length} tasks...`));
        console.log('');

        for (const task of toExpand) {
          console.log(chalk.blue('[INFO]') + chalk.dim(` Expanding task ${task.id}: ${task.title}`));
          console.log(chalk.blue('[INFO]') + chalk.dim(` Using default number of subtasks: ${numSubtasks}`));
          
          try {
            console.log(chalk.dim('⏳ Generating subtasks...'));
            const subtasks = await aiExpandTask(task, {
              numSubtasks,
              research: options.research,
              prompt: options.prompt,
            });
            addSubtasks(task.id, subtasks, options.force, projectRoot);
            await incrementUsage('tasksExpanded', subtasks.length);
            console.log(chalk.green('✓') + chalk.white(` Task ${task.id}: Added ${subtasks.length} subtasks`));
            console.log('');
          } catch (error) {
            console.log(chalk.red('✗') + chalk.white(` Task ${task.id}: ${error.message}`));
            console.log('');
          }
        }
        
        console.log(chalk.green('✓ Expansion complete'));
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
            chalk.dim('Upgrade your plan at ') + chalk.cyan('https://taskmaster.one/pricing'),
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }

      console.log(chalk.cyan(`Expanding task ${options.id}...`));
      console.log(chalk.blue('[INFO]') + chalk.dim(` Expanding task ${options.id}: ${task.title}`));
      console.log(chalk.blue('[INFO]') + chalk.dim(` Using ${numSubtasks} subtasks`));
      console.log(chalk.dim('⏳ Generating subtasks...'));

      try {
        const subtasks = await aiExpandTask(task, {
          numSubtasks,
          research: options.research,
          prompt: options.prompt,
        });

        addSubtasks(options.id, subtasks, options.force, projectRoot);
        await incrementUsage('tasksExpanded', subtasks.length);

        console.log('');
        console.log(chalk.green('✓') + chalk.white.bold(` Added ${subtasks.length} subtasks to task ${options.id}`));
        console.log('');
        
        // Show generated subtasks
        subtasks.forEach((s, i) => {
          console.log(`  ${chalk.cyan(`${options.id}.${i + 1}`)} ${s.title}`);
        });
        console.log('');
        
        // Suggested actions
        console.log(
          boxen(
            chalk.white.bold('Suggested Actions:') + '\n\n' +
            chalk.white('1. Run ') + chalk.cyan(`taskmaster set-status --id=${options.id}.1 --status=in-progress`) + chalk.white(' to start working') + '\n' +
            chalk.white('2. Run ') + chalk.cyan(`taskmaster show ${options.id}`) + chalk.white(' to see task details'),
            {
              padding: 1,
              borderColor: 'gray',
              borderStyle: 'round'
            }
          )
        );
        console.log('');
      } catch (error) {
        console.error(chalk.red('[ERROR]'), error.message);
        process.exit(1);
      }
    });

  // Add task command
  program
    .command('new')
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
    .command('assess')
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

  // Add dependency command
  program
    .command('link')
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
    .command('unlink')
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
    .command('log')
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
    .command('edit')
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

  // ============================================
  // SCOPE ADJUSTMENT COMMANDS
  // ============================================

  // Scope up command
  program
    .command('scope-up')
    .description('Increase task complexity by adding more steps')
    .argument('<id>', 'Task ID to scope up')
    .option('-s, --strength <level>', 'Adjustment strength: light, regular, heavy', 'regular')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const tasksPath = getTasksFilePath(projectRoot);

      try {
        const result = await scopeUp(tasksPath, taskId, {
          strength: options.strength,
          projectRoot,
          context: getCurrentContext(projectRoot),
          outputFormat: options.json ? 'json' : 'text'
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
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

  // Scope down command
  program
    .command('scope-down')
    .description('Decrease task complexity by removing or combining steps')
    .argument('<id>', 'Task ID to scope down')
    .option('-s, --strength <level>', 'Adjustment strength: light, regular, heavy', 'regular')
    .option('--json', 'Output as JSON')
    .action(async (taskId, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const tasksPath = getTasksFilePath(projectRoot);

      try {
        const result = await scopeDown(tasksPath, taskId, {
          strength: options.strength,
          projectRoot,
          context: getCurrentContext(projectRoot),
          outputFormat: options.json ? 'json' : 'text'
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
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

  // ============================================
  // LICENSE MANAGEMENT COMMANDS
  // ============================================

  // Activate license command
  program
    .command('activate')
    .description('Activate TaskMaster AI with your license key')
    .argument('<license-key>', 'Your TaskMaster AI license key (e.g., tm_live_xxxxx)')
    .action(async (licenseKey) => {
      const loadingIndicator = startLoadingIndicator('Validating license key...');
      try {
        const result = await activateLicense(licenseKey);
        stopLoadingIndicator(loadingIndicator);

        if (result.success) {
          console.log(
            boxen(
              chalk.green.bold('✓ License Activated Successfully!') +
                '\n\n' +
                chalk.white('Plan: ') + chalk.cyan.bold(result.planName || result.plan) + '\n' +
                chalk.white('Tasks/month: ') + chalk.cyan(result.tasksPerMonth?.toLocaleString() || 'Unlimited') + '\n' +
                chalk.white('Expires: ') + chalk.cyan(new Date(result.expiresAt).toLocaleDateString()) + '\n\n' +
                chalk.dim('Your license is now active. You can start using TaskMaster AI!'),
              {
                padding: 1,
                margin: { top: 1 },
                borderColor: 'green',
                borderStyle: 'round'
              }
            )
          );
        } else {
          console.error(
            boxen(
              chalk.red.bold('✗ License Activation Failed') +
                '\n\n' +
                chalk.white(result.error || 'Invalid license key'),
              {
                padding: 1,
                margin: { top: 1 },
                borderColor: 'red',
                borderStyle: 'round'
              }
            )
          );
          process.exit(1);
        }
      } catch (error) {
        stopLoadingIndicator(loadingIndicator);
        console.error(chalk.red(`Error activating license: ${error.message}`));
        process.exit(1);
      }
    });

  // License status command
  program
    .command('license')
    .description('Show current license status')
    .option('-r, --refresh', 'Force refresh license status from server')
    .action(async (options) => {
      const loadingIndicator = options.refresh ? startLoadingIndicator('Validating license...') : null;
      try {
        const status = await getLicenseStatus(options.refresh);
        if (loadingIndicator) stopLoadingIndicator(loadingIndicator);

        if (status.valid) {
          console.log(
            boxen(
              chalk.green.bold('✓ License Active') + '\n\n' +
                formatLicenseStatus(status),
              {
                padding: 1,
                margin: { top: 1 },
                borderColor: 'green',
                borderStyle: 'round'
              }
            )
          );
        } else if (status.activated) {
          console.log(
            boxen(
              chalk.red.bold('✗ License Invalid') + '\n\n' +
                chalk.white(status.error || 'License has expired or been revoked.') + '\n\n' +
                chalk.dim('Visit https://taskmaster.one/app/billing to renew.'),
              {
                padding: 1,
                margin: { top: 1 },
                borderColor: 'red',
                borderStyle: 'round'
              }
            )
          );
        } else {
          console.log(
            boxen(
              chalk.yellow.bold('No License Activated') + '\n\n' +
                chalk.white('To use TaskMaster AI, you need a valid license.') + '\n\n' +
                chalk.cyan('1. Get your license key at ') + chalk.cyan.underline('https://taskmaster.one/pricing') + '\n' +
                chalk.cyan('2. Run: ') + chalk.green('taskmaster activate <your-license-key>'),
              {
                padding: 1,
                margin: { top: 1 },
                borderColor: 'yellow',
                borderStyle: 'round'
              }
            )
          );
        }
      } catch (error) {
        if (loadingIndicator) stopLoadingIndicator(loadingIndicator);
        console.error(chalk.red(`Error checking license: ${error.message}`));
        process.exit(1);
      }
    });

  // Deactivate license command
  program
    .command('deactivate')
    .description('Deactivate the current license on this machine')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        if (!options.yes) {
          const inquirer = (await import('inquirer')).default;
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Are you sure you want to deactivate your license on this machine?',
              default: false
            }
          ]);

          if (!confirm) {
            console.log(chalk.dim('Deactivation cancelled.'));
            return;
          }
        }

        const result = deactivateLicense();

        if (result.success) {
          console.log(chalk.green('✓ License deactivated successfully.'));
          console.log(chalk.dim('You can reactivate anytime with: taskmaster activate <license-key>'));
        } else {
          console.log(chalk.yellow(result.error || 'No license to deactivate.'));
        }
      } catch (error) {
        console.error(chalk.red(`Error deactivating license: ${error.message}`));
        process.exit(1);
      }
    });

  // Models command with interactive setup like official version
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

      // Helper to detect provider from model ID
      const getProviderFromModelId = (modelId) => {
        const id = modelId.toLowerCase();
        if (id.startsWith('claude-')) return 'anthropic';
        if (id.startsWith('gpt-') || id.startsWith('o3-') || id.startsWith('o4-')) return 'openai';
        if (id.startsWith('gemini-')) return 'google';
        if (id.startsWith('deepseek-')) return 'deepseek';
        if (id.startsWith('grok-')) return 'xai';
        if (id.startsWith('llama-')) return 'meta';
        if (id.startsWith('glm-')) return 'zhipu';
        if (id.startsWith('kimi-')) return 'moonshot';
        if (id.includes('sonar')) return 'perplexity';
        return null;
      };

      // Interactive setup mode
      if (options.setup) {
        console.log('');
        console.log(chalk.cyan('Starting interactive model setup...'));
        console.log('');
        
        console.log(
          boxen(
            chalk.hex('#7C3AED')('⚙ ') + chalk.white.bold('Interactive Model Setup') + '\n\n' +
            chalk.yellow('💡 ') + chalk.white.bold('Navigation:') + '\n' +
            chalk.dim('  • Use ↑↓ arrow keys to navigate') + '\n' +
            chalk.dim('  • Press Enter to select') + '\n' +
            chalk.dim('  • Models grouped by provider'),
            {
              padding: 1,
              borderColor: '#7C3AED',
              borderStyle: 'round'
            }
          )
        );
        console.log('');

        const inquirer = (await import('inquirer')).default;
        
        // Build model choices from AVAILABLE_MODELS object
        const buildModelChoices = (currentModel, role) => {
          const choices = [
            { 
              name: chalk.green('✓ ') + chalk.dim(`Keep current ${role} model (${currentModel})`),
              value: null,
              short: 'Keep current'
            },
          ];
          
          // Add models grouped by provider
          for (const [provider, models] of Object.entries(AVAILABLE_MODELS)) {
            choices.push(new inquirer.Separator(chalk.dim(`─── ${provider.charAt(0).toUpperCase() + provider.slice(1)} ───`)));
            for (const model of models) {
              choices.push({
                name: `${chalk.cyan(model.id)} ${chalk.dim(`- ${model.description}`)}`,
                value: { provider, id: model.id },
                short: model.id
              });
            }
          }
          
          // Add custom provider options
          choices.push(new inquirer.Separator(chalk.dim('─── Custom Providers ───')));
          choices.push({
            name: chalk.yellow('ollama') + chalk.dim(' - Enter custom model ID'),
            value: 'ollama-custom',
            short: 'Ollama Custom'
          });
          choices.push({
            name: chalk.yellow('openrouter') + chalk.dim(' - Enter custom model ID'),
            value: 'openrouter-custom',
            short: 'OpenRouter Custom'
          });
          
          return choices;
        };

        // Main model selection
        console.log(chalk.white('? ') + chalk.white.bold('Select the main model (for task generation/updates):'));
        const { mainModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'mainModel',
            message: '',
            choices: buildModelChoices(config.models.main.modelId, 'main'),
            pageSize: 15,
            loop: false,
          }
        ]);

        if (mainModel) {
          if (mainModel === 'ollama-custom' || mainModel === 'openrouter-custom') {
            const provider = mainModel === 'ollama-custom' ? 'ollama' : 'openrouter';
            const { customId } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customId',
                message: `Enter ${provider} model ID:`,
              }
            ]);
            config.models.main.provider = provider;
            config.models.main.modelId = customId;
          } else {
            config.models.main.provider = mainModel.provider;
            config.models.main.modelId = mainModel.id;
          }
        }

        // Research model selection
        console.log('');
        console.log(chalk.white('? ') + chalk.white.bold('Select the research model (for web-aware responses):'));
        const { researchModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'researchModel',
            message: '',
            choices: buildModelChoices(config.models.research.modelId, 'research'),
            pageSize: 15,
            loop: false,
          }
        ]);

        if (researchModel) {
          if (researchModel === 'ollama-custom' || researchModel === 'openrouter-custom') {
            const provider = researchModel === 'ollama-custom' ? 'ollama' : 'openrouter';
            const { customId } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customId',
                message: `Enter ${provider} model ID:`,
              }
            ]);
            config.models.research.provider = provider;
            config.models.research.modelId = customId;
          } else {
            config.models.research.provider = researchModel.provider;
            config.models.research.modelId = researchModel.id;
          }
        }

        // Fallback model selection
        console.log('');
        console.log(chalk.white('? ') + chalk.white.bold('Select the fallback model (used when main fails):'));
        const { fallbackModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'fallbackModel',
            message: '',
            choices: buildModelChoices(config.models.fallback.modelId, 'fallback'),
            pageSize: 15,
            loop: false,
          }
        ]);

        if (fallbackModel) {
          if (fallbackModel === 'ollama-custom' || fallbackModel === 'openrouter-custom') {
            const provider = fallbackModel === 'ollama-custom' ? 'ollama' : 'openrouter';
            const { customId } = await inquirer.prompt([
              {
                type: 'input',
                name: 'customId',
                message: `Enter ${provider} model ID:`,
              }
            ]);
            config.models.fallback.provider = provider;
            config.models.fallback.modelId = customId;
          } else {
            config.models.fallback.provider = fallbackModel.provider;
            config.models.fallback.modelId = fallbackModel.id;
          }
        }

        // Save configuration
        writeProjectConfig(config, projectRoot);
        console.log('');
        console.log(chalk.green('✓ Model configuration saved'));
        console.log('');
        console.log(chalk.white.bold('Current Configuration:'));
        console.log(`  ${chalk.cyan('Main:')} ${config.models.main.provider}/${config.models.main.modelId}`);
        console.log(`  ${chalk.cyan('Research:')} ${config.models.research.provider}/${config.models.research.modelId}`);
        console.log(`  ${chalk.cyan('Fallback:')} ${config.models.fallback.provider}/${config.models.fallback.modelId}`);
        console.log('');
        return;
      }

      if (options.setMain || options.setResearch || options.setFallback) {
        if (options.setMain) {
          const provider = getProviderFromModelId(options.setMain);
          if (provider) config.models.main.provider = provider;
          config.models.main.modelId = options.setMain;
        }
        if (options.setResearch) {
          const provider = getProviderFromModelId(options.setResearch);
          if (provider) config.models.research.provider = provider;
          config.models.research.modelId = options.setResearch;
        }
        if (options.setFallback) {
          const provider = getProviderFromModelId(options.setFallback);
          if (provider) config.models.fallback.provider = provider;
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

      // Show available models grouped by provider
      console.log(chalk.cyan.bold('Available Models:'));
      console.log('');
      
      for (const [provider, models] of Object.entries(AVAILABLE_MODELS)) {
        console.log(chalk.white.bold(`  ${provider.charAt(0).toUpperCase() + provider.slice(1)}:`));
        models.forEach(model => {
          console.log(`    ${chalk.cyan(model.id)} ${chalk.dim(`- ${model.description}`)}`);
        });
        console.log('');
      }
      
      console.log(chalk.dim('  Recommended:'));
      console.log(`    Main: ${chalk.cyan(RECOMMENDED_MODELS.main)}`);
      console.log(`    Research: ${chalk.cyan(RECOMMENDED_MODELS.research)}`);
      console.log(`    Fallback: ${chalk.cyan(RECOMMENDED_MODELS.fallback)}`);
      console.log('');

      // Check API keys (show source: env or dashboard)
      console.log(chalk.cyan.bold('API Key Status:'));
      const syncedApiKeys = cachedConfig?.apiKeys || {};
      const providers = ['anthropic', 'openai', 'google', 'perplexity', 'mistral', 'xai', 'openrouter', 'deepseek', 'zhipu', 'moonshot', 'meta'];
      providers.forEach(provider => {
        const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
        const syncedKey = syncedApiKeys[provider];
        
        if (envKey) {
          console.log(`  ${provider}: ${chalk.green('✓ Set')} ${chalk.dim('(from env)')}`);
        } else if (syncedKey) {
          console.log(`  ${provider}: ${chalk.green('✓ Set')} ${chalk.cyan('(from dashboard)')}`);
        } else {
          console.log(`  ${provider}: ${chalk.dim('○ Not set')}`);
        }
      });
      console.log('');
      console.log(chalk.dim('  Tip: Run ') + chalk.cyan('taskmaster models --setup') + chalk.dim(' for interactive configuration'));
      console.log(chalk.dim('  Configure API keys in the dashboard at ') + chalk.cyan('https://taskmaster.one/app/api-keys'));
      console.log('');
    });

  // Sync command - sync config from dashboard
  program
    .command('sync')
    .description('Sync API keys and model config from the TaskMaster dashboard')
    .option('-f, --force', 'Force sync even if cache is valid')
    .option('-u, --usage', 'Reconcile usage tracking between local and server')
    .action(async (options) => {
      const license = readStoredLicense();
      if (!license?.licenseKey) {
        console.log('');
        console.log(chalk.red('✗ No license activated. Run ') + chalk.cyan('taskmaster activate <license-key>') + chalk.red(' first.'));
        console.log('');
        process.exit(1);
      }

      console.log('');
      console.log(chalk.cyan('Syncing configuration from dashboard...'));
      console.log('');

      const ora = (await import('ora')).default;
      const spinner = ora('Connecting to TaskMaster servers...').start();

      try {
        const result = await syncUserConfig(options.force);
        spinner.stop();

        if (result.success) {
          console.log(chalk.green('✓ Configuration synced successfully'));
          console.log('');

          // Show synced API keys
          const apiKeys = result.apiKeys || {};
          const keyCount = Object.keys(apiKeys).length;
          if (keyCount > 0) {
            console.log(chalk.white.bold('API Keys synced:'));
            Object.keys(apiKeys).forEach(provider => {
              console.log(`  ${chalk.green('✓')} ${provider}`);
            });
            console.log('');
          } else {
            console.log(chalk.dim('No API keys found. Add them at ') + chalk.cyan('https://taskmaster.one/app/api-keys'));
            console.log('');
          }

          // Show synced models
          if (result.models) {
            console.log(chalk.white.bold('Model configuration synced:'));
            if (result.models.main) {
              console.log(`  Main: ${result.models.main}`);
            }
            if (result.models.research) {
              console.log(`  Research: ${result.models.research}`);
            }
            if (result.models.fallback) {
              console.log(`  Fallback: ${result.models.fallback}`);
            }
            console.log('');
          }

          if (result.cached) {
            console.log(chalk.dim('(Using cached configuration)'));
            if (result.offline) {
              console.log(chalk.yellow('⚠️  Could not reach server, using cached data'));
            }
          }

          console.log(chalk.dim('Last synced: ') + chalk.white(new Date(result.syncedAt).toLocaleString()));
          console.log('');
        } else {
          console.log(chalk.red('✗ Sync failed: ') + result.error);
          console.log('');
        }

        // Handle usage reconciliation
        if (options.usage) {
          console.log(chalk.cyan('Reconciling usage tracking...'));
          console.log('');
          
          try {
            const usageResult = await syncPendingUsage(true); // Force reconcile
            
            if (usageResult.success) {
              console.log(chalk.green('✓ ') + usageResult.message);
              if (usageResult.usage) {
                console.log(`  Server usage: ${usageResult.usage.tasksUsed}/${usageResult.usage.tasksPerMonth}`);
                console.log(`  Remaining: ${usageResult.usage.remaining}`);
              }
            } else {
              console.log(chalk.yellow('⚠️  Usage sync failed: ') + usageResult.error);
            }
            console.log('');
          } catch (usageError) {
            console.log(chalk.yellow('⚠️  Usage sync error: ') + usageError.message);
            console.log('');
          }
        }
      } catch (error) {
        spinner.stop();
        console.log(chalk.red('✗ Sync failed: ') + error.message);
        console.log('');
        process.exit(1);
      }
    });

  // Sync tasks to cloud dashboard
  program
    .command('sync-tasks')
    .description('Manually sync tasks to the TaskMaster web dashboard')
    .action(async () => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const license = readStoredLicense();
      if (!license?.licenseKey) {
        console.log('');
        console.log(chalk.red('✗ No license activated. Run ') + chalk.cyan('taskmaster activate <license-key>') + chalk.red(' first.'));
        console.log('');
        process.exit(1);
      }

      const ora = (await import('ora')).default;
      console.log('');
      const spinner = ora('Syncing tasks to cloud...').start();

      try {
        const { getAllTasks, getCurrentContext: getCurrentTag } = await import('../lib/tasks.js');
        const { syncTasksToCloud } = await import('../lib/license.js');
        const { loadConfig } = await import('../modules/config-manager.js');
        
        const tasks = getAllTasks(projectRoot);
        const tag = getCurrentTag(projectRoot);
        const config = loadConfig(projectRoot);
        const projectId = config?.projectName || path.basename(projectRoot);

        const result = await syncTasksToCloud(tasks, {
          projectId,
          tag,
          metadata: { updatedAt: new Date().toISOString() },
        });

        spinner.stop();

        if (result.success) {
          console.log(chalk.green('✓ Tasks synced successfully!'));
          console.log('');
          console.log(`  Project: ${chalk.cyan(projectId)}`);
          console.log(`  Tag:     ${chalk.cyan(tag)}`);
          console.log(`  Tasks:   ${chalk.cyan(tasks.length)}`);
          if (result.syncedAt) {
            console.log(`  Synced:  ${chalk.dim(new Date(result.syncedAt).toLocaleString())}`);
          }
          console.log('');
          console.log(chalk.dim('View your tasks at: ') + chalk.cyan('https://taskmaster.one/app/tasks'));
          console.log('');
        } else {
          console.log(chalk.red('✗ Sync failed: ') + (result.error || 'Unknown error'));
          console.log('');
          console.log(chalk.dim('Make sure you have an active license and internet connection.'));
          console.log('');
        }
      } catch (error) {
        spinner.stop();
        console.log(chalk.red('✗ Sync failed: ') + error.message);
        console.log('');
      }
    });

  // ============================================
  // TAG MANAGEMENT COMMANDS
  // ============================================

  // List tags command
  program
    .command('contexts')
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

  // Add context command
  program
    .command('context-add')
    .description('Create a new context')
    .argument('[name]', 'Context name (optional if using --from-branch)')
    .option('--from-branch', 'Create context from current git branch name')
    .option('--copy-from-current', 'Copy tasks from current context')
    .option('--copy-from <context>', 'Copy tasks from specified context')
    .option('-d, --description <text>', 'Context description')
    .action(async (name, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      const tasksPath = getTasksFilePath(projectRoot);

      try {
        // Handle --from-branch
        if (options.fromBranch) {
          await createContextFromBranch(tasksPath, {
            projectRoot,
            copyFromCurrent: options.copyFromCurrent,
            description: options.description,
            autoSwitch: true
          });
          return;
        }

        // Regular context creation requires a name
        if (!name) {
          console.error(chalk.red('Error: Context name is required (or use --from-branch)'));
          process.exit(1);
        }

        await createContext(tasksPath, name, {
          projectRoot,
          copyFrom: options.copyFrom,
          copyFromCurrent: options.copyFromCurrent,
          description: options.description,
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Switch context command
  program
    .command('use-context')
    .alias('context')
    .alias('switch')
    .description('Switch to a different context')
    .argument('<name>', 'Context name')
    .action(async (name) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      try {
        const tasksPath = getTasksFilePath(projectRoot);
        await useContext(tasksPath, name, { projectRoot });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Delete context command
  program
    .command('delete-context')
    .description('Delete a context and all its tasks')
    .argument('<name>', 'Context name')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (name, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      if (!options.yes) {
        const inquirer = (await import('inquirer')).default;
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete context '${name}' and all its tasks?`,
          default: false
        }]);

        if (!confirm) {
          console.log(chalk.yellow('Cancelled.'));
          return;
        }
      }

      try {
        const tasksPath = getTasksFilePath(projectRoot);
        await deleteContext(tasksPath, name, { projectRoot, force: true });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Rename context command
  program
    .command('rename-context')
    .description('Rename an existing context')
    .argument('<oldName>', 'Current context name')
    .argument('<newName>', 'New context name')
    .action(async (oldName, newName) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      try {
        const tasksPath = getTasksFilePath(projectRoot);
        await renameContext(tasksPath, oldName, newName, { projectRoot });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Clone context command
  program
    .command('clone')
    .description('Copy a context with all its tasks')
    .argument('<source>', 'Source context name')
    .argument('<target>', 'Target context name')
    .option('-d, --description <text>', 'Description for new context')
    .action(async (source, target, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      try {
        const tasksPath = getTasksFilePath(projectRoot);
        await cloneContext(tasksPath, source, target, { 
          projectRoot, 
          description: options.description 
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Sync README command
  program
    .command('sync-readme')
    .description('Sync tasks to README.md file')
    .option('-s, --status <status>', 'Filter tasks by status (comma-separated)')
    .option('--with-steps', 'Include steps in output')
    .option('--context <name>', 'Context to sync from')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      try {
        await syncReadme({
          projectRoot,
          status: options.status,
          withSteps: options.withSteps,
          context: options.context
        });
      } catch (error) {
        console.error(chalk.red('Error syncing README:'), error.message);
        process.exit(1);
      }
    });

  // Clear steps command
  program
    .command('clear-steps')
    .description('Clear all steps from one or more tasks')
    .option('-i, --id <ids>', 'Task ID(s) to clear steps from (comma-separated)')
    .option('--all', 'Clear steps from all tasks')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      const { clearSteps, clearAllSteps } = await import('../modules/index.js');
      const tasksPath = getTasksFilePath(projectRoot);

      try {
        if (options.all) {
          await clearAllSteps(tasksPath, { projectRoot });
        } else if (options.id) {
          await clearSteps(tasksPath, options.id, { projectRoot });
        } else {
          console.error(chalk.red('Error: Please specify task ID(s) with --id or use --all'));
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Remove step command
  program
    .command('remove-step')
    .description('Remove a step from a task')
    .requiredOption('-i, --id <id>', 'Step ID to remove (format: taskId.stepId)')
    .option('-c, --convert', 'Convert step to standalone task instead of deleting')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      const { removeStep } = await import('../modules/index.js');
      const tasksPath = getTasksFilePath(projectRoot);

      try {
        await removeStep(tasksPath, options.id, {
          projectRoot,
          convertToTask: options.convert
        });
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Set response language command
  program
    .command('set-language')
    .description('Set the response language for AI outputs')
    .argument('<language>', 'Language name or code (e.g., "Spanish", "ja", "French")')
    .action(async (language) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster AI project.'));
        process.exit(1);
      }

      const { setResponseLanguage } = await import('../modules/index.js');

      try {
        const result = setResponseLanguage(language, { projectRoot });
        if (!result.success) {
          console.error(chalk.red('Error:'), result.error?.message || 'Unknown error');
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Migrate project command
  program
    .command('migrate')
    .description('Migrate project to new TaskMaster AI structure')
    .option('--dry-run', 'Show what would be migrated without making changes')
    .option('-f, --force', 'Force migration even if already migrated')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      const { migrateProject } = await import('../modules/index.js');

      try {
        await migrateProject({
          dryRun: options.dryRun,
          force: options.force,
          yes: options.yes
        });
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
    .command('check-links')
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
    .command('fix-links')
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
    .command('add-step')
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
    .command('report')
    .description('Display the task complexity analysis report')
    .option('-f, --file <path>', 'Path to complexity report')
    .action(async (options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Not in a TaskMaster project.'));
        process.exit(1);
      }

      const reportPath = options.file || 
        path.join(projectRoot, '.taskmaster-ai', 'reports', 'complexity-report.json');

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
    .command('ask')
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

  // ==========================================
  // Rules Command - Manage rule profiles
  // ==========================================
  program
    .command('rules [action] [profiles...]')
    .description('Add or remove rules for one or more profiles. Actions: add, remove (e.g., taskmaster rules add windsurf roo)')
    .option('-f, --force', 'Skip confirmation prompt when removing rules')
    .option('--setup', 'Run interactive setup to select rule profiles to add')
    .addHelpText('after', `
Examples:
  $ taskmaster rules add windsurf roo          # Add Windsurf and Roo rule sets
  $ taskmaster rules remove windsurf           # Remove Windsurf rule set
  $ taskmaster rules --setup                   # Interactive setup to select rule profiles`)
    .action(async (action, profiles, options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error(chalk.red('Error: Could not find project root.'));
        process.exit(1);
      }

      try {
        // Dynamic import of rule-transformer to avoid circular dependencies
        const {
          isValidProfile,
          getRulesProfile,
          convertAllRulesToProfileRules,
          removeProfileRules,
          getInstalledProfiles,
          wouldRemovalLeaveNoProfiles,
          generateProfileSummary,
          generateProfileRemovalSummary,
          categorizeProfileResults,
          categorizeRemovalResults
        } = await import('../utils/rule-transformer.js');
        
        const { RULE_PROFILES } = await import('../constants/profiles.js');
        const { RULES_ACTIONS, RULES_SETUP_ACTION, isValidRulesAction } = await import('../constants/rules-actions.js');

        // Handle --setup flag for interactive profile selection
        if (options.setup) {
          const inquirer = (await import('inquirer')).default;
          
          const { selectedProfiles } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selectedProfiles',
            message: 'Select rule profiles to install:',
            choices: RULE_PROFILES.map(profile => ({
              name: profile.charAt(0).toUpperCase() + profile.slice(1),
              value: profile
            }))
          }]);

          if (!selectedProfiles || selectedProfiles.length === 0) {
            console.log(chalk.yellow('No profiles selected. Exiting.'));
            return;
          }

          console.log(chalk.blue(`Installing ${selectedProfiles.length} selected profile(s)...`));

          for (let i = 0; i < selectedProfiles.length; i++) {
            const profile = selectedProfiles[i];
            console.log(chalk.blue(`Processing profile ${i + 1}/${selectedProfiles.length}: ${profile}...`));

            if (!isValidProfile(profile)) {
              console.warn(`Rule profile for "${profile}" not found. Valid profiles: ${RULE_PROFILES.join(', ')}. Skipping.`);
              continue;
            }
            const profileConfig = getRulesProfile(profile);

            const addResult = convertAllRulesToProfileRules(projectRoot, profileConfig);
            console.log(chalk.green(generateProfileSummary(profile, addResult)));
          }

          console.log(chalk.green(`\nCompleted installation of all ${selectedProfiles.length} profile(s).`));
          return;
        }

        // Validate action for non-setup mode
        if (!action || !isValidRulesAction(action)) {
          console.error(chalk.red(`Error: Invalid or missing action '${action || 'none'}'. Valid actions are: ${Object.values(RULES_ACTIONS).join(', ')}`));
          console.error(chalk.yellow('For interactive setup, use: taskmaster rules --setup'));
          process.exit(1);
        }

        if (!profiles || profiles.length === 0) {
          console.error('Please specify at least one rule profile (e.g., windsurf, roo).');
          process.exit(1);
        }

        // Support both space- and comma-separated profile lists
        const expandedProfiles = profiles
          .flatMap((b) => b.split(',').map((s) => s.trim()))
          .filter(Boolean);

        if (action === RULES_ACTIONS.REMOVE) {
          let confirmed = true;
          if (!options.force) {
            const inquirer = (await import('inquirer')).default;
            
            // Check if this removal would leave no profiles remaining
            if (wouldRemovalLeaveNoProfiles(projectRoot, expandedProfiles)) {
              const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: chalk.yellow('This will remove ALL rule profiles. Are you sure?'),
                default: false
              }]);
              confirmed = confirm;
            } else {
              const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: `Remove rules for: ${expandedProfiles.join(', ')}?`,
                default: true
              }]);
              confirmed = confirm;
            }
          }
          if (!confirmed) {
            console.log(chalk.yellow('Aborted: No rules were removed.'));
            return;
          }
        }

        const removalResults = [];
        const addResults = [];

        for (const profile of expandedProfiles) {
          if (!isValidProfile(profile)) {
            console.warn(`Rule profile for "${profile}" not found. Valid profiles: ${RULE_PROFILES.join(', ')}. Skipping.`);
            continue;
          }
          const profileConfig = getRulesProfile(profile);

          if (action === RULES_ACTIONS.ADD) {
            console.log(chalk.blue(`Adding rules for profile: ${profile}...`));
            const addResult = convertAllRulesToProfileRules(projectRoot, profileConfig);
            console.log(chalk.blue(`Completed adding rules for profile: ${profile}`));

            addResults.push({
              profileName: profile,
              success: addResult.success,
              failed: addResult.failed
            });

            console.log(chalk.green(generateProfileSummary(profile, addResult)));
          } else if (action === RULES_ACTIONS.REMOVE) {
            console.log(chalk.blue(`Removing rules for profile: ${profile}...`));
            const result = removeProfileRules(projectRoot, profileConfig);
            removalResults.push(result);
            console.log(chalk.green(generateProfileRemovalSummary(profile, result)));
          }
        }

        // Print summary for additions
        if (action === RULES_ACTIONS.ADD && addResults.length > 0) {
          const { allSuccessfulProfiles, totalSuccess, totalFailed } = categorizeProfileResults(addResults);

          if (allSuccessfulProfiles.length > 0) {
            console.log(chalk.green(`\nSuccessfully processed profiles: ${allSuccessfulProfiles.join(', ')}`));

            if (totalSuccess > 0) {
              console.log(chalk.green(`Total: ${totalSuccess} files processed, ${totalFailed} failed.`));
            } else {
              console.log(chalk.green(`Total: ${allSuccessfulProfiles.length} profile(s) set up successfully.`));
            }
          }
        }

        // Print summary for removals
        if (action === RULES_ACTIONS.REMOVE && removalResults.length > 0) {
          const { successfulRemovals, skippedRemovals, failedRemovals, removalsWithNotices } = categorizeRemovalResults(removalResults);

          if (successfulRemovals.length > 0) {
            console.log(chalk.green(`\nSuccessfully removed profiles for: ${successfulRemovals.join(', ')}`));
          }
          if (skippedRemovals.length > 0) {
            console.log(chalk.yellow(`Skipped (default or protected): ${skippedRemovals.join(', ')}`));
          }
          if (failedRemovals.length > 0) {
            console.log(chalk.red('\nErrors occurred:'));
            failedRemovals.forEach((r) => {
              console.log(chalk.red(`  ${r.profileName}: ${r.error}`));
            });
          }
          if (removalsWithNotices.length > 0) {
            console.log(chalk.cyan('\nNotices:'));
            removalsWithNotices.forEach((r) => {
              console.log(chalk.cyan(`  ${r.profileName}: ${r.notice}`));
            });
          }

          const totalProcessed = removalResults.length;
          const totalSuccessful = successfulRemovals.length;
          const totalSkipped = skippedRemovals.length;
          const totalFailed = failedRemovals.length;

          console.log(chalk.blue(`\nTotal: ${totalProcessed} profile(s) processed - ${totalSuccessful} removed, ${totalSkipped} skipped, ${totalFailed} failed.`));
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // ==========================================
  // TUI Command - Terminal UI / REPL mode
  // ==========================================
  program
    .command('tui')
    .alias('repl')
    .description('Launch the interactive TUI/REPL mode')
    .action(async () => {
      const projectRoot = findProjectRoot();
      
      // Fallback to help if TUI not available
      console.log(chalk.yellow('TUI mode is launching...'));
      console.log(chalk.dim('Interactive terminal interface for TaskMaster AI\n'));
      
      // Simple REPL implementation
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('taskmaster> ')
      });
      
      console.log(chalk.blue.bold('TaskMaster AI Interactive Mode'));
      console.log(chalk.dim('Type "help" for commands, "exit" to quit\n'));
      
      rl.prompt();
      
      rl.on('line', async (line) => {
        const input = line.trim();
        
        if (!input) {
          rl.prompt();
          return;
        }
        
        if (input === 'exit' || input === 'quit') {
          console.log(chalk.green('Goodbye!'));
          rl.close();
          process.exit(0);
        }
        
        if (input === 'help') {
          console.log(`
${chalk.cyan.bold('Available Commands:')}
  ${chalk.white('list')}                - List all tasks
  ${chalk.white('next')}                - Show next task to work on  
  ${chalk.white('show <id>')}           - Show task details
  ${chalk.white('status <id> <status>')} - Set task status
  ${chalk.white('contexts')}            - List all contexts
  ${chalk.white('help')}                - Show this help
  ${chalk.white('exit')}                - Exit TUI mode
`);
          rl.prompt();
          return;
        }
        
        // Execute command
        try {
          const args = input.split(/\s+/);
          const cmd = args[0];
          
          if (cmd === 'list') {
            // Quick list
            const tasksPath = getTasksFilePath(projectRoot);
            const data = readJSON(tasksPath, projectRoot);
            if (data?.tasks) {
              console.log(chalk.blue.bold('\nTasks:'));
              data.tasks.forEach(t => {
                const statusColors = {
                  done: chalk.green,
                  'in-progress': chalk.yellow,
                  pending: chalk.gray,
                  blocked: chalk.red
                };
                const colorFn = statusColors[t.status] || chalk.white;
                console.log(`  ${chalk.cyan(t.id)}. ${t.title} [${colorFn(t.status)}]`);
              });
              console.log('');
            }
          } else if (cmd === 'contexts') {
            const contexts = listContexts(projectRoot);
            console.log(chalk.blue.bold('\nContexts:'));
            contexts.forEach(c => {
              const marker = c.isCurrent ? chalk.green('*') : ' ';
              console.log(`  ${marker} ${c.name}`);
            });
            console.log('');
          } else {
            console.log(chalk.yellow(`Unknown command: ${cmd}. Type "help" for commands.`));
          }
        } catch (error) {
          console.log(chalk.red(`Error: ${error.message}`));
        }
        
        rl.prompt();
      });
      
      rl.on('close', () => {
        process.exit(0);
      });
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
