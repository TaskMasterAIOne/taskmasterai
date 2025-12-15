
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode,
  truncate,
  getConfigDir
} from '../utils.js';
import {
  startLoadingIndicator,
  stopLoadingIndicator
} from '../ui.js';

async function plan(prdPath, options = {}) {
  const {
    output,
    numTasks = 10,
    force = false,
    append = false,
    projectRoot,
    context = 'main',
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    // Validate PRD file exists
    const fullPrdPath = path.isAbsolute(prdPath) 
      ? prdPath 
      : path.join(projectRoot || process.cwd(), prdPath);
    
    if (!fs.existsSync(fullPrdPath)) {
      throw new Error(`PRD file not found: ${fullPrdPath}`);
    }
    
    log('info', `Generating tasks from PRD: ${prdPath}`);
    const prdContent = fs.readFileSync(fullPrdPath, 'utf-8');
    
    if (!prdContent || prdContent.trim().length < 50) {
      throw new Error('PRD file is too short or empty');
    }
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator('Analyzing PRD and generating tasks...');
    }
    
    // Determine output path
    const configDir = getConfigDir(projectRoot);
    const tasksDir = path.join(configDir, 'tasks');
    const tasksPath = output || path.join(tasksDir, 'tasks.json');
    
    // Ensure directories exist
    if (!fs.existsSync(tasksDir)) {
      fs.mkdirSync(tasksDir, { recursive: true });
    }
    let existingData = null;
    if (fs.existsSync(tasksPath)) {
      existingData = readJSON(tasksPath, projectRoot, context);
      
      if (existingData?.tasks?.length > 0 && !force && !append) {
        if (loadingIndicator) {
          stopLoadingIndicator(loadingIndicator, 'Existing tasks found');
        }
        throw new Error(
          'Tasks file already exists. Use --force to overwrite or --append to add to existing.'
        );
      }
    }
    
    // Parse PRD and generate tasks
    // In production, this would use AI to intelligently parse
    const generatedTasks = parsePRDContent(prdContent, numTasks);
    
    // Build tasks data
    let tasksData;
    
    if (append && existingData?.[context]?.tasks) {
      // Append mode - add to existing tasks
      const existingTasks = existingData[context].tasks;
      const maxId = existingTasks.length > 0 
        ? Math.max(...existingTasks.map(t => t.id))
        : 0;
      
      // Renumber generated tasks
      const renumberedTasks = generatedTasks.map((task, idx) => ({
        ...task,
        id: maxId + idx + 1
      }));
      
      tasksData = {
        ...existingData,
        [context]: {
          ...existingData[context],
          tasks: [...existingTasks, ...renumberedTasks],
          metadata: {
            ...existingData[context]?.metadata,
            updated: new Date().toISOString()
          }
        }
      };
    } else {
      // Replace mode
      tasksData = {
        [context]: {
          tasks: generatedTasks,
          metadata: {
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            description: `Tasks generated from ${path.basename(prdPath)}`,
            prdSource: prdPath
          }
        }
      };
      
      // Preserve other contexts if they exist
      if (existingData) {
        for (const [key, value] of Object.entries(existingData)) {
          if (key !== context && key !== '_rawTaggedData') {
            tasksData[key] = value;
          }
        }
      }
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Generated ${generatedTasks.length} tasks`);
    }
    
    // Write tasks
    fs.writeFileSync(tasksPath, JSON.stringify(tasksData, null, 2));
    
    log('success', `Generated ${generatedTasks.length} tasks from PRD`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        tasksPath,
        context,
        tasksGenerated: generatedTasks.length,
        tasks: generatedTasks
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Tasks Generated Successfully') +
            `\n\n${chalk.cyan('PRD:')} ${prdPath}` +
            `\n${chalk.cyan('Tasks created:')} ${generatedTasks.length}` +
            `\n${chalk.cyan('Context:')} ${context}` +
            `\n${chalk.cyan('Output:')} ${tasksPath}` +
            `\n\n${chalk.white.bold('Generated Tasks:')}` +
            generatedTasks.slice(0, 5).map(t => 
              `\n  ${chalk.cyan('#' + t.id)} ${t.title}`
            ).join('') +
            (generatedTasks.length > 5 ? `\n  ${chalk.gray(`... and ${generatedTasks.length - 5} more`)}` : ''),
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
      
      // Next steps
      console.log(
        boxen(
          chalk.white.bold('Next Steps:') +
            `\n\n${chalk.cyan('View all tasks:')} taskmaster list` +
            `\n${chalk.cyan('Assess complexity:')} taskmaster assess` +
            `\n${chalk.cyan('Start working:')} taskmaster next`,
          {
            padding: 1,
            borderColor: 'gray',
            borderStyle: 'round',
            margin: { top: 1 }
          }
        )
      );
    }
    
    return {
      success: true,
      tasksGenerated: generatedTasks.length
    };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error generating plan: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

function parsePRDContent(content, targetCount) {
  const tasks = [];
  
  // Simple heuristic parsing - look for sections and requirements
  const lines = content.split('\n');
  let currentSection = null;
  let taskId = 1;
  
  for (const line of lines) {
    const headerMatch = line.match(/^#+\s+(.+)/) || line.match(/^\d+\.\s+(.+)/);
    
    if (headerMatch && tasks.length < targetCount) {
      const title = headerMatch[1].trim();
      
      // Skip certain sections
      if (/^(overview|introduction|background|summary|conclusion)/i.test(title)) {
        currentSection = title;
        continue;
      }
      
      tasks.push({
        id: taskId++,
        title: truncateTitle(title),
        description: `Implement: ${title}`,
        status: 'pending',
        priority: determinePriority(title, line),
        dependencies: taskId > 1 ? [taskId - 2] : [], // Simple linear dependency
        links: taskId > 1 ? [taskId - 2] : [],
        steps: [],
        subtasks: [],
        details: null,
        testStrategy: `Verify ${title.toLowerCase()} works as specified`,
        createdAt: new Date().toISOString()
      });
      
      currentSection = title;
    }
  }
  while (tasks.length < Math.min(targetCount, 5)) {
    const id = tasks.length + 1;
    tasks.push({
      id,
      title: `Task ${id}: [Review PRD for details]`,
      description: 'Task generated from PRD - review and refine',
      status: 'pending',
      priority: 'medium',
      dependencies: id > 1 ? [id - 1] : [],
      links: id > 1 ? [id - 1] : [],
      steps: [],
      subtasks: [],
      details: null,
      testStrategy: 'Define test strategy based on requirements',
      createdAt: new Date().toISOString()
    });
  }
  
  return tasks;
}

function truncateTitle(title) {
  if (title.length <= 60) return title;
  return title.substring(0, 57) + '...';
}

function determinePriority(title, line) {
  const text = (title + ' ' + line).toLowerCase();
  
  if (/critical|urgent|important|must|required|essential/i.test(text)) {
    return 'high';
  }
  if (/optional|nice.to.have|future|later|maybe/i.test(text)) {
    return 'low';
  }
  
  return 'medium';
}

export default plan;
