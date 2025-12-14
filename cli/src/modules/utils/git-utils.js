/**
 * Git Utilities
 * Helper functions for Git operations
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import { execSync, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

import { log } from '../utils.js';

/**
 * Check if a directory is a Git repository
 * @param {string} dir - Directory path
 * @returns {boolean} True if Git repo
 */
function isGitRepo(dir = process.cwd()) {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      cwd: dir,
      stdio: 'pipe'
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current Git branch name
 * @param {string} dir - Directory path
 * @returns {string|null} Branch name or null
 */
function getCurrentBranch(dir = process.cwd()) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    return branch;
  } catch {
    return null;
  }
}

/**
 * Get the Git root directory
 * @param {string} dir - Starting directory
 * @returns {string|null} Git root path or null
 */
function getGitRoot(dir = process.cwd()) {
  try {
    const root = execSync('git rev-parse --show-toplevel', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    return root;
  } catch {
    return null;
  }
}

/**
 * Get the current commit hash
 * @param {string} dir - Directory path
 * @param {boolean} short - Use short hash
 * @returns {string|null} Commit hash or null
 */
function getCurrentCommit(dir = process.cwd(), short = true) {
  try {
    const cmd = short ? 'git rev-parse --short HEAD' : 'git rev-parse HEAD';
    const hash = execSync(cmd, {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    return hash;
  } catch {
    return null;
  }
}

/**
 * Check if there are uncommitted changes
 * @param {string} dir - Directory path
 * @returns {boolean} True if there are changes
 */
function hasUncommittedChanges(dir = process.cwd()) {
  try {
    const status = execSync('git status --porcelain', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    }).trim();
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get list of changed files
 * @param {string} dir - Directory path
 * @returns {Array<Object>} List of changed files
 */
function getChangedFiles(dir = process.cwd()) {
  try {
    const output = execSync('git status --porcelain', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    const files = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      
      const status = line.substring(0, 2);
      const filePath = line.substring(3);
      
      files.push({
        status: status.trim(),
        path: filePath,
        isAdded: status.includes('A'),
        isModified: status.includes('M'),
        isDeleted: status.includes('D'),
        isUntracked: status.includes('?')
      });
    }
    
    return files;
  } catch {
    return [];
  }
}

/**
 * Get recent commit messages
 * @param {string} dir - Directory path
 * @param {number} count - Number of commits
 * @returns {Array<Object>} Commit info
 */
function getRecentCommits(dir = process.cwd(), count = 5) {
  try {
    const output = execSync(
      `git log -${count} --pretty=format:"%h|%s|%an|%ar"`,
      {
        cwd: dir,
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );
    
    const commits = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      
      const [hash, message, author, date] = line.split('|');
      commits.push({ hash, message, author, date });
    }
    
    return commits;
  } catch {
    return [];
  }
}

/**
 * Create a Git branch
 * @param {string} branchName - Branch name
 * @param {string} dir - Directory path
 * @returns {boolean} Success
 */
function createBranch(branchName, dir = process.cwd()) {
  try {
    execSync(`git checkout -b ${branchName}`, {
      cwd: dir,
      stdio: 'pipe'
    });
    log('info', `Created and switched to branch: ${branchName}`);
    return true;
  } catch (error) {
    log('error', `Failed to create branch: ${error.message}`);
    return false;
  }
}

/**
 * Switch to a Git branch
 * @param {string} branchName - Branch name
 * @param {string} dir - Directory path
 * @returns {boolean} Success
 */
function switchBranch(branchName, dir = process.cwd()) {
  try {
    execSync(`git checkout ${branchName}`, {
      cwd: dir,
      stdio: 'pipe'
    });
    log('info', `Switched to branch: ${branchName}`);
    return true;
  } catch (error) {
    log('error', `Failed to switch branch: ${error.message}`);
    return false;
  }
}

/**
 * Stage files for commit
 * @param {Array<string>} files - File paths (or ['.'] for all)
 * @param {string} dir - Directory path
 * @returns {boolean} Success
 */
function stageFiles(files = ['.'], dir = process.cwd()) {
  try {
    const fileList = files.join(' ');
    execSync(`git add ${fileList}`, {
      cwd: dir,
      stdio: 'pipe'
    });
    return true;
  } catch (error) {
    log('error', `Failed to stage files: ${error.message}`);
    return false;
  }
}

/**
 * Create a commit
 * @param {string} message - Commit message
 * @param {string} dir - Directory path
 * @returns {boolean} Success
 */
function commit(message, dir = process.cwd()) {
  try {
    // Escape quotes in message
    const escapedMessage = message.replace(/"/g, '\\"');
    execSync(`git commit -m "${escapedMessage}"`, {
      cwd: dir,
      stdio: 'pipe'
    });
    log('info', 'Created commit');
    return true;
  } catch (error) {
    log('error', `Failed to commit: ${error.message}`);
    return false;
  }
}

/**
 * Get a sanitized branch name from a string
 * @param {string} text - Text to convert
 * @returns {string} Branch name
 */
function toBranchName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Get all local branches
 * @param {string} dir - Directory path
 * @returns {Array<string>} Branch names
 */
function getLocalBranches(dir = process.cwd()) {
  try {
    const output = execSync('git branch', {
      cwd: dir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    return output
      .split('\n')
      .map(line => line.replace(/^\*?\s*/, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if a branch exists
 * @param {string} branchName - Branch name
 * @param {string} dir - Directory path
 * @returns {boolean} True if exists
 */
function branchExists(branchName, dir = process.cwd()) {
  return getLocalBranches(dir).includes(branchName);
}

/**
 * Check if a branch name is valid for context creation
 * Some branch names (like HEAD, main, master) shouldn't be used for contexts
 * @param {string} branchName - Branch name to validate
 * @returns {boolean} True if valid for context creation
 */
function isValidBranchForContext(branchName) {
  if (!branchName || typeof branchName !== 'string') {
    return false;
  }
  
  // Reserved/invalid branch names
  const invalidNames = ['HEAD', 'head', 'main', 'master', 'develop', 'dev'];
  if (invalidNames.includes(branchName)) {
    return false;
  }
  
  // Must have at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(branchName)) {
    return false;
  }
  
  return true;
}

/**
 * Sanitize a git branch name for use as a context name
 * Converts branch name to a valid context name (alphanumeric, hyphens, underscores)
 * @param {string} branchName - Git branch name
 * @returns {string} Sanitized context name
 */
function sanitizeBranchNameForContext(branchName) {
  if (!branchName || typeof branchName !== 'string') {
    return 'unnamed-context';
  }
  
  // Remove common prefixes like feature/, bugfix/, hotfix/, etc.
  let contextName = branchName
    .replace(/^(feature|bugfix|hotfix|release|fix|feat|chore|docs|refactor|test|style)\//i, '')
    .replace(/^(refs\/heads\/)/i, '');
  
  // Replace invalid characters with hyphens
  contextName = contextName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')   // Replace invalid chars with hyphen
    .replace(/-+/g, '-')             // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');        // Remove leading/trailing hyphens
  
  // Ensure it's not empty
  if (!contextName || contextName.length === 0) {
    return 'unnamed-context';
  }
  
  // Limit length
  if (contextName.length > 50) {
    contextName = contextName.substring(0, 50).replace(/-+$/, '');
  }
  
  return contextName;
}

/**
 * Alias for isGitRepo for consistency with main project naming
 * @param {string} dir - Directory path
 * @returns {Promise<boolean>} True if Git repo
 */
async function isGitRepository(dir = process.cwd()) {
  return isGitRepo(dir);
}

export {
  isGitRepo,
  isGitRepository,
  getCurrentBranch,
  getGitRoot,
  getCurrentCommit,
  hasUncommittedChanges,
  getChangedFiles,
  getRecentCommits,
  createBranch,
  switchBranch,
  stageFiles,
  commit,
  toBranchName,
  getLocalBranches,
  branchExists,
  isValidBranchForContext,
  sanitizeBranchNameForContext
};

export default {
  isGitRepo,
  isGitRepository,
  getCurrentBranch,
  getGitRoot,
  getCurrentCommit,
  hasUncommittedChanges,
  getChangedFiles,
  getRecentCommits,
  createBranch,
  switchBranch,
  stageFiles,
  commit,
  toBranchName,
  getLocalBranches,
  branchExists,
  isValidBranchForContext,
  sanitizeBranchNameForContext
};
