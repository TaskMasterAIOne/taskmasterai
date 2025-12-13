/**
 * Commit Message Generator
 * Generates conventional commit messages for the TDD workflow
 */

export class CommitMessageGenerator {
  /**
   * Generate a commit message for a completed subtask
   * @param {object} subtask - The completed subtask
   * @param {string} taskId - Parent task ID
   * @returns {string} - Formatted commit message
   */
  generate(subtask, taskId) {
    // Clean the title for commit message
    const title = this.cleanTitle(subtask.title);
    
    // Build the commit message
    const header = `feat(autopilot): ${title} (Task ${taskId}.${subtask.id})`;
    
    // Add body if there's a description
    if (subtask.description) {
      return `${header}\n\n${subtask.description}`;
    }
    
    return header;
  }

  /**
   * Generate a commit message with custom prefix
   * @param {string} type - Commit type (feat, fix, test, etc.)
   * @param {string} scope - Commit scope
   * @param {string} message - Commit message
   * @returns {string}
   */
  generateCustom(type, scope, message) {
    if (scope) {
      return `${type}(${scope}): ${message}`;
    }
    return `${type}: ${message}`;
  }

  /**
   * Clean a title for use in a commit message
   * @param {string} title - Raw title
   * @returns {string} - Cleaned title
   */
  cleanTitle(title) {
    if (!title) return 'implement feature';
    
    // Convert to lowercase for conventional commits
    let cleaned = title.toLowerCase();
    
    // Remove leading articles
    cleaned = cleaned.replace(/^(the|a|an)\s+/i, '');
    
    // Ensure it doesn't start with a capital letter
    cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    
    // Remove trailing punctuation
    cleaned = cleaned.replace(/[.!?]+$/, '');
    
    // Limit length
    if (cleaned.length > 50) {
      cleaned = cleaned.substring(0, 47) + '...';
    }
    
    return cleaned;
  }

  /**
   * Determine commit type based on subtask content
   * @param {object} subtask - The subtask
   * @returns {string} - Commit type
   */
  inferType(subtask) {
    const title = (subtask.title || '').toLowerCase();
    const description = (subtask.description || '').toLowerCase();
    const content = `${title} ${description}`;

    if (content.includes('test') || content.includes('spec')) {
      return 'test';
    }
    if (content.includes('fix') || content.includes('bug') || content.includes('issue')) {
      return 'fix';
    }
    if (content.includes('refactor') || content.includes('clean')) {
      return 'refactor';
    }
    if (content.includes('doc') || content.includes('readme')) {
      return 'docs';
    }
    if (content.includes('style') || content.includes('format')) {
      return 'style';
    }
    if (content.includes('config') || content.includes('setup')) {
      return 'chore';
    }

    return 'feat';
  }
}
