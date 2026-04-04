
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  isSilentMode,
  findProjectRoot,
  getConfigDir
} from '../utils.js';

async function initProject(options = {}) {
  const {
    name = 'TaskMaster AI Project',
    description = '',
    version = '0.1.0',
    force = false,
    skipGit = false,
    outputFormat = 'text'
  } = options;
  
  const projectRoot = findProjectRoot() || process.cwd();
  const configDir = getConfigDir(projectRoot);
  
  try {
    if (fs.existsSync(configDir) && !force) {
      const message = 'Project already initialized. Use --force to reinitialize.';
      log('warn', message);
      
      if (outputFormat === 'json') {
        return { success: false, error: message };
      }
      
      console.log(chalk.yellow(`⚠ ${message}`));
      return { success: false };
    }
    
    log('info', `Initializing TaskMaster AI project in ${projectRoot}`);
    const directories = [
      configDir,
      path.join(configDir, 'tasks'),
      path.join(configDir, 'docs'),
      path.join(configDir, 'docs', 'research'),
      path.join(configDir, 'reports'),
      path.join(configDir, 'templates')
    ];
    
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        log('debug', `Created directory: ${dir}`);
      }
    }
    const configPath = path.join(configDir, 'config.json');
    const config = {
      projectName: name,
      projectDescription: description,
      version,
      models: {
        main: {
          provider: 'anthropic',
          modelId: 'claude-sonnet-4-6',
          maxTokens: 64000,
          temperature: 0.2
        },
        research: {
          provider: 'perplexity',
          modelId: 'sonar-pro',
          maxTokens: 8700,
          temperature: 0.1
        },
        fallback: {
          provider: 'google',
          modelId: 'gemini-2.5-flash',
          maxTokens: 1048000,
          temperature: 0.2
        }
      },
      global: {
        logLevel: 'info',
        debug: false,
        defaultNumTasks: 10,
        defaultSteps: 5,
        defaultPriority: 'medium',
        responseLanguage: 'English',
        enableCodebaseAnalysis: true
      },
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log('info', 'Created config.json');
    const statePath = path.join(configDir, 'state.json');
    const state = {
      currentContext: 'main',
      lastSwitched: new Date().toISOString(),
      migrationNoticeShown: true
    };
    
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    log('info', 'Created state.json');
    const tasksPath = path.join(configDir, 'tasks', 'tasks.json');
    const tasksData = {
      main: {
        tasks: [],
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          description: 'Main task context'
        }
      }
    };
    
    fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
    log('info', 'Created tasks.json');
    const templatePath = path.join(configDir, 'templates', 'example_prd.txt');
    const examplePRD = `# Product Requirements Document Template

## Project Overview
[Describe your project in 2-3 sentences]

## Goals
- Goal 1: [Primary objective]
- Goal 2: [Secondary objective]

## Features

### Feature 1: [Feature Name]
Description: [What this feature does]
Priority: High/Medium/Low
Requirements:
- Requirement 1
- Requirement 2

### Feature 2: [Feature Name]
Description: [What this feature does]
Priority: High/Medium/Low
Requirements:
- Requirement 1
- Requirement 2

## Technical Requirements
- [Tech requirement 1]
- [Tech requirement 2]

## Success Criteria
- [How will you measure success?]

## Timeline
- Phase 1: [Description]
- Phase 2: [Description]

---
To use this template:
1. Copy this file to .taskmaster-ai/docs/prd.txt
2. Fill in your project details
3. Run: taskmaster plan .taskmaster-ai/docs/prd.txt
`;
    
    fs.writeFileSync(templatePath, examplePRD);
    log('info', 'Created example PRD template');
    if (!skipGit) {
      const gitignorePath = path.join(projectRoot, '.gitignore');
      const gitignoreEntries = [
        '',
        '# TaskMaster AI',
        '.taskmaster-ai/reports/',
        '.taskmaster-ai/docs/research/'
      ].join('\n');
      
      if (fs.existsSync(gitignorePath)) {
        const currentContent = fs.readFileSync(gitignorePath, 'utf-8');
        if (!currentContent.includes('TaskMaster AI')) {
          fs.appendFileSync(gitignorePath, gitignoreEntries);
          log('info', 'Updated .gitignore');
        }
      }
    }
    
    log('success', 'Project initialized successfully');
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        projectRoot,
        configDir,
        config
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ TaskMaster AI Initialized') +
            `\n\n${chalk.cyan('Project:')} ${name}` +
            `\n${chalk.cyan('Location:')} ${configDir}` +
            '\n\n' +
            chalk.white.bold('Created:') +
            '\n  • config.json' +
            '\n  • state.json' +
            '\n  • tasks/tasks.json' +
            '\n  • templates/example_prd.txt' +
            '\n\n' +
            chalk.white.bold('Next Steps:') +
            `\n  1. ${chalk.cyan('taskmaster models --setup')} - Configure AI models` +
            `\n  2. Create a PRD in ${chalk.gray('.taskmaster-ai/docs/')}` +
            `\n  3. ${chalk.cyan('taskmaster plan <prd-file>')} - Generate tasks`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    }
    
    return { success: true };
    
  } catch (error) {
    log('error', `Init error: ${error.message}`);
    throw error;
  }
}

function isProjectInitialized(projectRoot = null) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const configDir = getConfigDir(root);
  const configPath = path.join(configDir, 'config.json');
  
  return fs.existsSync(configPath);
}

export { initProject, isProjectInitialized };
export default initProject;
