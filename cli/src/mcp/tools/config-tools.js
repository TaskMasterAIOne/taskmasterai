/**
 * Configuration Tools
 * MCP tools for project and model configuration
 */

import { z } from 'zod';
import { handleApiResult, withToolContext } from '../utils.js';

/**
 * Register configuration-related tools with the MCP server
 * @param {import('fastmcp').FastMCP} server - FastMCP server instance
 */
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
        
        // Update models if specified
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
        
        // Return safe config (no sensitive data)
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

  // rules - Manage rule profiles (full profile management, matching official claude-task-master)
  server.addTool({
    name: 'rules',
    description: 'Add or remove rule profiles from the project. Supports Cursor, Windsurf, Roo, Cline, Claude, Codex, Trae, VSCode, Amp, Gemini, Kilo, Kiro, OpenCode, and Zed profiles.',
    parameters: z.object({
      projectRoot: z.string().optional().describe('Project root directory'),
      action: z.enum(['add', 'remove']).describe('Whether to add or remove rule profiles'),
      profiles: z.array(z.string()).min(1).describe('List of rule profiles to add or remove (e.g., ["cursor", "roo"])'),
      force: z.boolean().optional().describe('Force removal even if it would leave no profiles'),
    }),
    execute: withToolContext('rules', async (args, context) => {
      const { getCurrentTag } = await import('../../lib/tasks.js');
      const { projectRoot, log } = context;
      const { action, profiles, force } = args;
      
      try {
        // Dynamically import rule-transformer to avoid circular dependencies
        const {
          isValidProfile,
          getRulesProfile,
          convertAllRulesToProfileRules,
          removeProfileRules,
          getInstalledProfiles,
          wouldRemovalLeaveNoProfiles,
          generateProfileSummary,
          generateProfileRemovalSummary,
        } = await import('../../utils/rule-transformer.js');
        
        const { RULE_PROFILES } = await import('../../constants/profiles.js');
        
        // Validate profiles
        const invalidProfiles = profiles.filter(p => !isValidProfile(p));
        if (invalidProfiles.length > 0) {
          return handleApiResult({
            result: {
              success: false,
              error: {
                message: `Invalid profiles: ${invalidProfiles.join(', ')}. Valid profiles: ${RULE_PROFILES.join(', ')}`,
              },
            },
            log,
            projectRoot,
          });
        }
        
        const results = [];
        
        if (action === 'add') {
          for (const profile of profiles) {
            const profileConfig = getRulesProfile(profile);
            const addResult = convertAllRulesToProfileRules(projectRoot, profileConfig);
            results.push({
              profile,
              success: true,
              ...addResult,
              summary: generateProfileSummary(profile, addResult),
            });
          }
        } else if (action === 'remove') {
          // Check if removal would leave no profiles
          if (!force && wouldRemovalLeaveNoProfiles(projectRoot, profiles)) {
            return handleApiResult({
              result: {
                success: false,
                error: {
                  message: 'This would remove ALL rule profiles. Use force=true if you are certain.',
                },
              },
              log,
              projectRoot,
            });
          }
          
          for (const profile of profiles) {
            const profileConfig = getRulesProfile(profile);
            const removeResult = removeProfileRules(projectRoot, profileConfig);
            results.push({
              profile,
              ...removeResult,
              summary: generateProfileRemovalSummary(profile, removeResult),
            });
          }
        }
        
        const currentTag = getCurrentTag(projectRoot);
        
        return handleApiResult({
          result: {
            success: true,
            data: {
              action,
              profiles,
              results,
              installedProfiles: getInstalledProfiles(projectRoot),
            },
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

  // response_language - Set/get response language (matching official claude-task-master)
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
          // Set language
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
