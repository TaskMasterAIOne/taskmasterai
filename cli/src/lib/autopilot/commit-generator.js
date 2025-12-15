
export class CommitMessageGenerator {
    generate(subtask, taskId) {
    const title = this.cleanTitle(subtask.title);
    const header = `feat(autopilot): ${title} (Task ${taskId}.${subtask.id})`;
    if (subtask.description) {
      return `${header}\n\n${subtask.description}`;
    }
    
    return header;
  }

    generateCustom(type, scope, message) {
    if (scope) {
      return `${type}(${scope}): ${message}`;
    }
    return `${type}: ${message}`;
  }

    cleanTitle(title) {
    if (!title) return 'implement feature';
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
