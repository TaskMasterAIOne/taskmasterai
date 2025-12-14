/**
 * Scope Adjustment Module
 * Dynamic task complexity adjustment (scope-up and scope-down) with full AI support
 * Copyright (c) 2025 TaskMaster AI LLC
 * 
 * TaskMaster AI Terminology:
 * - "steps" instead of "subtasks"
 */

import boxen from 'boxen';
import chalk from 'chalk';
import { z } from 'zod';

import {
  log,
  readJSON,
  writeJSON,
  readAssessmentReport,
  isSilentMode,
  getConfigDir
} from '../utils.js';
import {
  startLoadingIndicator,
  stopLoadingIndicator
} from '../ui.js';

// Import AI services
import { generateAIObject } from '../../lib/ai.js';

/**
 * Valid strength levels for scope adjustments
 */
const VALID_STRENGTHS = ['light', 'regular', 'heavy'];

/**
 * Statuses that should be preserved during step regeneration
 */
const PRESERVE_STATUSES = ['done', 'in-progress', 'review', 'cancelled', 'deferred', 'blocked'];

/**
 * Statuses that can be regenerated
 */
const REGENERATE_STATUSES = ['pending'];

/**
 * Validate strength parameter
 * @param {string} strength - Strength level to validate
 * @returns {boolean} True if valid
 */
function validateStrength(strength) {
  return VALID_STRENGTHS.includes(strength);
}

/**
 * Get current assessment score for a task from the assessment report
 * @param {number} taskId - Task ID to look up
 * @param {Object} context - Context containing projectRoot
 * @returns {number|null} Current assessment score or null if not found
 */
function getCurrentAssessmentScore(taskId, context) {
  const { projectRoot } = context;

  try {
    const assessmentReport = readAssessmentReport(null, projectRoot);
    if (!assessmentReport?.taskAnalysis) {
      return null;
    }

    const taskAnalysis = assessmentReport.taskAnalysis.find(
      a => a.taskId === taskId
    );
    
    return taskAnalysis?.assessmentScore || taskAnalysis?.complexityScore || null;
  } catch (error) {
    log('debug', `Could not read current assessment score: ${error.message}`);
    return null;
  }
}

/**
 * Generates AI prompt for scope adjustment
 * @param {Object} task - The task to adjust
 * @param {string} direction - 'up' or 'down'
 * @param {string} strength - 'light', 'regular', or 'heavy'
 * @param {string} customPrompt - Optional custom instructions
 * @returns {string} The generated prompt
 */
function generateScopePrompt(task, direction, strength, customPrompt) {
  const isUp = direction === 'up';
  const strengthDescriptions = {
    light: isUp ? 'minor enhancements' : 'slight simplifications',
    regular: isUp ? 'moderate complexity increases' : 'moderate simplifications',
    heavy: isUp ? 'significant complexity additions' : 'major simplifications'
  };

  let basePrompt = `You are tasked with adjusting the complexity of a task. 

CURRENT TASK:
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'Not specified'}
Test Strategy: ${task.testStrategy || 'Not specified'}

ADJUSTMENT REQUIREMENTS:
- Direction: ${isUp ? 'INCREASE' : 'DECREASE'} complexity
- Strength: ${strength} (${strengthDescriptions[strength]})
- Preserve the core purpose and functionality of the task
- Maintain consistency with the existing task structure`;

  if (isUp) {
    basePrompt += `
- Add more detailed requirements, edge cases, or advanced features
- Include additional implementation considerations
- Enhance error handling and validation requirements
- Expand testing strategies with more comprehensive scenarios`;
  } else {
    basePrompt += `
- Focus on core functionality and essential requirements
- Remove or simplify non-essential features  
- Streamline implementation details
- Simplify testing to focus on basic functionality`;
  }

  if (customPrompt) {
    basePrompt += `\n\nCUSTOM INSTRUCTIONS:\n${customPrompt}`;
  }

  basePrompt += `\n\nReturn a JSON object with the updated task containing these fields:
- title: Updated task title
- description: Updated task description  
- details: Updated implementation details
- testStrategy: Updated test strategy
- priority: Task priority ('low', 'medium', or 'high')

Ensure the JSON is valid and properly formatted.`;

  return basePrompt;
}

