
import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

export function registerConfigTools(server) {
  // models - View or configure AI models
  server.addTool({
    name: 'models',
    description: 'View or configure AI models',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      setMain: z.string().optional().describe('Set main model ID'),
      setResearch: z.string().optional().describe('Set research model ID'),
      setFallback: z.string().optional().describe('Set fallback model ID'),
      listAvailableModels: z.boolean().optional().describe('List available models'),
    }),
    execute: withToolContext('models', async (args, context) => {
      const { readProjectConfig, writeProjectConfig } = await import('../../lib/config.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { setMain, setResearch, setFallback, listAvailableModels } = args;
      
      try {
        const config = readProjectConfig(projectRoot);
        let updated = false;
        if (setMain) {
          config.models.main.modelId = setMain;
          updated = true;
        }
        if (setResearch) {
          config.models.research.modelId = setResearch;
          updated = true;
        }
        if (setFallback) {
          config.models.fallback.modelId = setFallback;
          updated = true;
        }
        
        if (updated) {
          writeProjectConfig(config, projectRoot);
          log.info('Model configuration updated');
        }
        
        const result = {
          current: {
            main: {
              provider: config.models.main.provider,
              modelId: config.models.main.modelId,
            },
            research: {
              provider: config.models.research.provider,
              modelId: config.models.research.modelId,
            },
            fallback: {
              provider: config.models.fallback.provider,
              modelId: config.models.fallback.modelId,
            },
          },
        };
        
        if (listAvailableModels) {
          result.availableModels = {
            anthropic: [
              'claude-sonnet-4-20250514',
              'claude-3-5-sonnet-20241022',
              'claude-3-5-haiku-20241022',
            ],
            openai: [
              'gpt-4o',
              'gpt-4o-mini',
              'gpt-4-turbo',
            ],
            google: [
              'gemini-2.0-flash',
              'gemini-1.5-pro',
            ],
            perplexity: [
              'sonar-pro',
              'llama-3.1-sonar-large-128k-online',
              'llama-3.1-sonar-small-128k-online',
            ],
          };
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: result,
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in models: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // get_config - Get project configuration
  server.addTool({
    name: 'get_config',
    description: 'Get current project configuration',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
    }),
    execute: withToolContext('get-config', async (args, context) => {
      const { readProjectConfig } = await import('../../lib/config.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      
      try {
        const config = readProjectConfig(projectRoot);

        return handleApiResult({
          result: {
            success: true,
            data: {
              projectName: config.projectName,
              projectDescription: config.projectDescription,
              version: config.version,
              models: {
                main: {
                  provider: config.models.main.provider,
                  modelId: config.models.main.modelId,
                },
                research: {
                  provider: config.models.research.provider,
                  modelId: config.models.research.modelId,
                },
                fallback: {
                  provider: config.models.fallback.provider,
                  modelId: config.models.fallback.modelId,
                },
              },
              defaults: config.defaults,
              global: config.global,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in get-config: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // rules - Manage cursor/IDE rules (matching )
  server.addTool({
    name: 'rules',
    description: 'Get or generate cursor/IDE rules for the project',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      generate: z.boolean().optional().describe('Generate rules from current project state'),
      format: z.enum(['cursor', 'vscode', 'windsurf', 'all']).optional().describe('Output format'),
    }),
    execute: withToolContext('rules', async (args, context) => {
      const { readProjectConfig, getProjectConfigDir } = await import('../../lib/config.js');
      const { getCurrentTag, getAllTasks } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { generate, format = 'cursor' } = args;
      
      try {
        const config = readProjectConfig(projectRoot);
        const tasks = getAllTasks(projectRoot);
        const currentTag = getCurrentTag(projectRoot);
        const stats = {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'pending').length,
          inProgress: tasks.filter(t => t.status === 'in-progress').length,
          done: tasks.filter(t => t.status === 'done').length,
        };
        
        // Generate basic rules content
        const rules = {
          projectName: config.projectName,
          currentTag,
          stats,
          models: {
            main: config.models.main.modelId,
            research: config.models.research.modelId,
          },
          format,
        };
        
        if (generate) {
          // Generate rules file content
          const rulesContent = `# ${config.projectName} - TaskMaster AI Rules

## Project Status
- Current Tag: ${currentTag}
- Tasks: ${stats.total} total (${stats.done} done, ${stats.inProgress} in progress, ${stats.pending} pending)

## AI Models
- Main: ${config.models.main.provider}/${config.models.main.modelId}
- Research: ${config.models.research.provider}/${config.models.research.modelId}

## Commands
- List tasks: \`taskmaster list\`
- Next task: \`taskmaster next\`
- Set status: \`taskmaster set-status --id <id> --status <status>\`
- Expand task: \`taskmaster expand --id <id>\`
`;
          rules.content = rulesContent;
        }
        
        return handleApiResult({
          result: {
            success: true,
            data: rules,
          },
          log,
          projectRoot,
          tag: currentTag,
        });
      } catch (error) {
        log.error(`Error in rules: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });

  // response_language - Set/get response language (matching )
  server.addTool({
    name: 'response_language',
    description: 'Get or set the response language for AI operations',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      language: z.string().optional().describe('Language code (e.g., en, zh, ja, ko, es, fr, de)'),
    }),
    execute: withToolContext('response-language', async (args, context) => {
      const { readProjectConfig, writeProjectConfig } = await import('../../lib/config.js');
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { language } = args;
      
      try {
        const config = readProjectConfig(projectRoot);
        
        if (language) {
          if (!config.global) config.global = {};
          config.global.responseLanguage = language;
          writeProjectConfig(config, projectRoot);
          log.info(`Set response language to: ${language}`);
        }
        
        const currentLanguage = config.global?.responseLanguage || 'en';
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              language: currentLanguage,
              supportedLanguages: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'],
              message: language ? `Response language set to: ${language}` : `Current language: ${currentLanguage}`,
            },
          },
          log,
          projectRoot,
          tag: getCurrentTag(projectRoot),
        });
      } catch (error) {
        log.error(`Error in response-language: ${error.message}`);
        return handleApiResult({
          result: { success: false, error: { message: error.message } },
          log,
          projectRoot,
        });
      }
    }),
  });
}
