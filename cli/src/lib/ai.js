/**
 * AI Service for TaskMaster AI
 * Uses Vercel AI SDK for AI model interactions (same as official TaskMaster)
 */

import { generateText, generateObject } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { getApiKey, readProjectConfig } from './config.js';

// Provider instances cache
const providers = {};

/**
 * Get or create a provider instance
 */
function getProvider(providerName) {
  if (providers[providerName]) {
    return providers[providerName];
  }

  const apiKey = getApiKey(providerName);
  if (!apiKey) {
    throw new Error(`No API key found for ${providerName}. Set ${providerName.toUpperCase()}_API_KEY environment variable.`);
  }

  switch (providerName.toLowerCase()) {
    case 'anthropic':
      providers[providerName] = createAnthropic({ apiKey });
      break;
    case 'openai':
      providers[providerName] = createOpenAI({ apiKey });
      break;
    case 'google':
      providers[providerName] = createGoogleGenerativeAI({ apiKey });
      break;
    case 'perplexity':
      providers[providerName] = createOpenAI({
        apiKey,
        baseURL: 'https://api.perplexity.ai',
      });
      break;
    default:
      throw new Error(`Unsupported provider: ${providerName}`);
  }

  return providers[providerName];
}

/**
 * Get the model instance for a role
 */
function getModelForRole(role = 'main') {
  const config = readProjectConfig();
  const modelConfig = config.models[role] || config.models.main;
  const provider = getProvider(modelConfig.provider);
  
  return provider(modelConfig.modelId);
}

/**
 * Generate text using the configured AI model
 */
export async function generateAIText(prompt, options = {}) {
  const role = options.role || 'main';
  const config = readProjectConfig();
  const modelConfig = config.models[role] || config.models.main;
  
  const systemPrompt = options.systemPrompt || 
    'You are a helpful AI assistant specialized in software development and task management.';
  
  try {
    const model = getModelForRole(role);
    
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt,
      maxTokens: modelConfig.maxTokens || 8192,
      temperature: options.temperature ?? modelConfig.temperature ?? 0.7,
    });

    return {
      text: result.text,
      usage: {
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
      },
    };
  } catch (error) {
    // Try fallback if main fails
    if (role === 'main' && config.models.fallback) {
      console.warn(`Main model failed, trying fallback: ${error.message}`);
      return await generateAIText(prompt, { ...options, role: 'fallback' });
    }
    throw error;
  }
}

/**
 * Generate structured object using the configured AI model
 */
export async function generateAIObject(prompt, schema, options = {}) {
  const role = options.role || 'main';
  const config = readProjectConfig();
  const modelConfig = config.models[role] || config.models.main;
  
  const systemPrompt = options.systemPrompt || 
    'You are a helpful AI assistant specialized in software development and task management.';
  
  try {
    const model = getModelForRole(role);
    
    const result = await generateObject({
      model,
      system: systemPrompt,
      prompt,
      schema,
      maxTokens: modelConfig.maxTokens || 8192,
      temperature: options.temperature ?? modelConfig.temperature ?? 0.7,
    });

    return {
      object: result.object,
      usage: {
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
      },
    };
  } catch (error) {
    // Try fallback if main fails
    if (role === 'main' && config.models.fallback) {
      console.warn(`Main model failed, trying fallback: ${error.message}`);
      return await generateAIObject(prompt, schema, { ...options, role: 'fallback' });
    }
    throw error;
  }
}

// ============================================
// TASK GENERATION SCHEMAS (using Zod like official)
// ============================================

const taskSchema = z.object({
  title: z.string().describe('Clear, concise task title'),
  description: z.string().describe('Detailed description of what needs to be done'),
  priority: z.enum(['high', 'medium', 'low']).describe('Task priority level'),
  dependencies: z.array(z.number()).default([]).describe('IDs of tasks this depends on'),
  details: z.string().describe('Implementation details and technical considerations'),
  testStrategy: z.string().describe('How to verify this task is complete'),
});

const tasksResponseSchema = z.object({
  tasks: z.array(taskSchema).describe('Array of generated tasks'),
});

const subtaskSchema = z.object({
  title: z.string().describe('Clear, concise subtask title'),
  description: z.string().describe('What needs to be done'),
  details: z.string().optional().describe('Implementation details'),
});

const subtasksResponseSchema = z.object({
  subtasks: z.array(subtaskSchema).describe('Array of generated subtasks'),
});