/**
 * Adjusts task complexity using AI
 * @param {Object} task - The task to adjust
 * @param {string} direction - 'up' or 'down'
 * @param {string} strength - 'light', 'regular', or 'heavy'
 * @param {string} customPrompt - Optional custom instructions
 * @param {Object} context - Context object with projectRoot, etc.
 * @returns {Promise<Object>} Updated task data
 */
async function adjustTaskComplexity(task, direction, strength, customPrompt, context) {
  const systemPrompt = 'You are an expert software project manager who helps adjust task complexity while maintaining clarity and actionability.';

  const prompt = generateScopePrompt(task, direction, strength, customPrompt);

  // Define the task schema for structured response using Zod
  const taskSchema = z.object({
    title: z.string().min(1).describe('Updated task title reflecting scope adjustment'),
    description: z.string().min(1).describe('Updated task description with adjusted scope'),
    details: z.string().min(1).describe('Updated implementation details with adjusted complexity'),
    testStrategy: z.string().min(1).describe('Updated testing approach for the adjusted scope'),
    priority: z.enum(['low', 'medium', 'high']).describe('Task priority level')
  });

  const result = await generateAIObject(prompt, taskSchema, {
    systemPrompt,
    role: context.useResearch ? 'research' : 'main',
    operation: `scope-${direction}`
  });

  const updatedTaskData = result.object;

  // Ensure priority has a value
  const processedTaskData = {
    ...updatedTaskData,
    priority: updatedTaskData.priority || task.priority || 'medium'
  };

  return {
    updatedTask: {
      ...task,
      ...processedTaskData
    },
    usage: result.usage
  };
}

/**
 * Regenerates steps for a task based on new complexity while preserving completed work
 * @param {Object} task - The updated task object
 * @param {string} tasksPath - Path to tasks.json
 * @param {Object} context - Context containing projectRoot, etc.
 * @param {string} direction - Direction of scope change (up/down)
 * @param {string} strength - Strength level ('light', 'regular', 'heavy')
 * @param {number|null} originalAssessment - Original assessment score
 * @returns {Promise<Object>} Object with updated task and regeneration info
 */
