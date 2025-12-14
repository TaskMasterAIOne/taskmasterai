/**
 * Context Gatherer Utility
 * Gathers context from tasks, files, and project structure
 * Copyright (c) 2025 TaskMaster AI LLC
 */

import fs from 'fs';
import path from 'path';

import {
  log,
  readJSON,
  truncate,
  getConfigDir,
  findProjectRoot
} from '../utils.js';

/**
 * Context Gatherer class for collecting project context
 */
class ContextGatherer {
  constructor(projectRoot = null, context = null) {
    this.projectRoot = projectRoot || findProjectRoot() || process.cwd();
    this.context = context || 'main';
    this.configDir = getConfigDir(this.projectRoot);
  }
  
  /**
   * Gather context from various sources
   * @param {Object} options - Gathering options
   * @param {Array<string>} [options.tasks] - Task IDs to include
   * @param {Array<string>} [options.files] - File paths to include
   * @param {boolean} [options.includeTree] - Include project tree
   * @param {string} [options.format] - Output format (text/research)
   * @param {number} [options.maxLength] - Max context length
   * @returns {Object} Gathered context
   */
  async gather(options = {}) {
    const {
      tasks = [],
      files = [],
      includeTree = false,
      format = 'text',
      maxLength = 10000
    } = options;
    
    const sections = [];
    
    // Gather task context
    if (tasks.length > 0) {
      const taskContext = await this.gatherTaskContext(tasks);
      if (taskContext) {
        sections.push({
          type: 'tasks',
          content: taskContext
        });
      }
    }
    
    // Gather file context
    if (files.length > 0) {
      const fileContext = await this.gatherFileContext(files);
      if (fileContext) {
        sections.push({
          type: 'files',
          content: fileContext
        });
      }
    }
    
    // Gather project tree
    if (includeTree) {
      const treeContext = this.gatherTreeContext();
      if (treeContext) {
        sections.push({
          type: 'tree',
          content: treeContext
        });
      }
    }
    
    // Format output
    let context = '';
    
    if (format === 'research') {
      context = this.formatForResearch(sections);
    } else {
      context = sections.map(s => s.content).join('\n\n');
    }
    
    // Truncate if needed
    if (context.length > maxLength) {
      context = truncate(context, maxLength);
    }
    
    return {
      context,
      sections,
      length: context.length
    };
  }
  
  /**
   * Gather context from tasks
   * @param {Array<string>} taskIds - Task IDs
   * @returns {string} Task context
   */
  async gatherTaskContext(taskIds) {
    const tasksPath = path.join(this.configDir, 'tasks', 'tasks.json');
    
    if (!fs.existsSync(tasksPath)) {
      log('warn', 'Tasks file not found');
      return null;
    }
    
    const data = readJSON(tasksPath, this.projectRoot, this.context);
    if (!data?.tasks) return null;
    
    const lines = ['## Task Context\n'];
    
    for (const taskId of taskIds) {
      const task = this.findTask(data.tasks, taskId);
      if (task) {
        lines.push(`### Task ${taskId}: ${task.title}`);
        lines.push(`Status: ${task.status || 'pending'}`);
        lines.push(`Priority: ${task.priority || 'medium'}`);
        if (task.description) {
          lines.push(`Description: ${task.description}`);
        }
        if (task.details) {
          lines.push(`Details:\n${truncate(task.details, 500)}`);
        }
        
        // Include steps if present
        const steps = task.steps || task.subtasks || [];
        if (steps.length > 0) {
          lines.push(`\nSteps:`);
          for (const step of steps) {
            lines.push(`  - [${step.status || 'pending'}] ${step.title}`);
          }
        }
        
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Find a task by ID (supports step IDs)
   * @param {Array} tasks - Tasks array
   * @param {string} taskId - Task ID
   * @returns {Object|null} Found task
   */
  findTask(tasks, taskId) {
    const idStr = String(taskId);
    
    if (idStr.includes('.')) {
      const [parentId, stepId] = idStr.split('.').map(Number);
      const parent = tasks.find(t => t.id === parentId);
      if (parent) {
        const steps = parent.steps || parent.subtasks || [];
        return steps.find(s => s.id === stepId);
      }
      return null;
    }
    
    return tasks.find(t => t.id === parseInt(idStr, 10));
  }
  
  /**
   * Gather context from files
   * @param {Array<string>} filePaths - File paths
   * @returns {string} File context
   */
  async gatherFileContext(filePaths) {
    const lines = ['## File Context\n'];
    
    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(this.projectRoot, filePath);
        
        if (!fs.existsSync(fullPath)) {
          lines.push(`### ${filePath} (not found)`);
          continue;
        }
        
        const stat = fs.statSync(fullPath);
        if (stat.size > 100000) {
          lines.push(`### ${filePath} (file too large: ${(stat.size / 1024).toFixed(1)}KB)`);
          continue;
        }
        
        const content = fs.readFileSync(fullPath, 'utf-8');
        lines.push(`### ${filePath}`);
        lines.push('```');
        lines.push(truncate(content, 2000));
        lines.push('```');
        lines.push('');
      } catch (error) {
        lines.push(`### ${filePath} (error: ${error.message})`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Gather project tree context
   * @returns {string} Tree context
   */
  gatherTreeContext() {
    const lines = ['## Project Structure\n'];
    lines.push('```');
    lines.push(this.buildTree(this.projectRoot));
    lines.push('```');
    return lines.join('\n');
  }
  
  /**
   * Build a directory tree
   * @param {string} dir - Directory path
   * @param {number} depth - Current depth
   * @returns {string} Tree representation
   */
  buildTree(dir, depth = 0, maxDepth = 3) {
    if (depth >= maxDepth) return '';
    
    const lines = [];
    const indent = '  '.repeat(depth);
    
    try {
      const items = fs.readdirSync(dir);
      
      const filtered = items.filter(item => {
        if (item.startsWith('.')) return false;
        if (['node_modules', 'dist', 'build', 'coverage', '__pycache__', 'venv'].includes(item)) {
          return false;
        }
        return true;
      }).sort();
      
      for (const item of filtered.slice(0, 15)) {
        const fullPath = path.join(dir, item);
        
        try {
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            lines.push(`${indent}${item}/`);
            if (depth < maxDepth - 1) {
              const subtree = this.buildTree(fullPath, depth + 1, maxDepth);
              if (subtree) lines.push(subtree);
            }
          } else {
            lines.push(`${indent}${item}`);
          }
        } catch {
          // Skip inaccessible items
        }
      }
      
      if (filtered.length > 15) {
        lines.push(`${indent}... and ${filtered.length - 15} more`);
      }
    } catch (error) {
      return `${indent}[Error: ${error.message}]`;
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format context for research queries
   * @param {Array} sections - Context sections
   * @returns {string} Formatted context
   */
  formatForResearch(sections) {
    const lines = ['# Project Context for Research\n'];
    
    for (const section of sections) {
      lines.push(section.content);
      lines.push('\n---\n');
    }
    
    return lines.join('\n');
  }
}

export { ContextGatherer };
export default ContextGatherer;
