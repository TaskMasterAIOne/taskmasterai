
import { execSync } from 'child_process';

export class GitAdapter {
  constructor(projectRoot) {
    this.cwd = projectRoot;
  }

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

    isGitRepo() {
    try {
      this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

    isClean() {
    try {
      const status = this.exec('git status --porcelain');
      return status.trim() === '';
    } catch {
      return false;
    }
  }

    getCurrentBranch() {
    return this.exec('git rev-parse --abbrev-ref HEAD').trim();
  }

    branchExists(branchName) {
    try {
      this.exec(`git rev-parse --verify ${branchName}`);
      return true;
    } catch {
      return false;
    }
  }

    async createBranch(branchName) {
    if (this.branchExists(branchName)) {
      // Branch exists, just checkout
      this.exec(`git checkout ${branchName}`);
    } else {
      this.exec(`git checkout -b ${branchName}`);
    }
  }

    async commit(message, files) {
    // Stage files
    if (files && files.length > 0) {
      const fileList = files.map(f => `"${f}"`).join(' ');
      this.exec(`git add ${fileList}`);
    } else {
      this.exec('git add -A');
    }
    const status = this.exec('git status --porcelain');
    if (status.trim() === '') {
      throw new Error('No staged changes to commit');
    }
    const escapedMessage = message.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    this.exec(`git commit -m "${escapedMessage}"`);
  }

    getLastCommitHash() {
    return this.exec('git rev-parse HEAD').trim().substring(0, 7);
  }

    getChangedFiles() {
    const status = this.exec('git status --porcelain');
    return status
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.substring(3).trim());
  }
}
