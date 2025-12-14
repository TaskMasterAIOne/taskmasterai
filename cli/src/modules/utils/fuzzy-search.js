/**
 * Fuzzy Task Search Utility
 * Provides fuzzy search capabilities for tasks
 * Copyright (c) 2025 TaskMaster AI LLC
 */

/**
 * Fuzzy Task Search class
 */
class FuzzyTaskSearch {
  constructor(tasks = [], commandContext = '') {
    this.tasks = tasks;
    this.commandContext = commandContext;
  }
  
  /**
   * Find relevant tasks based on a search query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {number} [options.maxResults] - Maximum results to return
   * @param {boolean} [options.includeSelf] - Include the querying task
   * @param {number} [options.threshold] - Match threshold (0-1)
   * @returns {Array} Matching tasks with scores
   */
  findRelevantTasks(query, options = {}) {
    const {
      maxResults = 5,
      includeSelf = false,
      threshold = 0.3
    } = options;
    
    if (!query || !this.tasks.length) {
      return [];
    }
    
    const queryWords = this.tokenize(query);
    const results = [];
    
    for (const task of this.tasks) {
      const score = this.calculateScore(task, queryWords);
      
      if (score >= threshold) {
        results.push({
          task,
          score,
          id: task.id
        });
      }
    }
    
    // Sort by score (descending) and take top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  /**
   * Calculate match score for a task
   * @param {Object} task - Task object
   * @param {Array<string>} queryWords - Query words
   * @returns {number} Score (0-1)
   */
  calculateScore(task, queryWords) {
    const taskText = [
      task.title || '',
      task.description || '',
      (task.details || '').substring(0, 500)
    ].join(' ').toLowerCase();
    
    const taskWords = this.tokenize(taskText);
    
    if (taskWords.length === 0) return 0;
    
    let matchCount = 0;
    let partialMatches = 0;
    
    for (const queryWord of queryWords) {
      // Exact match
      if (taskWords.includes(queryWord)) {
        matchCount++;
        continue;
      }
      
      // Partial match (word contains query word or vice versa)
      for (const taskWord of taskWords) {
        if (taskWord.includes(queryWord) || queryWord.includes(taskWord)) {
          partialMatches += 0.5;
          break;
        }
        
        // Levenshtein-like similarity for close matches
        if (this.similarity(queryWord, taskWord) > 0.7) {
          partialMatches += 0.3;
          break;
        }
      }
    }
    
    const totalMatches = matchCount + partialMatches;
    return Math.min(1, totalMatches / queryWords.length);
  }
  
  /**
   * Tokenize text into words
   * @param {string} text - Text to tokenize
   * @returns {Array<string>} Words
   */
  tokenize(text) {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }
  
  /**
   * Calculate similarity between two strings
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Similarity (0-1)
   */
  similarity(s1, s2) {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} s1 - First string
   * @param {string} s2 - Second string
   * @returns {number} Distance
   */
  levenshteinDistance(s1, s2) {
    const costs = [];
    
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1[i - 1] !== s2[j - 1]) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    
    return costs[s2.length];
  }
  
  /**
   * Get task IDs from search results
   * @param {Array} results - Search results
   * @returns {Array<string>} Task IDs
   */
  getTaskIds(results) {
    return results.map(r => String(r.id));
  }
  
  /**
   * Search by task ID pattern
   * @param {string} pattern - ID pattern (e.g., "1*", "1.2")
   * @returns {Array} Matching tasks
   */
  searchByIdPattern(pattern) {
    const results = [];
    
    for (const task of this.tasks) {
      const taskId = String(task.id);
      
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        if (regex.test(taskId)) {
          results.push({ task, id: task.id, score: 1 });
        }
      } else if (taskId === pattern) {
        results.push({ task, id: task.id, score: 1 });
      }
    }
    
    return results;
  }
}

export { FuzzyTaskSearch };
export default FuzzyTaskSearch;
