/**
 * Utility functions for TaskMaster AI CLI
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Silent mode tracking
let silentMode = false;

/**
 * Set silent mode (suppresses console output)
 */
export function setSilentMode(value) {
  silentMode = value;
}

/**
 * Check if in silent mode
 */
export function isSilentMode() {
  return silentMode;
}

/**
 * Log levels and their priority
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Get current log level from environment
 */
function getLogLevel() {
  const level = process.env.TASKMASTER_LOG_LEVEL || 'info';
  return level.toLowerCase();
}

/**
 * Log a message with the specified level
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Message to log
 * @param {...any} args - Additional arguments
 */
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

/**
 * Read JSON file safely
 * @param {string} filePath - Path to JSON file
 * @param {string} projectRoot - Project root for relative paths
 * @param {string} context - Optional context name (TaskMaster AI uses "contexts" not "tags")
 * @returns {object|null} Parsed JSON or null on error
 */
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

/**
 * Write JSON file safely
 * @param {string} filePath - Path to JSON file
 * @param {object} data - Data to write
 */
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

/**
 * Truncate a string to a maximum length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string with ellipsis if needed
 */
export function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format a task ID for display
 * @param {string|number} taskId - Task ID
 * @returns {string} Formatted task ID
 */
export function formatTaskId(taskId) {
  if (taskId === null || taskId === undefined) return 'null';
  if (taskId === '') return '(empty)';
  return String(taskId);
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array/object)
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Find project root by looking for .taskmaster-ai directory
 * @param {string} startDir - Starting directory
 * @returns {string|null} Project root or null if not found
 */
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

/**
 * Get the config directory path for a project
 * @param {string} projectRoot - Project root path
 * @returns {string} Path to .taskmaster-ai config directory
 */
export function getConfigDir(projectRoot) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  return path.join(root, '.taskmaster-ai');
}

/**
 * Get the tasks file path for a project
 * @param {string} projectRoot - Project root path
 * @returns {string} Path to tasks.json file
 */
export function getTasksFilePath(projectRoot) {
  return path.join(getConfigDir(projectRoot), 'tasks', 'tasks.json');
}

/**
 * Find a task by ID (supports dot notation for steps)
 * TaskMaster AI uses "steps" instead of "subtasks"
 * @param {Array} tasks - Array of tasks
 * @param {string|number} taskId - Task ID
 * @param {object} assessmentReport - Optional assessment report
 * @param {string} statusFilter - Optional status filter
 * @returns {object} Object with task, originalStepCount, originalSteps
 */
export function findTaskById(tasks, taskId, assessmentReport = null, statusFilter = null) {
  const idStr = String(taskId);
  
  // Check if it's a step ID (e.g., "1.2")
  if (idStr.includes('.')) {
    const [parentId, stepId] = idStr.split('.').map(Number);
    const parentTask = tasks.find(t => t.id === parentId);
    
    // Support both "steps" (new) and "subtasks" (legacy) field names
    const steps = parentTask?.steps || parentTask?.subtasks;
    
    if (parentTask && steps) {
      const step = steps.find(s => s.id === stepId);
      if (step) {
        // Add assessment score if available
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
  
  // Regular task ID
  const task = tasks.find(t => t.id === Number(taskId));
  
  if (!task) {
    return { task: null, originalStepCount: null, originalSteps: null };
  }
  
  // Support both "steps" (new) and "subtasks" (legacy) field names
  const steps = task.steps || task.subtasks || [];
  
  // Store original step info before filtering
  const originalSteps = [...steps];
  const originalStepCount = originalSteps.length;
  
  // Add assessment score if available
  if (assessmentReport) {
    addAssessmentToTask(task, assessmentReport);
  }
  
  // Apply status filter to steps if specified
  if (statusFilter && steps.length > 0) {
    const filteredSteps = steps.filter(st => 
      st.status && st.status.toLowerCase() === statusFilter.toLowerCase()
    );
    // Use whichever field name is present
    if (task.steps) {
      task.steps = filteredSteps;
    } else if (task.subtasks) {
      task.subtasks = filteredSteps;
    }
  }
  
  return { task, originalStepCount, originalSteps };
}

/**
 * Add assessment score to a task from the assessment report
 * TaskMaster AI uses "assessment" instead of "complexity"
 * @param {object} task - Task object
 * @param {object} assessmentReport - Assessment report
 */
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

/**
 * Read assessment report from file
 * TaskMaster AI uses "assessment" instead of "complexity"
 * @param {string} reportPath - Path to assessment report
 * @returns {object|null} Assessment report or null
 */
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

/**
 * Resolve environment variable from various sources
 * @param {string} name - Environment variable name
 * @param {object} session - MCP session (optional)
 * @param {string} projectRoot - Project root for .env file
 * @returns {string|null} Environment variable value
 */
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
