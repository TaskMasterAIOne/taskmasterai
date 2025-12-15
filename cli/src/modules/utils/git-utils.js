
import { execSync, exec } from 'child_process';
import path from 'path';
import fs from 'fs';

import { log } from '../utils.js';

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

function toBranchName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

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

function branchExists(branchName, dir = process.cwd()) {
  return getLocalBranches(dir).includes(branchName);
}

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
