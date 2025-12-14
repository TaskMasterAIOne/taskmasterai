/**
 * Migrate Module
 * Project migration utilities for upgrading TaskMaster AI structure
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';

import {
  log,
  findProjectRoot,
  isSilentMode
} from '../utils.js';

// Configuration directories
const LEGACY_CONFIG_DIR = '.taskmaster';
const CONFIG_DIR = '.taskmaster-ai';

/**
 * Analyze what needs to be migrated
 * @param {string} projectRoot - Project root directory
 * @returns {Array<Object>} Migration plan items
 */
function analyzeMigrationNeeds(projectRoot) {
  const migrationPlan = [];

  // Check for legacy .taskmaster directory
  const legacyDir = path.join(projectRoot, LEGACY_CONFIG_DIR);
  const newDir = path.join(projectRoot, CONFIG_DIR);

  if (fs.existsSync(legacyDir) && !fs.existsSync(newDir)) {
    // Migrate entire directory
    migrationPlan.push({
      type: 'directory',
      from: LEGACY_CONFIG_DIR,
      to: CONFIG_DIR,
      action: 'rename'
    });
  }

  // Check for legacy files in root
  const legacyFiles = [
    { from: 'tasks.json', to: path.join(CONFIG_DIR, 'tasks', 'tasks.json') },
    { from: '.taskmasterrc', to: path.join(CONFIG_DIR, 'config.json') }
  ];

  legacyFiles.forEach(file => {
    const fromPath = path.join(projectRoot, file.from);
    if (fs.existsSync(fromPath)) {
      migrationPlan.push({
        type: 'file',
        from: file.from,
        to: file.to,
        action: 'move'
      });
    }
  });

  // Check for terminology updates needed in tasks.json
  const tasksPath = path.join(projectRoot, CONFIG_DIR, 'tasks', 'tasks.json');
  const legacyTasksPath = path.join(projectRoot, LEGACY_CONFIG_DIR, 'tasks', 'tasks.json');
  const rootTasksPath = path.join(projectRoot, 'tasks.json');
  
  const tasksFile = [tasksPath, legacyTasksPath, rootTasksPath].find(p => fs.existsSync(p));
  
  if (tasksFile) {
    try {
      const content = fs.readFileSync(tasksFile, 'utf-8');
      if (content.includes('"subtasks"') || content.includes('"tags"')) {
        migrationPlan.push({
          type: 'content',
          file: tasksFile,
          action: 'update_terminology',
          changes: [
            { from: 'subtasks', to: 'steps' },
            { from: 'tags', to: 'contexts' }
          ]
        });
      }
    } catch (error) {
      log('warn', `Could not analyze ${tasksFile}: ${error.message}`);
    }
  }

  return migrationPlan;
}

/**
 * Execute migration plan
 * @param {string} projectRoot - Project root directory
 * @param {Array<Object>} plan - Migration plan
 * @param {Object} options - Options
 * @returns {Object} Migration result
 */
