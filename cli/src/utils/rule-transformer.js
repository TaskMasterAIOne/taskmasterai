
import fs from 'fs';
import path from 'path';
import { assetExists, getAssetsDir, readAsset } from './asset-resolver.js';
import { removeTaskMasterMCPConfiguration, setupMCPConfiguration } from './create-mcp-config.js';
import { RULE_PROFILES } from '../constants/profiles.js';
import * as profilesModule from '../profiles/index.js';

function log(level, message) {
  const prefix = {
    info: '\x1b[36mℹ\x1b[0m',
    success: '\x1b[32m✓\x1b[0m',
    warn: '\x1b[33m⚠\x1b[0m',
    error: '\x1b[31m✗\x1b[0m',
    debug: '\x1b[90m⋯\x1b[0m'
  };
  if (level !== 'debug' || process.env.TASKMASTER_LOG_LEVEL === 'debug') {
    console.log(`${prefix[level] || ''} ${message}`);
  }
}

export function isValidProfile(profile) {
  return RULE_PROFILES.includes(profile);
}

export function getRulesProfile(name) {
  if (!isValidProfile(name)) {
    return null;
  }

  const profileKey = `${name}Profile`;
  const profile = profilesModule[profileKey];

  if (!profile) {
    throw new Error(
      `Profile not found: static import missing for '${name}'. Valid profiles: ${RULE_PROFILES.join(', ')}`
    );
  }

  return profile;
}

function replaceBasicTerms(content, conversionConfig) {
  let result = content;

  conversionConfig.profileTerms.forEach((pattern) => {
    if (typeof pattern.to === 'function') {
      result = result.replace(pattern.from, pattern.to);
    } else {
      result = result.replace(pattern.from, pattern.to);
    }
  });

  conversionConfig.fileExtensions.forEach((pattern) => {
    result = result.replace(pattern.from, pattern.to);
  });

  return result;
}

function replaceToolReferences(content, conversionConfig) {
  let result = content;

  const toolNames = conversionConfig.toolNames;
  const toolReferencePattern = new RegExp(
    `\\b(${Object.keys(toolNames).join('|')})\\b`,
    'g'
  );

  result = result.replace(toolReferencePattern, (match, toolName) => {
    return toolNames[toolName] || toolName;
  });

  conversionConfig.toolContexts.forEach((pattern) => {
    result = result.replace(pattern.from, pattern.to);
  });

  conversionConfig.toolGroups.forEach((pattern) => {
    result = result.replace(pattern.from, pattern.to);
  });

  return result;
}

function updateDocReferences(content, conversionConfig) {
  let result = content;

  conversionConfig.docUrls.forEach((pattern) => {
    if (typeof pattern.to === 'function') {
      result = result.replace(pattern.from, pattern.to);
    } else {
      result = result.replace(pattern.from, pattern.to);
    }
  });

  return result;
}

function updateFileReferences(content, conversionConfig) {
  const { pathPattern, replacement } = conversionConfig.fileReferences;
  return content.replace(pathPattern, replacement);
}

function transformRuleContent(content, conversionConfig, globalReplacements) {
  let result = content;

  result = updateFileReferences(result, conversionConfig);
  result = replaceBasicTerms(result, conversionConfig);
  result = replaceToolReferences(result, conversionConfig);
  result = updateDocReferences(result, conversionConfig);

  globalReplacements.forEach((pattern) => {
    if (typeof pattern.to === 'function') {
      result = result.replace(pattern.from, pattern.to);
    } else {
      result = result.replace(pattern.from, pattern.to);
    }
  });

  return result;
}

export function convertRuleToProfileRule(sourcePath, targetPath, profile) {
  const { conversionConfig, globalReplacements } = profile;
  try {
    const content = fs.readFileSync(sourcePath, 'utf8');
    const transformedContent = transformRuleContent(
      content,
      conversionConfig,
      globalReplacements
    );

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, transformedContent);
    return true;
  } catch (error) {
    console.error(`Error converting rule file: ${error.message}`);
    return false;
  }
}

