import { registerTaskTools } from './task-tools.js';
import { registerStatusTools } from './status-tools.js';
import { registerAnalysisTools } from './analysis-tools.js';
import { registerDependencyTools } from './dependency-tools.js';
import { registerTagTools } from './tag-tools.js';
import { registerAutopilotTools } from './autopilot-tools.js';
import { registerConfigTools } from './config-tools.js';

export const TOOL_TIERS = {
  // Core: Essential task management for daily development (7 tools)
  // Based on  coreTools
  core: ['status-core', 'analysis-core'],
  
  // Standard: Core + expanded operations (15 tools)
  // Based on  standardTools
  standard: ['status', 'analysis', 'task-core', 'dependency-core'],
  
  // All: Full feature set (45 tools)
  all: ['status', 'analysis', 'task', 'dependency', 'tag', 'autopilot', 'config'],
  
  lean: ['status-core', 'analysis-core'],
};

export const CORE_TOOLS = [
  'get_tasks',
  'next_task',
  'get_task',
  'set_task_status',
  'update_subtask',
  'parse_prd',
  'expand_task',
];

export const STANDARD_TOOLS = [
  ...CORE_TOOLS,
  'initialize_project',
  'analyze_project_complexity',
  'expand_all',
  'add_subtask',
  'remove_task',
  'add_task',
  'complexity_report',
  'add_dependency',
];

export const ALL_TOOLS = [
  // Status tools
  'get_tasks', 'get_task', 'next_task', 'set_task_status', 'update_subtask',
  // Task tools
  'add_task', 'update_task', 'remove_task', 'add_subtask', 'remove_subtask',
  'clear_subtasks', 'move_task', 'update',
  // Analysis tools
  'parse_prd', 'expand_task', 'expand_all', 'analyze_project_complexity',
  'complexity_report', 'research', 'generate', 'initialize_project',
  // Dependency tools
  'add_dependency', 'remove_dependency', 'validate_dependencies', 'fix_dependencies',
  // Tag tools
  'list_tags', 'add_tag', 'delete_tag', 'use_tag', 'rename_tag', 'copy_tag',
  // Autopilot tools
  'autopilot_start', 'autopilot_resume', 'autopilot_next', 'autopilot_status',
  'autopilot_complete', 'autopilot_commit', 'autopilot_finalize', 'autopilot_abort',
  'models', 'get_config',
  'rules', 'response_language', 'scope_up_task', 'scope_down_task',
];

export function getToolsConfiguration() {
  const rawValue = process.env.TASK_MASTER_TOOLS;

  if (!rawValue || rawValue.trim() === '') {
    return 'core';
  }

  return rawValue.trim();
}

export function registerToolsForTier(server, toolMode = 'core') {
  const registeredTools = [];
  const failedTools = [];
  
  try {
    const normalizedMode = toolMode.toLowerCase().trim();
    
    // Determine which tool groups to register
    let tierGroups;
    
    switch (normalizedMode) {
      case 'all':
        tierGroups = TOOL_TIERS.all;
        break;
      case 'core':
      case 'lean':
        tierGroups = TOOL_TIERS.core;
        break;
      case 'standard':
        tierGroups = TOOL_TIERS.standard;
        break;
      default:
        // Handle comma-separated custom list - register all and let specific tools be filtered
        if (normalizedMode.includes(',')) {
          tierGroups = TOOL_TIERS.all;
        } else {
          tierGroups = TOOL_TIERS.core;
        }
        break;
    }
    
    // Register each tool group
    for (const group of tierGroups) {
      try {
        switch (group) {
          case 'status-core':
            registerStatusTools(server, { coreOnly: true });
            registeredTools.push('status-core');
            break;
          case 'status':
            registerStatusTools(server);
            registeredTools.push('status');
            break;
          case 'analysis-core':
            registerAnalysisTools(server, { coreOnly: true });
            registeredTools.push('analysis-core');
            break;
          case 'analysis':
            registerAnalysisTools(server);
            registeredTools.push('analysis');
            break;
          case 'task-core':
            registerTaskTools(server, { coreOnly: true });
            registeredTools.push('task-core');
            break;
          case 'task':
            registerTaskTools(server);
            registeredTools.push('task');
            break;
          case 'dependency-core':
            registerDependencyTools(server, { coreOnly: true });
            registeredTools.push('dependency-core');
            break;
          case 'dependency':
            registerDependencyTools(server);
            registeredTools.push('dependency');
            break;
          case 'tag':
            registerTagTools(server);
            registeredTools.push('tag');
            break;
          case 'autopilot':
            registerAutopilotTools(server);
            registeredTools.push('autopilot');
            break;
          case 'config':
            registerConfigTools(server);
            registeredTools.push('config');
            break;
          default:
            failedTools.push(group);
        }
      } catch (error) {
        console.error(`Failed to register tool group '${group}': ${error.message}`);
        failedTools.push(group);
      }
    }
    
    return {
      registeredCount: getToolCountForTier(normalizedMode),
      registeredTools,
      failedTools,
      normalizedMode,
    };
  } catch (error) {
    console.error(`Error in registerToolsForTier: ${error.message}`);
    return {
      registeredCount: 0,
      registeredTools: [],
      failedTools: ['all'],
      normalizedMode: 'error',
    };
  }
}

export function getToolCountForTier(tier) {
  const counts = {
    core: 7,
    lean: 7,
    standard: 15,
    all: 45,
  };
  return counts[tier] || counts.core;
}

export function getAvailableTools(tier = 'all') {
  switch (tier.toLowerCase()) {
    case 'core':
    case 'lean':
      return CORE_TOOLS;
    case 'standard':
      return STANDARD_TOOLS;
    case 'all':
    default:
      return ALL_TOOLS;
  }
}

export function isValidTool(toolName) {
  return ALL_TOOLS.includes(toolName);
}

export function getToolRegistration(toolName) {
  // Tool name to group mapping
  const toolGroups = {
    get_tasks: 'status',
    get_task: 'status',
    next_task: 'status',
    set_task_status: 'status',
    update_subtask: 'status',
    add_task: 'task',
    update_task: 'task',
    remove_task: 'task',
    add_subtask: 'task',
    remove_subtask: 'task',
    clear_subtasks: 'analysis',
    move_task: 'task',
    update: 'task',
    parse_prd: 'analysis',
    expand_task: 'analysis',
    expand_all: 'analysis',
    analyze_project_complexity: 'analysis',
    complexity_report: 'analysis',
    research: 'analysis',
    generate: 'analysis',
    initialize_project: 'analysis',
    add_dependency: 'dependency',
    remove_dependency: 'dependency',
    validate_dependencies: 'dependency',
    fix_dependencies: 'dependency',
    list_tags: 'tag',
    add_tag: 'tag',
    delete_tag: 'tag',
    use_tag: 'tag',
    rename_tag: 'tag',
    copy_tag: 'tag',
    autopilot_start: 'autopilot',
    autopilot_resume: 'autopilot',
    autopilot_next: 'autopilot',
    autopilot_status: 'autopilot',
    autopilot_complete: 'autopilot',
    autopilot_commit: 'autopilot',
    autopilot_finalize: 'autopilot',
    autopilot_abort: 'autopilot',
    models: 'config',
    get_config: 'config',
  };
  
  return toolGroups[toolName] || null;
}

// Re-export individual registration functions for granular control
export {
  registerTaskTools,
  registerStatusTools,
  registerAnalysisTools,
  registerDependencyTools,
  registerTagTools,
  registerAutopilotTools,
  registerConfigTools,
};