function executeMigration(projectRoot, plan, options = {}) {
  const { dryRun = false } = options;
  const results = [];

  plan.forEach(item => {
    try {
      if (item.action === 'rename' && item.type === 'directory') {
        const fromPath = path.join(projectRoot, item.from);
        const toPath = path.join(projectRoot, item.to);
        
        if (!dryRun) {
          fs.renameSync(fromPath, toPath);
        }
        
        results.push({ ...item, success: true });
        log('info', `${dryRun ? 'Would rename' : 'Renamed'}: ${item.from} → ${item.to}`);
      }
      
      else if (item.action === 'move' && item.type === 'file') {
        const fromPath = path.join(projectRoot, item.from);
        const toPath = path.join(projectRoot, item.to);
        
        if (!dryRun) {
          // Ensure target directory exists
          const targetDir = path.dirname(toPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.renameSync(fromPath, toPath);
        }
        
        results.push({ ...item, success: true });
        log('info', `${dryRun ? 'Would move' : 'Moved'}: ${item.from} → ${item.to}`);
      }
      
      else if (item.action === 'update_terminology') {
        if (!dryRun) {
          let content = fs.readFileSync(item.file, 'utf-8');
          
          item.changes.forEach(change => {
            // Replace in JSON keys
            const keyPattern = new RegExp(`"${change.from}"\\s*:`, 'g');
            content = content.replace(keyPattern, `"${change.to}":`);
          });
          
          fs.writeFileSync(item.file, content, 'utf-8');
        }
        
        results.push({ ...item, success: true });
        log('info', `${dryRun ? 'Would update' : 'Updated'} terminology in: ${item.file}`);
      }
      
    } catch (error) {
      results.push({ ...item, success: false, error: error.message });
      log('error', `Failed to migrate ${item.from}: ${error.message}`);
    }
  });

  return {
    success: results.every(r => r.success),
    results,
    migratedCount: results.filter(r => r.success).length
  };
}

/**
 * Main migration function
 * @param {Object} options - Migration options
 * @returns {Object} Migration result
 */
async function migrateProject(options = {}) {
  const { 
    dryRun = false, 
    force = false, 
    yes = false,
    outputFormat = 'text'
  } = options;
  
  const projectRoot = findProjectRoot() || process.cwd();

  log('info', `Starting migration analysis in: ${projectRoot}`);

  // Check if already migrated
  const newConfigDir = path.join(projectRoot, CONFIG_DIR);
  if (fs.existsSync(newConfigDir) && !force) {
    const message = `.taskmaster-ai directory already exists. Use --force to re-run migration.`;
    
    if (outputFormat === 'json') {
      return { success: true, message, alreadyMigrated: true };
    }
    
    log('warn', message);
    return { success: true, alreadyMigrated: true };
  }

  // Analyze what needs migration
  const migrationPlan = analyzeMigrationNeeds(projectRoot);

  if (migrationPlan.length === 0) {
    const message = 'No files to migrate. Project may already be using the new structure.';
    
    if (outputFormat === 'json') {
      return { success: true, message, nothingToMigrate: true };
    }
    
    log('info', message);
    return { success: true, nothingToMigrate: true };
  }

  // Show migration plan
  if (outputFormat === 'text' && !isSilentMode()) {
    console.log(
      boxen(
        chalk.white.bold('Migration Plan') +
          '\n\n' +
          migrationPlan.map(item => {
            const action = dryRun ? 'Would' : 'Will';
            if (item.action === 'update_terminology') {
              return `${chalk.cyan(action)} update terminology in: ${chalk.yellow(item.file)}`;
            }
            return `${chalk.cyan(action)} ${item.action}: ${chalk.yellow(item.from)} → ${chalk.green(item.to)}`;
          }).join('\n'),
        {
          padding: 1,
          borderColor: 'blue',
          borderStyle: 'round',
          margin: { top: 1, bottom: 1 }
        }
      )
    );
  }

  if (dryRun) {
    const message = 'Dry run complete. Run without --dry-run to perform migration.';
    
    if (outputFormat === 'json') {
      return { success: true, dryRun: true, plan: migrationPlan };
    }
    
    log('info', message);
    return { success: true, dryRun: true, plan: migrationPlan };
  }

  // Confirm migration (CLI only, skip if yes flag)
  if (!yes && outputFormat === 'text') {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('Proceed with migration? (y/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      log('info', 'Migration cancelled.');
      return { success: false, cancelled: true };
    }
  }

  // Execute migration
  const result = executeMigration(projectRoot, migrationPlan, { dryRun });

  // Show results
  if (outputFormat === 'text' && !isSilentMode()) {
    if (result.success) {
      console.log(
        boxen(
          chalk.green.bold('✓ Migration Complete') +
            `\n\nMigrated ${result.migratedCount} item(s) successfully.`,
          {
            padding: 1,
            borderColor: 'green',
            borderStyle: 'round'
          }
        )
      );
    } else {
      console.log(
        boxen(
          chalk.yellow.bold('⚠ Migration Partial') +
            `\n\nSome items could not be migrated. Check the logs for details.`,
          {
            padding: 1,
            borderColor: 'yellow',
            borderStyle: 'round'
          }
        )
      );
    }
  }

  return result;
}

/**
 * Check if migration is needed
 * @param {string} projectRoot - Project root directory
 * @returns {boolean} True if migration is needed
 */
function isMigrationNeeded(projectRoot) {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const plan = analyzeMigrationNeeds(root);
  return plan.length > 0;
}

export { 
  migrateProject, 
  analyzeMigrationNeeds, 
  executeMigration,
  isMigrationNeeded
};
export default migrateProject;
