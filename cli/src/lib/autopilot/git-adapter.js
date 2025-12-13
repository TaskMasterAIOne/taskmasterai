/**
 * Git Adapter
 * Handles git operations for the TDD workflow
 */

import { execSync } from 'child_process';

export class GitAdapter {
  constructor(projectRoot) {
    this.cwd = projectRoot;
  }

  /**
   * Execute a git command
   * @param {string} command - Git command to execute
   * @returns {string} - Command output
   */
  exec(command) {
    try {
      return execSync(command, { 
        cwd: this.cwd, 
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  /**
   * Check if git repository exists
   * @returns {boolean}
   */
  isGitRepo() {
    try {
      this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if working tree is clean
   * @returns {boolean}
   */
  isClean() {
    try {
      const status = this.exec('git status --porcelain');
      return status.trim() === '';
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   * @returns {string}
   */
  getCurrentBranch() {
    return this.exec('git rev-parse --abbrev-ref HEAD').trim();
  }

  /**
   * Check if branch exists
   * @param {string} branchName - Branch name to check
   * @returns {boolean}
   */
  branchExists(branchName) {
    try {
      this.exec(`git rev-parse --verify ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create and checkout a new branch
   * @param {string} branchName - Name of the branch to create
   */
  async createBranch(branchName) {
    if (this.branchExists(branchName)) {
      // Branch exists, just checkout
      this.exec(`git checkout ${branchName}`);
    } else {
      // Create and checkout new branch
      this.exec(`git checkout -b ${branchName}`);
    }
  }

  /**
   * Stage files and create a commit
   * @param {string} message - Commit message
   * @param {string[]} files - Specific files to stage (optional)
   */
  async commit(message, files) {
    // Stage files
    if (files && files.length > 0) {
      const fileList = files.map(f => `"${f}"`).join(' ');
      this.exec(`git add ${fileList}`);
    } else {
      this.exec('git add -A');
    }

    // Check if there are staged changes
    const status = this.exec('git status --porcelain');
    if (status.trim() === '') {
      throw new Error('No staged changes to commit');
    }

    // Create commit with escaped message
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    this.exec(`git commit -m "${escapedMessage}"`);
  }

  /**
   * Get the last commit hash
   * @returns {string}
   */
  getLastCommitHash() {
    return this.exec('git rev-parse HEAD').trim().substring(0, 7);
  }

  /**
   * Get list of changed files
   * @returns {string[]}
   */
  getChangedFiles() {
    const status = this.exec('git status --porcelain');
    return status
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.substring(3).trim());
  }
}
