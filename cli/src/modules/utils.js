
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Silent mode tracking
let silentMode = false;

export function setSilentMode(value) {
  silentMode = value;
}

export function isSilentMode() {
  return silentMode;
}

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function getLogLevel() {
  const level = process.env.TASKMASTER_LOG_LEVEL || 'info';
  return level.toLowerCase();
}

export function log(level, message, ...args) {
  if (isSilentMode()) return;
  
  const currentLevel = LOG_LEVELS[getLogLevel()] ?? LOG_LEVELS.info;
  const messageLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  
  if (messageLevel > currentLevel) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  switch (level) {
    case 'error':
      console.error(chalk.red(`${prefix} ${message}`), ...args);
      break;
    case 'warn':
      console.warn(chalk.yellow(`${prefix} ${message}`), ...args);
      break;
    case 'info':
      console.log(chalk.blue(`${prefix} ${message}`), ...args);
      break;
    case 'debug':
      console.log(chalk.gray(`${prefix} ${message}`), ...args);
      break;
    default:
      console.log(message, ...args);
  }
}

export function readJSON(filePath, projectRoot = null, context = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Handle context-based task structure
    if (context && parsed.contexts) {
      return {
        tasks: parsed.contexts[context]?.tasks || [],
        metadata: parsed.contexts[context]?.metadata || {},
      };
    }
    
    // Handle legacy format (array of tasks)
    if (Array.isArray(parsed)) {
      return { tasks: parsed };
    }
    
    // Handle object with tasks array
    if (parsed.tasks && Array.isArray(parsed.tasks)) {
      return parsed;
    }
    
    // Handle context format - get current context
    if (parsed.contexts) {
      const defaultContext = 'main';
      return {
        tasks: parsed.contexts[defaultContext]?.tasks || [],
        metadata: parsed.contexts[defaultContext]?.metadata || {},
      };
    }
    
    return parsed;
  } catch (error) {
    log('error', `Error reading JSON file: ${error.message}`);
    return null;
  }
}

export function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    log('error', `Error writing JSON file: ${error.message}`);
    return false;
  }
}

export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

export function formatTaskId(taskId) {
  if (taskId === null || taskId === undefined) return 'null';
  if (taskId === '') return '(empty)';
  return String(taskId);
}

export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const configDir = path.join(currentDir, '.taskmaster-ai');
    if (fs.existsSync(configDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

export function getConfigDir(projectRoot) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  return path.join(root, '.taskmaster-ai');
}

export function getTasksFilePath(projectRoot) {
  return path.join(getConfigDir(projectRoot), 'tasks', 'tasks.json');
}

export function findTaskById(tasks, taskId, assessmentReport = null, statusFilter = null) {
  const idStr = String(taskId);
  if (idStr.includes('.')) {
    const [parentId, stepId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    // Support both "steps" (new) and "subtasks" (legacy) field names
    const steps = parentTask?.steps || parentTask?.subtasks;
    
    if (parentTask && steps) {
      const step = steps.find(s => s.id === stepId);
      if (step) {
        if (assessmentReport) {
          addAssessmentToTask(step, assessmentReport);
        }
        
        return {
          task: {
            ...step,
            parentId,
            parentTask,
            isStep: true,
          },
          originalStepCount: null,
          originalSteps: null,
        };
      }
    }
    return { task: null, originalStepCount: null, originalSteps: null };
  }
  
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task) {
    return { task: null, originalStepCount: null, originalSteps: null };
  }
  
  // Support both "steps" (new) and "subtasks" (legacy) field names
  const steps = task.steps || task.subtasks || [];
  const originalSteps = [...steps];
  const originalStepCount = originalSteps.length;
  if (assessmentReport) {
    addAssessmentToTask(task, assessmentReport);
  }
  
  // Apply status filter to steps if specified
  if (statusFilter && steps.length > 0) {
    const filteredSteps = steps.filter(st => 
      st.status && st.status.toLowerCase() === statusFilter.toLowerCase()
    );
    if (task.steps) {
      task.steps = filteredSteps;
    } else if (task.subtasks) {
      task.subtasks = filteredSteps;
    }
  }
  
  return { task, originalStepCount, originalSteps };
}

export function addAssessmentToTask(task, assessmentReport) {
  // Support both "assessment" (new) and "complexityAnalysis" (legacy) field names
  const analysis = assessmentReport?.assessment || assessmentReport?.complexityAnalysis;
  if (!analysis) return;
  
  const taskId = typeof task.id === 'string' && task.id.includes('.') 
    ? Number(task.id.split('.')[0])
    : task.id;
  
  const taskAssessment = analysis.find(
    a => a.taskId === taskId
  );
  
  if (taskAssessment) {
    // Support both naming conventions
    task.assessmentScore = taskAssessment.assessmentScore || taskAssessment.complexityScore;
    task.recommendedSteps = taskAssessment.recommendedSteps || taskAssessment.recommendedSubtasks;
    task.breakdownPrompt = taskAssessment.breakdownPrompt || taskAssessment.expansionPrompt;
  }
}

export function readAssessmentReport(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(reportPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    log('warn', `Could not read assessment report: ${error.message}`);
    return null;
  }
}

export function resolveEnvVariable(name, session = null, projectRoot = null) {
  // Priority 1: process.env
  if (process.env[name]) {
    return process.env[name];
  }
  
  // Priority 2: MCP session env
  if (session?.env?.[name]) {
    return session.env[name];
  }
  
  // Priority 3: .env file in project root
  if (projectRoot) {
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
        if (match) {
          return match[1].trim().replace(/^["']|["']$/g, '');
        }
      } catch (error) {
        // Ignore errors
      }
    }
  }
  
  return null;
}

export default {
  setSilentMode,
  isSilentMode,
  log,
  readJSON,
  writeJSON,
  truncate,
  formatTaskId,
  isEmpty,
  findProjectRoot,
  findTaskById,
  addAssessmentToTask,
  readAssessmentReport,
  resolveEnvVariable,
};