async function regenerateStepsForComplexity(task, tasksPath, context, direction, strength = 'regular', originalAssessment = null) {
  const stepsField = task.steps ? 'steps' : (task.subtasks ? 'subtasks' : 'steps');
  
  // Check if task has steps
  if (!task[stepsField] || !Array.isArray(task[stepsField]) || task[stepsField].length === 0) {
    return {
      updatedTask: task,
      regenerated: false,
      preserved: 0,
      generated: 0
    };
  }

  // Identify steps to preserve vs regenerate
  const preservedSteps = task[stepsField].filter(step =>
    PRESERVE_STATUSES.includes(step.status)
  );
  const pendingSteps = task[stepsField].filter(step =>
    REGENERATE_STATUSES.includes(step.status) || !step.status
  );

  // If no pending steps, nothing to regenerate
  if (pendingSteps.length === 0) {
    return {
      updatedTask: task,
      regenerated: false,
      preserved: preservedSteps.length,
      generated: 0
    };
  }

  // Calculate appropriate number of total steps based on direction, complexity, strength
  let targetStepCount;
  const preservedCount = preservedSteps.length;
  const currentPendingCount = pendingSteps.length;

  // Use original assessment to inform decisions (if available)
  const assessmentFactor = originalAssessment
    ? Math.max(0.5, originalAssessment / 10)
    : 1.0;

  if (direction === 'up') {
    // Scope up: More steps for increased complexity
    if (strength === 'light') {
      const base = Math.max(5, preservedCount + Math.ceil(currentPendingCount * 1.1));
      targetStepCount = Math.ceil(base * (0.8 + 0.4 * assessmentFactor));
    } else if (strength === 'regular') {
      const base = Math.max(6, preservedCount + Math.ceil(currentPendingCount * 1.3));
      targetStepCount = Math.ceil(base * (0.8 + 0.4 * assessmentFactor));
    } else {
      // heavy
      const base = Math.max(8, preservedCount + Math.ceil(currentPendingCount * 1.6));
      targetStepCount = Math.ceil(base * (0.8 + 0.6 * assessmentFactor));
    }
  } else {
    // Scope down: Fewer steps for decreased complexity
    const aggressiveFactor = originalAssessment >= 8 ? 0.7 : originalAssessment >= 6 ? 0.85 : 1.0;

    if (strength === 'light') {
      const base = Math.max(3, preservedCount + Math.ceil(currentPendingCount * 0.8));
      targetStepCount = Math.ceil(base * aggressiveFactor);
    } else if (strength === 'regular') {
      const base = Math.max(3, preservedCount + Math.ceil(currentPendingCount * 0.5));
      targetStepCount = Math.ceil(base * aggressiveFactor);
    } else {
      // heavy - aggressive reduction
      const ultraAggressiveFactor = originalAssessment >= 9 ? 0.3 : originalAssessment >= 7 ? 0.5 : 0.7;
      const base = Math.max(2, preservedCount + Math.ceil(currentPendingCount * 0.25));
      targetStepCount = Math.max(1, Math.ceil(base * ultraAggressiveFactor));
    }
  }

  log('debug', `Assessment-aware step calculation: ${currentPendingCount} pending -> target ${targetStepCount} total (${strength} ${direction})`);

  const newStepsNeeded = Math.max(1, targetStepCount - preservedCount);

  try {
    // Generate new steps using AI to match the new complexity level
    const systemPrompt = 'You are an expert project manager who creates task breakdowns that match complexity levels.';

    const prompt = `Based on this updated task, generate ${newStepsNeeded} NEW steps that reflect the ${direction === 'up' ? 'increased' : 'decreased'} complexity level:

**Task Title**: ${task.title}
**Task Description**: ${task.description}
**Implementation Details**: ${task.details || 'Not specified'}
**Test Strategy**: ${task.testStrategy || 'Not specified'}

**Complexity Direction**: This task was recently scoped ${direction} (${strength} strength) to ${direction === 'up' ? 'increase' : 'decrease'} complexity.
${originalAssessment ? `**Original Assessment**: ${originalAssessment}/10 - consider this when determining appropriate scope level.` : ''}

${preservedCount > 0 ? `**Preserved Steps**: ${preservedCount} existing steps with work already done will be kept.` : ''}

Generate steps that:
${direction === 'up'
  ? strength === 'heavy'
    ? `- Add comprehensive implementation steps with advanced features
- Include extensive error handling, validation, and edge cases
- Cover multiple integration scenarios and advanced testing
- Provide thorough documentation and optimization approaches`
    : strength === 'regular'
      ? `- Add more detailed implementation steps
- Include additional error handling and validation
- Cover more edge cases and advanced features
- Provide more comprehensive testing approaches`
      : `- Add some additional implementation details
- Include basic error handling considerations
- Cover a few common edge cases
- Enhance testing approaches slightly`
  : strength === 'heavy'
    ? `- Focus ONLY on absolutely essential core functionality
- Strip out ALL non-critical features (error handling, advanced testing, etc.)
- Provide only the minimum viable implementation
- Eliminate any complex integrations or advanced scenarios
- Aim for the simplest possible working solution`
    : strength === 'regular'
      ? `- Focus on core functionality only
- Simplify implementation steps
- Remove non-essential features
- Streamline to basic requirements`
      : `- Focus mainly on core functionality
- Slightly simplify implementation steps
- Remove some non-essential features
- Streamline most requirements`
}

Return a JSON object with a "steps" array. Each step should have:
- id: Sequential NUMBER starting from 1
- title: Clear, specific title
- description: Detailed description
- dependencies: Array of dependency IDs (use format ["${task.id}.1", "${task.id}.2"] for siblings, or empty array [] for no dependencies)
- details: Implementation guidance
- status: "pending"
- testStrategy: Testing approach

Ensure the JSON is valid and properly formatted.`;

    // Define step schema
    const stepSchema = z.object({
      steps: z.array(
        z.object({
          id: z.number().int().positive(),
          title: z.string().min(5),
          description: z.string().min(10),
          dependencies: z.array(z.string()).optional().default([]),
          details: z.string().min(20),
          status: z.string().default('pending'),
          testStrategy: z.string().optional().default('')
        })
      )
    });

    const aiResult = await generateAIObject(prompt, stepSchema, {
      systemPrompt,
      role: context.useResearch ? 'research' : 'main',
      operation: `step-regen-${direction}`
    });

    const generatedSteps = aiResult.object.steps || [];

    // Post-process generated steps to ensure defaults
    const processedGeneratedSteps = generatedSteps.map(step => ({
      ...step,
      status: step.status || 'pending',
      testStrategy: step.testStrategy || '',
      links: step.dependencies || [] // Use "links" terminology
    }));

    // Ensure new steps have unique sequential IDs after the preserved ones
    const maxPreservedId = preservedSteps.reduce(
      (max, st) => Math.max(max, st.id || 0),
      0
    );
    let nextId = maxPreservedId + 1;
    const idMapping = new Map();
    
    const normalizedGeneratedSteps = processedGeneratedSteps
      .map(st => {
        const originalId = st.id;
        const newId = nextId++;
        idMapping.set(originalId, newId);
        return {
          ...st,
          id: newId
        };
      })
      .map(st => ({
        ...st,
        links: (st.links || []).map(dep => {
          if (typeof dep !== 'string' || !dep.startsWith(`${task.id}.`)) {
            return dep;
          }
          const [, siblingIdPart] = dep.split('.');
          const originalSiblingId = parseInt(siblingIdPart, 10);
          const remappedSiblingId = idMapping.get(originalSiblingId);
          return remappedSiblingId ? `${task.id}.${remappedSiblingId}` : dep;
        })
      }));

    // Update task with preserved steps + newly generated ones
    task[stepsField] = [...preservedSteps, ...normalizedGeneratedSteps];
    task.steps = task[stepsField]; // Ensure "steps" is used
    if (task.subtasks) delete task.subtasks; // Clean up old field

    return {
      updatedTask: task,
      regenerated: true,
      preserved: preservedSteps.length,
      generated: normalizedGeneratedSteps.length
    };
  } catch (error) {
    log('warn', `Failed to regenerate steps for task ${task.id}: ${error.message}`);
    // Don't fail the whole operation if step regeneration fails
    return {
      updatedTask: task,
      regenerated: false,
      preserved: preservedSteps.length,
      generated: 0,
      error: error.message
    };
  }
}

