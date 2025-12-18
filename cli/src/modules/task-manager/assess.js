
import fs from 'fs';
import path from 'path';
import boxen from 'boxen';
import chalk from 'chalk';
import Table from 'cli-table3';

import {
  log,
  readJSON,
  writeJSON,
  isSilentMode,
  truncate,
  getConfigDir
} from '../utils.js';
import {
  getAssessmentWithColor,
  getStatusWithColor,
  startLoadingIndicator,
  stopLoadingIndicator
} from '../ui.js';

async function assessComplexity(options) {
  const {
    file: tasksPath,
    output: outputPath,
    threshold = 5,
    research: useResearch = false,
    projectRoot,
    context,
    id: specificIds,
    from: fromId,
    to: toId
  } = options;
  
  const outputFormat = options.outputFormat || 'text';
  let loadingIndicator = null;
  
  try {
    log('info', 'Starting task complexity assessment...');
    if (outputFormat === 'text' && !isSilentMode()) {
      loadingIndicator = startLoadingIndicator('Analyzing task complexity...');
    }
    const data = readJSON(tasksPath, projectRoot, context);
    if (!data || !data.tasks || data.tasks.length === 0) {
      throw new Error('No tasks found in tasks file');
    }
    
    // Filter tasks by status (only active tasks)
    const activeStatuses = ['pending', 'blocked', 'in-progress'];
    let tasksToAnalyze = data.tasks.filter(task =>
      activeStatuses.includes(task.status?.toLowerCase() || 'pending')
    );
    
    // Apply ID filtering if specified
    if (specificIds) {
      const ids = specificIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      tasksToAnalyze = tasksToAnalyze.filter(task => ids.includes(task.id));
      log('info', `Filtering to specific IDs: ${ids.join(', ')}`);
    }
    
    // Apply range filtering
    if (fromId !== undefined || toId !== undefined) {
      const from = fromId !== undefined ? parseInt(fromId, 10) : 0;
      const to = toId !== undefined ? parseInt(toId, 10) : Infinity;
      tasksToAnalyze = tasksToAnalyze.filter(task => task.id >= from && task.id <= to);
      log('info', `Filtering to range: ${from} - ${to === Infinity ? 'end' : to}`);
    }
    
    if (tasksToAnalyze.length === 0) {
      if (loadingIndicator) {
        stopLoadingIndicator(loadingIndicator, 'No tasks to analyze');
      }
      
      if (outputFormat === 'text' && !isSilentMode()) {
        console.log(
          boxen(
            chalk.yellow('No active tasks to analyze.') +
              '\n\n' + chalk.gray('All tasks may be completed or the filters matched no tasks.'),
            {
              padding: 1,
              borderColor: 'yellow',
              borderStyle: 'round'
            }
          )
        );
      }
      
      return { success: true, taskAnalysis: [], summary: { total: 0 } };
    }
    
    log('info', `Analyzing ${tasksToAnalyze.length} tasks...`);
    
    // Generate complexity analysis
    // In production, this would call the AI service
    const taskAnalysis = tasksToAnalyze.map(task => {
      const steps = task.steps || task.subtasks || [];
      const links = task.dependencies || task.links || [];
      let score = 3; // Base score
      
      // Factor 1: Description length
      const descLength = (task.description || '').length;
      if (descLength > 500) score += 2;
      else if (descLength > 200) score += 1;
      
      // Factor 2: Details complexity
      const detailsLength = (task.details || '').length;
      if (detailsLength > 1000) score += 2;
      else if (detailsLength > 500) score += 1;
      
      // Factor 3: Number of dependencies
      if (links.length > 3) score += 2;
      else if (links.length > 1) score += 1;
      
      // Factor 4: Priority
      if (task.priority === 'high') score += 1;
      
      // Factor 5: Existing steps (less complex if already broken down)
      if (steps.length > 0) score -= 1;
      
      // Clamp score
      score = Math.max(1, Math.min(10, score));
      
      // Recommended steps based on score
      let recommendedSteps = 3;
      if (score >= 8) recommendedSteps = 7;
      else if (score >= 6) recommendedSteps = 5;
      else if (score >= 4) recommendedSteps = 4;
      
      return {
        taskId: task.id,
        title: task.title,
        status: task.status,
        currentSteps: steps.length,
        assessmentScore: score,
        recommendedSteps,
        shouldBreakdown: score >= threshold && steps.length === 0,
        reasoning: generateReasoning(task, score),
        breakdownPrompt: generateBreakdownPrompt(task, score)
      };
    });
    
    // Sort by score (highest first)
    taskAnalysis.sort((a, b) => b.assessmentScore - a.assessmentScore);
    const summary = {
      total: taskAnalysis.length,
      highComplexity: taskAnalysis.filter(t => t.assessmentScore >= 7).length,
      mediumComplexity: taskAnalysis.filter(t => t.assessmentScore >= 4 && t.assessmentScore < 7).length,
      lowComplexity: taskAnalysis.filter(t => t.assessmentScore < 4).length,
      needsBreakdown: taskAnalysis.filter(t => t.shouldBreakdown).length,
      averageScore: Math.round(taskAnalysis.reduce((sum, t) => sum + t.assessmentScore, 0) / taskAnalysis.length * 10) / 10
    };
    
    // Build report
    const report = {
      generated: new Date().toISOString(),
      threshold,
      context: context || 'main',
      summary,
      taskAnalysis
    };

    const reportPath = outputPath || path.join(
      getConfigDir(projectRoot),
      'reports',
      context ? `assessment-report_${context}.json` : 'assessment-report.json'
    );
    
    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log('info', `Assessment report saved to: ${reportPath}`);
    
    // Stop loading
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Analyzed ${taskAnalysis.length} tasks`);
    }
    
    // JSON output
    if (outputFormat === 'json') {
      return {
        success: true,
        reportPath,
        summary,
        taskAnalysis
      };
    }
    
    // Text output
    if (!isSilentMode()) {
      // Summary box
      console.log(
        boxen(
          chalk.white.bold('📊 Task Assessment Summary') +
            `\n\n${chalk.cyan('Total tasks analyzed:')} ${summary.total}` +
            `\n${chalk.red('High complexity (7-10):')} ${summary.highComplexity}` +
            `\n${chalk.yellow('Medium complexity (4-6):')} ${summary.mediumComplexity}` +
            `\n${chalk.green('Low complexity (1-3):')} ${summary.lowComplexity}` +
            `\n${chalk.cyan('Average score:')} ${summary.averageScore}` +
            `\n\n${chalk.magenta('Recommended for breakdown:')} ${summary.needsBreakdown}`,
          {
            padding: 1,
            borderColor: 'cyan',
            borderStyle: 'round'
          }
        )
      );
      
      // Task table
      if (taskAnalysis.length > 0) {
        const table = new Table({
          head: [
            chalk.cyan.bold('ID'),
            chalk.cyan.bold('Title'),
            chalk.cyan.bold('Score'),
            chalk.cyan.bold('Steps'),
            chalk.cyan.bold('Action')
          ],
          colWidths: [6, 35, 10, 10, 15]
        });
        const displayTasks = taskAnalysis.slice(0, 15);
        displayTasks.forEach(t => {
          const action = t.shouldBreakdown 
            ? chalk.yellow('Breakdown')
            : t.currentSteps > 0 
              ? chalk.green('Has steps')
              : chalk.gray('OK');
          
          table.push([
            t.taskId,
            truncate(t.title, 33),
            getAssessmentWithColor(t.assessmentScore),
            `${t.currentSteps}/${t.recommendedSteps}`,
            action
          ]);
        });
        
        console.log('\n' + chalk.white.bold('Task Analysis:'));
        console.log(table.toString());
        
        if (taskAnalysis.length > 15) {
          console.log(chalk.gray(`\n... and ${taskAnalysis.length - 15} more tasks`));
        }
      }
      
      // Actions
      if (summary.needsBreakdown > 0) {
        const highPriorityTask = taskAnalysis.find(t => t.shouldBreakdown);
        console.log(
          boxen(
            chalk.white.bold('Recommended Actions:') +
              `\n\n${chalk.cyan('Breakdown highest priority:')} taskmaster breakdown --id=${highPriorityTask?.taskId}` +
              `\n${chalk.cyan('Breakdown all recommended:')} taskmaster breakdown --all` +
              `\n${chalk.cyan('View full report:')} taskmaster assessment-report`,
            {
              padding: 1,
              borderColor: 'gray',
              borderStyle: 'round',
              margin: { top: 1 }
            }
          )
        );
      }
      
      console.log(chalk.gray(`\nReport saved: ${reportPath}`));
    }
    
    return { success: true, report, summary, taskAnalysis };
    
  } catch (error) {
    if (loadingIndicator) {
      stopLoadingIndicator(loadingIndicator, `Error: ${error.message}`, 'error');
    }
    
    log('error', `Error assessing complexity: ${error.message}`);
    
    if (!isSilentMode() && outputFormat === 'text') {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    
    throw error;
  }
}

function generateReasoning(task, score) {
  const reasons = [];
  
  if (score >= 7) {
    reasons.push('High complexity due to multiple factors');
  }
  
  const descLength = (task.description || '').length;
  if (descLength > 500) {
    reasons.push('Extensive description indicates complex requirements');
  }
  
  const links = task.dependencies || task.links || [];
  if (links.length > 2) {
    reasons.push(`Multiple dependencies (${links.length}) add coordination complexity`);
  }
  
  if (task.priority === 'high') {
    reasons.push('High priority task requiring careful attention');
  }
  
  const steps = task.steps || task.subtasks || [];
  if (steps.length > 0) {
    reasons.push(`Already has ${steps.length} steps defined`);
  }
  
  return reasons.length > 0 ? reasons.join('. ') : 'Standard complexity level.';
}

function generateBreakdownPrompt(task, score) {
  if (score < 4) {
    return 'Task is straightforward and may not need extensive breakdown.';
  }
  
  let prompt = `Break down "${task.title}" into actionable implementation steps. `;
  
  if (task.details) {
    prompt += 'Consider the implementation details provided. ';
  }
  
  if (task.testStrategy) {
    prompt += 'Include steps for testing as described. ';
  }
  
  return prompt;
}

async function showAssessmentReport(options = {}) {
  const { projectRoot, context, outputFormat = 'text' } = options;
  
  try {
    const reportPath = path.join(
      getConfigDir(projectRoot),
      'reports',
      context ? `assessment-report_${context}.json` : 'assessment-report.json'
    );
    
    if (!fs.existsSync(reportPath)) {
      throw new Error(
        'No assessment report found. Run "taskmaster assess" first.'
      );
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    if (outputFormat === 'json') {
      return { success: true, report };
    }
    console.log(
      boxen(
        chalk.white.bold('📊 Assessment Report') +
          `\n\n${chalk.gray('Generated:')} ${new Date(report.generated).toLocaleString()}` +
          `\n${chalk.gray('Context:')} ${report.context || 'main'}` +
          `\n${chalk.gray('Threshold:')} ${report.threshold}`,
        {
          padding: 1,
          borderColor: 'cyan',
          borderStyle: 'round'
        }
      )
    );
    
    return { success: true, report };
    
  } catch (error) {
    log('error', `Error showing report: ${error.message}`);
    throw error;
  }
}

export { assessComplexity, showAssessmentReport };
export default assessComplexity;
