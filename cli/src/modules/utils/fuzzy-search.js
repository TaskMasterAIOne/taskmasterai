
class FuzzyTaskSearch {
  constructor(tasks = [], commandContext = '') {
    this.tasks = tasks;
    this.commandContext = commandContext;
  }
  
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
  
    tokenize(text) {
    if (!text) return [];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }
  
    similarity(s1, s2) {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
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
  
    getTaskIds(results) {
    return results.map(r => String(r.id));
  }
  
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