/**
 * Scope up a task - increase complexity/granularity
 * Uses AI to regenerate task content and steps
 * @param {string} tasksPath - Path to tasks.json
 * @param {string|number} taskId - Task ID to scope up
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result
 */
async function scopeUp(tasksPath, taskId, options = {}) {
  const {
    strength = 'regular',
    prompt: customPrompt = null,
    projectRoot,
    context,
    useResearch = false,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    // Validate strength
    if (!validateStrength(strength)) {
      throw new Error(`Invalid strength: ${strength}. Use: ${VALID_STRENGTHS.join(', ')}`);
    }
    
    log('info', `Scoping up task ${taskId} with strength: ${strength}`);
    
    // Show loading
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator(`Scoping up task ${taskId}...`);
    }
    
    // Read tasks
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data?.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Find task
    const taskIdNum = parseInt(String(taskId), 10);
    const task = data.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      throw new Error(`Task #${taskId} not found`);
    }
    
    // Get original assessment score (if available)
    const originalAssessment = getCurrentAssessmentScore(taskIdNum, { projectRoot });
    if (originalAssessment && outputFormat === 'text') {
      log('info', `Original assessment: ${originalAssessment}/10`);
    }
    
    // Adjust task complexity using AI
    const adjustResult = await adjustTaskComplexity(
      task,
      'up',
      strength,
      customPrompt,
      { projectRoot, useResearch }
    );
    
    // Regenerate steps based on new complexity while preserving completed work
    const stepResult = await regenerateStepsForComplexity(
      adjustResult.updatedTask,
      tasksPath,
      { projectRoot, useResearch },
      'up',
      strength,
      originalAssessment
    );
    
    // Log step regeneration info
    if (outputFormat === 'text' && stepResult.regenerated) {
      log('info', `Regenerated ${stepResult.generated} pending steps (preserved ${stepResult.preserved} completed)`);
    }
    
    // Update task in data
    const taskIndex = data.tasks.findIndex(t => t.id === taskIdNum);
    if (taskIndex !== -1) {
      data.tasks[taskIndex] = stepResult.updatedTask;
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Scoped up task ${taskId}`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    const stepsField = stepResult.updatedTask.steps ? 'steps' : 'subtasks';
    
    log('success', `Scoped up task ${taskId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        taskId,
        strength,
        stepsAdded: stepResult.generated,
        totalSteps: stepResult.updatedTask[stepsField]?.length || 0,
        task: stepResult.updatedTask
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Task Scoped Up (AI-Powered)') +
            `\n\nTask #${taskId}: ${stepResult.updatedTask.title}` +
            `\nStrength: ${chalk.cyan(strength)}` +
            (stepResult.regenerated 
              ? `\nSteps regenerated: ${chalk.cyan(stepResult.generated)} new, ${chalk.gray(stepResult.preserved)} preserved`
              : '') +
            `\nTotal steps: ${chalk.white(stepResult.updatedTask[stepsField]?.length || 0)}` +
            (originalAssessment ? `\nOriginal assessment: ${chalk.yellow(`${originalAssessment}/10`)}` : ''),
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
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Scope up error: ${error.message}`);
    throw error;
  }
}

/**
 * Scope down a task - decrease complexity/granularity
 * Uses AI to simplify task content and reduce steps
 * @param {string} tasksPath - Path to tasks.json
 * @param {string|number} taskId - Task ID to scope down
 * @param {Object} options - Options
 * @returns {Promise<Object>} Result
 */
async function scopeDown(tasksPath, taskId, options = {}) {
  const {
    strength = 'regular',
    prompt: customPrompt = null,
    projectRoot,
    context,
    useResearch = false,
    outputFormat = 'text'
  } = options;
  
  let loadingIndicator = null;
  
  try {
    // Validate strength
    if (!validateStrength(strength)) {
      throw new Error(`Invalid strength: ${strength}. Use: ${VALID_STRENGTHS.join(', ')}`);
    }
    
    log('info', `Scoping down task ${taskId} with strength: ${strength}`);
    
    // Show loading
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator(`Scoping down task ${taskId}...`);
    }
    
    // Read tasks
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data?.tasks) {
      throw new Error('No valid tasks found');
    }
    
    // Find task
    const taskIdNum = parseInt(String(taskId), 10);
    const task = data.tasks.find(t => t.id === taskIdNum);
    
    if (!task) {
      throw new Error(`Task #${taskId} not found`);
    }
    
    // Get original assessment score (if available)
    const originalAssessment = getCurrentAssessmentScore(taskIdNum, { projectRoot });
    if (originalAssessment && outputFormat === 'text') {
      log('info', `Original assessment: ${originalAssessment}/10`);
    }
    
    // Adjust task complexity using AI
    const adjustResult = await adjustTaskComplexity(
      task,
      'down',
      strength,
      customPrompt,
      { projectRoot, useResearch }
    );
    
    // Regenerate steps based on new complexity while preserving completed work
    const stepResult = await regenerateStepsForComplexity(
      adjustResult.updatedTask,
      tasksPath,
      { projectRoot, useResearch },
      'down',
      strength,
      originalAssessment
    );
    
    // Log step regeneration info
    if (outputFormat === 'text' && stepResult.regenerated) {
      log('info', `Regenerated ${stepResult.generated} pending steps (preserved ${stepResult.preserved} completed)`);
    }
    
    // Update task in data
    const taskIndex = data.tasks.findIndex(t => t.id === taskIdNum);
    if (taskIndex !== -1) {
      data.tasks[taskIndex] = stepResult.updatedTask;
    }
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Scoped down task ${taskId}`);
    }
    
    // Write changes
    writeJSON(tasksPath, data, projectRoot, context);
    
    const stepsField = stepResult.updatedTask.steps ? 'steps' : 'subtasks';
    
    log('success', `Scoped down task ${taskId}`);
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        taskId,
        strength,
        stepsRemoved: stepResult.generated > 0 ? 0 : (task.steps?.length || 0) - (stepResult.updatedTask[stepsField]?.length || 0),
        totalSteps: stepResult.updatedTask[stepsField]?.length || 0,
        task: stepResult.updatedTask
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      console.log(
        boxen(
          chalk.green.bold('✓ Task Scoped Down (AI-Powered)') +
            `\n\nTask #${taskId}: ${stepResult.updatedTask.title}` +
            `\nStrength: ${chalk.cyan(strength)}` +
            (stepResult.regenerated 
              ? `\nSteps regenerated: ${chalk.cyan(stepResult.generated)} new, ${chalk.gray(stepResult.preserved)} preserved`
              : '') +
            `\nTotal steps: ${chalk.white(stepResult.updatedTask[stepsField]?.length || 0)}` +
            (originalAssessment ? `\nOriginal assessment: ${chalk.yellow(`${originalAssessment}/10`)}` : ''),
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
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Scope down error: ${error.message}`);
    throw error;
  }
}

export {
  scopeUp,
  scopeDown,
  validateStrength,
  VALID_STRENGTHS,
  PRESERVE_STATUSES,
  REGENERATE_STATUSES
};

export default {
  scopeUp,
  scopeDown,
  validateStrength,
  VALID_STRENGTHS
};
