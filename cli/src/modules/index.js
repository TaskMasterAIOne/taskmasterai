/**
 * TaskMaster AI Modules Hub
 * Central export point for all CLI modules
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TERMINOLOGY GUIDE:
 * - "steps" instead of "subtasks"
 * - "links" instead of "dependencies"
 * - "assessment" instead of "complexity"
 * - "contexts" instead of "tags"
 * - "breakdown" instead of "expand"
 * - "plan" instead of "parse-prd"
 * - "edit" instead of "update-task"
 * - "ask" instead of "research"
 * - "scope-up/scope-down" for complexity adjustment
 */

// Core utilities
export * from './utils.js';

// UI components
export * from './ui.js';

// Task management - all exports from task-manager
export {
  // Core operations
  findNextTask,
  listTasks,
  setStatus,
  showTask,
  
  // Status & Priority
  isValidStatus,
  TASK_STATUS_OPTIONS,
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
  
  // Sync README
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
  taskExists as taskExistsInList,
  findTask,
  getParentTask,
} from './task-manager/index.js';

// Link (dependency) management
export {
  addLink,
  removeLink,
  isCircularLink,
  validateLinks,
  checkLinksCommand,
  fixLinksCommand,
  taskExists,
  countAllLinks
} from './link-manager.js';

// Context (tag) management
export {
  getCurrentContext,
  setCurrentContext,
  getTasksForContext,
  listContexts,
  createContext,
  useContext,
  deleteContext,
  cloneContext,
  renameContext,
  createContextFromBranch
} from './context-manager.js';

// Config management
export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  clearConfigCache,
  resetToDefaults,
  getSupportedModels,
  getAllModelIds,
  findModelById,
  validateProvider,
  validateModelId,
  getModelConfig,
  setModelForRole,
  getDebugFlag,
  getLogLevel,
  getProjectName,
  getDefaultPriority,
  getDefaultSteps,
  hasCodebaseAnalysis,
  isApiKeySet,
  getApiKey,
  DEFAULTS as CONFIG_DEFAULTS,
  ALL_PROVIDERS,
  MODEL_MAP
} from './config-manager.js';

// Import for default export
import * as utils from './utils.js';
import * as ui from './ui.js';
import taskManager from './task-manager/index.js';
import linkManager from './link-manager.js';
import contextManager from './context-manager.js';
import configManager from './config-manager.js';

// Utility classes
import { ContextGatherer } from './utils/context-gatherer.js';
import { FuzzyTaskSearch } from './utils/fuzzy-search.js';
import * as gitUtils from './utils/git-utils.js';

export { ContextGatherer, FuzzyTaskSearch, gitUtils };

// Supported models - use createRequire for JSON imports
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SUPPORTED_MODELS = require('./supported-models.json');

export { SUPPORTED_MODELS };

// Default export with all modules grouped
export default {
  utils,
  ui,
  taskManager,
  linkManager,
  contextManager,
  configManager,
  ContextGatherer,
  FuzzyTaskSearch,
  gitUtils,
  SUPPORTED_MODELS
};