export function convertAllRulesToProfileRules(projectRoot, profile) {
  const targetDir = path.join(projectRoot, profile.rulesDir);

  let success = 0;
  let failed = 0;

  // 1. Call onAddRulesProfile first (for pre-processing like copying assets)
  if (typeof profile.onAddRulesProfile === 'function') {
    try {
      const assetsDir = getAssetsDir();
      profile.onAddRulesProfile(targetDir, assetsDir);
      log('debug', `[Rule Transformer] Called onAddRulesProfile for ${profile.profileName}`);
    } catch (error) {
      log('error', `[Rule Transformer] onAddRulesProfile failed for ${profile.profileName}: ${error.message}`);
      failed++;
    }
  }

  // 2. Handle fileMap-based rule conversion (if any)
  const sourceFiles = Object.keys(profile.fileMap);
  if (sourceFiles.length > 0) {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const sourceFile of sourceFiles) {
      const isAssetFile = !sourceFile.startsWith('rules/');

      try {
        if (!assetExists(sourceFile)) {
          log('warn', `[Rule Transformer] Source file not found: ${sourceFile}, skipping`);
          continue;
        }

        const targetFilename = profile.fileMap[sourceFile];
        const targetPath = path.join(targetDir, targetFilename);

        const targetFileDir = path.dirname(targetPath);
        if (!fs.existsSync(targetFileDir)) {
          fs.mkdirSync(targetFileDir, { recursive: true });
        }

        let content = readAsset(sourceFile, 'utf8');

        if (!isAssetFile) {
          content = transformRuleContent(
            content,
            profile.conversionConfig,
            profile.globalReplacements
          );
        }

        fs.writeFileSync(targetPath, content, 'utf8');
        success++;

        log('debug', `[Rule Transformer] ${isAssetFile ? 'Copied' : 'Converted'} ${sourceFile} -> ${targetFilename} for ${profile.profileName}`);
      } catch (error) {
        failed++;
        log('error', `[Rule Transformer] Failed to ${isAssetFile ? 'copy' : 'convert'} ${sourceFile} for ${profile.profileName}: ${error.message}`);
      }
    }
  }

  // 3. Setup MCP configuration (if enabled)
  if (profile.mcpConfig !== false) {
    try {
      setupMCPConfiguration(projectRoot, profile.mcpConfigPath);
      log('debug', `[Rule Transformer] Setup MCP configuration for ${profile.profileName}`);
    } catch (error) {
      log('error', `[Rule Transformer] MCP setup failed for ${profile.profileName}: ${error.message}`);
    }
  }

  // 4. Call post-conversion hook (for finalization)
  if (typeof profile.onPostConvertRulesProfile === 'function') {
    try {
      const assetsDir = getAssetsDir();
      profile.onPostConvertRulesProfile(targetDir, assetsDir);
      log('debug', `[Rule Transformer] Called onPostConvertRulesProfile for ${profile.profileName}`);
    } catch (error) {
      log('error', `[Rule Transformer] onPostConvertRulesProfile failed for ${profile.profileName}: ${error.message}`);
    }
  }

  return { success: Math.max(success, 1), failed };
}