const complexityAnalysisSchema = z.object({
  analysis: z.array(z.object({
    taskId: z.number().describe('The task ID'),
    complexity: z.number().min(1).max(10).describe('Complexity score 1-10'),
    reasoning: z.string().describe('Brief explanation of complexity'),
    recommendedSubtasks: z.number().describe('Suggested number of subtasks'),
  })).describe('Array of complexity analyses'),
});

const newTaskSchema = z.object({
  title: z.string().describe('Clear, concise task title'),
  description: z.string().describe('Detailed description'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
  details: z.string().describe('Implementation details'),
  testStrategy: z.string().describe('Verification approach'),
});

// ============================================
// TASK GENERATION FUNCTIONS
// ============================================

/**
 * Generate tasks from a PRD (using structured output like official)
 */
export async function generateTasksFromPRD(prdContent, options = {}) {
  const numTasks = options.numTasks || 10;
  
  const systemPrompt = `You are an expert software architect and project manager. Your job is to analyze Product Requirements Documents (PRDs) and break them down into clear, actionable development tasks.

When creating tasks:
- Start with foundational setup tasks (project structure, dependencies)
- Progress to core functionality implementation
- Include API/backend tasks before frontend when applicable
- Add testing and deployment tasks at the end
- Set appropriate dependencies between tasks
- Use "high" priority for blocking/critical tasks
- Use "medium" for standard development tasks
- Use "low" for nice-to-haves or polish tasks`;

  const prompt = `Analyze the following PRD and generate exactly ${numTasks} development tasks.

PRD Content:
${prdContent}

Generate tasks that provide a clear implementation path from start to finish.`;

  const result = await generateAIObject(prompt, tasksResponseSchema, {
    systemPrompt,
    role: options.research ? 'research' : 'main',
  });

  return result.object.tasks;
}

/**
 * Expand a task into subtasks
 */
export async function expandTask(task, options = {}) {
  const numSubtasks = options.numSubtasks || 5;
  
  const systemPrompt = `You are an expert software developer. Break down development tasks into smaller, actionable subtasks that can be completed independently.

Each subtask should:
- Be specific and actionable
- Take roughly 15-60 minutes to complete
- Have clear completion criteria
- Build towards the parent task's goal`;

  const prompt = `Break down the following task into ${numSubtasks} subtasks:

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Details: ${task.details || 'No additional details provided'}

${options.prompt ? `Additional context: ${options.prompt}` : ''}

Generate subtasks that provide a clear implementation path.`;

  const result = await generateAIObject(prompt, subtasksResponseSchema, {
    systemPrompt,
    role: options.research ? 'research' : 'main',
  });

  return result.object.subtasks;
}

/**
 * Analyze task complexity
 */
export async function analyzeComplexity(tasks, options = {}) {
  const systemPrompt = `You are an expert software architect. Analyze development tasks and rate their complexity to help with planning and estimation.

Consider these factors for complexity:
- Technical difficulty
- Number of components/files affected
- Integration requirements
- Testing complexity
- Potential for unknowns/blockers`;

  const taskSummaries = tasks.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dependencies: t.dependencies,
  }));

  const prompt = `Analyze the complexity of the following tasks on a scale of 1-10:

Tasks:
${JSON.stringify(taskSummaries, null, 2)}

For each task, provide a complexity score and recommended number of subtasks.`;

  const result = await generateAIObject(prompt, complexityAnalysisSchema, {
    systemPrompt,
    role: options.research ? 'research' : 'main',
  });

  return result.object.analysis;
}

/**
 * Add a new task based on a description
 */
export async function generateTask(description, options = {}) {
  const systemPrompt = `You are an expert software architect. Create well-structured development tasks based on descriptions.

Tasks should:
- Have clear, actionable titles
- Include detailed implementation guidance
- Specify testing/verification approach
- Set appropriate priority`;

  const prompt = `Create a development task based on the following description:

"${description}"

Priority: ${options.priority || 'medium'}
${options.dependencies?.length ? `Dependencies: Tasks ${options.dependencies.join(', ')} must be completed first` : ''}

Generate a well-structured task.`;

  const result = await generateAIObject(prompt, newTaskSchema, {
    systemPrompt,
    role: options.research ? 'research' : 'main',
  });

  return result.object;
}

export default {
  generateAIText,
  generateAIObject,
  generateTasksFromPRD,
  expandTask,
  analyzeComplexity,
  generateTask,
};
