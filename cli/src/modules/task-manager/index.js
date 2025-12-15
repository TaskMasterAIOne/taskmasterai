
// Core task operations
import findNextTask from './find-next-task.js';
import listTasks from './list-tasks.js';
import setStatus, { isValidStatus, TASK_STATUS_OPTIONS } from './set-status.js';
import showTask from './show-task.js';

// Step operations
import logStep from './log-step.js';
import addStep from './add-step.js';
import { removeStep, removeMultipleSteps } from './remove-step.js';
import { clearSteps, clearAllSteps } from './clear-steps.js';

// Task creation/modification
import newTask, { TASK_PRIORITY_OPTIONS, DEFAULT_PRIORITY } from './new-task.js';
import removeTask from './remove-task.js';
import moveTask from './move-task.js';
import editTask, { editTasks } from './edit-task.js';

// Task breakdown
import breakdownTask, { breakdownAll } from './breakdown.js';

// Task assessment
import assessComplexity, { showAssessmentReport } from './assess.js';

// AI-powered features
import ask from './ask.js';
import plan from './plan.js';

// Scope adjustment
import { scopeUp, scopeDown, validateStrength, VALID_STRENGTHS } from './scope.js';

// Initialization & generation
import initProject, { isProjectInitialized } from './init.js';
import generateTaskFiles, { generateTaskMarkdown, generateSingleTaskFile } from './generate.js';
import syncReadme, { generateTaskListMarkdown, generateProgressStats } from './sync-readme.js';

// Response language (i18n)
import setResponseLanguage, { getResponseLanguage, getSupportedLanguages } from './response-language.js';

// Migration utilities
import migrateProject, { analyzeMigrationNeeds, isMigrationNeeded } from './migrate.js';

// Model management
import {
  showModelsConfig,
  listAvailableModels,
  setRoleModel,
  fetchOpenRouterModels,
  fetchOllamaModels
} from './models.js';

// Utility functions
import { isTaskLinkedTo, isTaskDependentOn } from './is-linked.js';
import { taskExists, findTask, getParentTask } from './task-exists.js';

// Re-export all task manager functions
export {
  // Core task operations
  findNextTask,
  listTasks,
  setStatus,
  showTask,
  
  // Status utilities
  isValidStatus,
  TASK_STATUS_OPTIONS,
  
  // Priority utilities
  TASK_PRIORITY_OPTIONS,
  DEFAULT_PRIORITY,
  
  // Step operations
  logStep,
  addStep,
  removeStep,
  removeMultipleSteps,
  clearSteps,
  clearAllSteps,
  
  // Task creation/modification
  newTask,
  removeTask,
  moveTask,
  editTask,
  editTasks,
  
  // Task breakdown
  breakdownTask,
  breakdownAll,
  
  // Task assessment
  assessComplexity,
  showAssessmentReport,
  
  // AI-powered features
  ask,
  plan,
  
  // Scope adjustment
  scopeUp,
  scopeDown,
  validateStrength,
  VALID_STRENGTHS,
  
  // Initialization & generation
  initProject,
  isProjectInitialized,
  generateTaskFiles,
  generateTaskMarkdown,
  generateSingleTaskFile,
  syncReadme,
  generateTaskListMarkdown,
  generateProgressStats,
  
  // Response language (i18n)
  setResponseLanguage,
  getResponseLanguage,
  getSupportedLanguages,
  
  // Migration utilities
  migrateProject,
  analyzeMigrationNeeds,
  isMigrationNeeded,
  
  // Model management
  showModelsConfig,
  listAvailableModels,
  setRoleModel,
  fetchOpenRouterModels,
  fetchOllamaModels,
  
  // Utility functions
  isTaskLinkedTo,
  isTaskDependentOn,
  taskExists,
  findTask,
  getParentTask,
};

export default {
  // Core
  findNextTask,
  listTasks,
  setStatus,
  showTask,
  
  // Status/Priority
  isValidStatus,
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  DEFAULT_PRIORITY,
  
  // Steps
  logStep,
  addStep,
  removeStep,
  removeMultipleSteps,
  clearSteps,
  clearAllSteps,
  
  // Tasks
  newTask,
  removeTask,
  moveTask,
  editTask,
  editTasks,
  
  // Breakdown
  breakdownTask,
  breakdownAll,
  
  // Assessment
  assessComplexity,
  showAssessmentReport,
  
  // AI Features
  ask,
  plan,
  
  // Scope
  scopeUp,
  scopeDown,
  validateStrength,
  
  // Init/Generate
  initProject,
  isProjectInitialized,
  generateTaskFiles,
  syncReadme,
  
  // Response Language (i18n)
  setResponseLanguage,
  getResponseLanguage,
  getSupportedLanguages,
  
  // Migration
  migrateProject,
  analyzeMigrationNeeds,
  isMigrationNeeded,
  
  // Models
  showModelsConfig,
  listAvailableModels,
  setRoleModel,
  
  // Utils
  isTaskLinkedTo,
  taskExists,
  findTask,
  getParentTask,
};