export function removeProfileRules(projectRoot, profile) {
  const targetDir = path.join(projectRoot, profile.rulesDir);
  const profileDir = path.join(projectRoot, profile.profileDir);

  const result = {
    profileName: profile.profileName,
    success: false,
    skipped: false,
    error: null,
    filesRemoved: [],
    mcpResult: null,
    profileDirRemoved: false,
    notice: null
  };

  try {
    // 1. Call onRemoveRulesProfile first
    if (typeof profile.onRemoveRulesProfile === 'function') {
      try {
        profile.onRemoveRulesProfile(targetDir);
        log('debug', `[Rule Transformer] Called onRemoveRulesProfile for ${profile.profileName}`);
      } catch (error) {
        log('error', `[Rule Transformer] onRemoveRulesProfile failed for ${profile.profileName}: ${error.message}`);
      }
    }

    // 2. Remove fileMap-based files (if any)
    const sourceFiles = Object.keys(profile.fileMap);
    if (sourceFiles.length > 0) {
      if (!fs.existsSync(profileDir)) {
        result.success = true;
        result.skipped = true;
        log('debug', `[Rule Transformer] Profile directory does not exist: ${profileDir}`);
        return result;
      }

      let hasOtherRulesFiles = false;

      if (fs.existsSync(targetDir)) {
        const taskMasterFiles = sourceFiles.map(
          (sourceFile) => profile.fileMap[sourceFile]
        );

        let allFiles = [];
        if (targetDir === projectRoot || profile.rulesDir === '.') {
          const items = fs.readdirSync(targetDir);
          for (const item of items) {
            if (item === 'node_modules' || item === '.git' || item === 'dist') {
              continue;
            }
            const itemPath = path.join(targetDir, item);
            try {
              const stats = fs.lstatSync(itemPath);
              if (stats.isFile()) {
                allFiles.push(item);
              } else if (stats.isDirectory() && !stats.isSymbolicLink()) {
                const subFiles = fs.readdirSync(itemPath, { recursive: true });
                subFiles.forEach((subFile) => {
                  allFiles.push(path.join(item, subFile.toString()));
                });
              }
            } catch (err) {
              // Silently skip files we can't access
            }
          }
        } else {
          allFiles = fs.readdirSync(targetDir, { recursive: true });
        }

        const allFilePaths = allFiles
          .filter((file) => {
            const fullPath = path.join(targetDir, file);
            try {
              const stats = fs.statSync(fullPath);
              return stats.isFile();
            } catch (err) {
              return false;
            }
          })
          .map((file) => file.toString());

        // Remove only TaskMaster files
        for (const taskMasterFile of taskMasterFiles) {
          const filePath = path.join(targetDir, taskMasterFile);
          if (fs.existsSync(filePath)) {
            try {
              fs.rmSync(filePath, { force: true });
              result.filesRemoved.push(taskMasterFile);
              log('debug', `[Rule Transformer] Removed TaskMaster file: ${taskMasterFile}`);
            } catch (error) {
              log('error', `[Rule Transformer] Failed to remove ${taskMasterFile}: ${error.message}`);
            }
          }
        }
        const remainingFiles = allFilePaths.filter(
          (file) => !taskMasterFiles.includes(file)
        );

        hasOtherRulesFiles = remainingFiles.length > 0;

        if (remainingFiles.length === 0) {
          fs.rmSync(targetDir, { recursive: true, force: true });
          log('debug', `[Rule Transformer] Removed empty rules directory: ${targetDir}`);
        } else if (hasOtherRulesFiles) {
          result.notice = `Preserved ${remainingFiles.length} existing rule files in ${profile.rulesDir}`;
          log('info', `[Rule Transformer] ${result.notice}`);
        }
      }
    }

    // 3. Handle MCP configuration - only remove TaskMaster, preserve other servers
    if (profile.mcpConfig !== false) {
      try {
        result.mcpResult = removeTaskMasterMCPConfiguration(
          projectRoot,
          profile.mcpConfigPath
        );
        if (result.mcpResult.hasOtherServers) {
          if (!result.notice) {
            result.notice = 'Preserved other MCP server configurations';
          } else {
            result.notice += '; preserved other MCP server configurations';
          }
        }
        log('debug', `[Rule Transformer] Processed MCP configuration for ${profile.profileName}`);
      } catch (error) {
        log('error', `[Rule Transformer] MCP cleanup failed for ${profile.profileName}: ${error.message}`);
      }
    }

    // 4. Check if we should remove the entire profile directory
    if (fs.existsSync(profileDir)) {
      const remainingContents = fs.readdirSync(profileDir);
      if (remainingContents.length === 0 && profile.profileDir !== '.') {
        try {
          fs.rmSync(profileDir, { recursive: true, force: true });
          result.profileDirRemoved = true;
          log('debug', `[Rule Transformer] Removed empty profile directory: ${profileDir}`);
        } catch (error) {
          log('error', `[Rule Transformer] Failed to remove profile directory ${profileDir}: ${error.message}`);
        }
      } else if (remainingContents.length > 0) {
        const preservedNotice = `Preserved ${remainingContents.length} existing files/folders in ${profile.profileDir}`;
        if (!result.notice) {
          result.notice = preservedNotice;
        } else {
          result.notice += `; ${preservedNotice.toLowerCase()}`;
        }
        log('info', `[Rule Transformer] ${preservedNotice}`);
      }
    }

    result.success = true;
    log('debug', `[Rule Transformer] Successfully removed ${profile.profileName} TaskMaster files from ${projectRoot}`);
  } catch (error) {
    result.error = error.message;
    log('error', `[Rule Transformer] Failed to remove ${profile.profileName} rules: ${error.message}`);
  }

  return result;
}

export function getInstalledProfiles(projectRoot) {
  const installed = [];
  
  for (const profileName of RULE_PROFILES) {
    try {
      const profile = getRulesProfile(profileName);
      if (profile) {
        const profileDir = path.join(projectRoot, profile.profileDir);
        if (fs.existsSync(profileDir)) {
          installed.push(profileName);
        }
      }
    } catch (err) {
      // Skip profiles we can't load
    }
  }
  
  return installed;
}

export function wouldRemovalLeaveNoProfiles(projectRoot, profilesToRemove) {
  const installed = getInstalledProfiles(projectRoot);
  const remaining = installed.filter(p => !profilesToRemove.includes(p));
  return remaining.length === 0;
}

export function generateProfileSummary(profileName, result) {
  return `Added ${profileName} rules: ${result.success} files processed, ${result.failed} failed`;
}

export function generateProfileRemovalSummary(profileName, result) {
  if (result.skipped) {
    return `Skipped ${profileName} (not installed)`;
  }
  if (result.error) {
    return `Failed to remove ${profileName}: ${result.error}`;
  }
  return `Removed ${profileName} rules: ${result.filesRemoved.length} files removed`;
}

export function categorizeProfileResults(results) {
  const allSuccessfulProfiles = results
    .filter(r => r.success > 0 || r.failed === 0)
    .map(r => r.profileName);
  const totalSuccess = results.reduce((sum, r) => sum + (r.success || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);
  
  return { allSuccessfulProfiles, totalSuccess, totalFailed };
}

export function categorizeRemovalResults(results) {
  const successfulRemovals = results
    .filter(r => r.success && !r.skipped)
    .map(r => r.profileName);
  const skippedRemovals = results
    .filter(r => r.skipped)
    .map(r => r.profileName);
  const failedRemovals = results
    .filter(r => r.error)
    .map(r => ({ profileName: r.profileName, error: r.error }));
  const removalsWithNotices = results
    .filter(r => r.notice)
    .map(r => ({ profileName: r.profileName, notice: r.notice }));
    
  return { successfulRemovals, skippedRemovals, failedRemovals, removalsWithNotices };
}
