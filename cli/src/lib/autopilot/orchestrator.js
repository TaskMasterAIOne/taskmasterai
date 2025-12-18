
import fs from 'fs';
import path from 'path';
import { findTaskById, setTaskStatus, getAllTasks } from '../tasks.js';
import { getProjectConfigDir } from '../config.js';
import { GitAdapter } from './git-adapter.js';
import { TestResultValidator } from './test-validator.js';
import { CommitMessageGenerator } from './commit-generator.js';

const WORKFLOW_PHASES = ['PREFLIGHT', 'BRANCH_SETUP', 'SUBTASK_LOOP', 'FINALIZE', 'COMPLETE'];
const TDD_PHASES = ['RED', 'GREEN', 'COMMIT'];

export class WorkflowOrchestrator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.statePath = path.join(getProjectConfigDir(projectRoot), 'workflow-state.json');
    this.git = new GitAdapter(projectRoot);
    this.validator = new TestResultValidator();
    this.commitGen = new CommitMessageGenerator();
  }

    readState() {
    if (!fs.existsSync(this.statePath)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
    } catch {
      return null;
    }
  }

    writeState(state) {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

    async start(taskId, options = {}) {
    // PREFLIGHT: Validate task and git state
    const task = findTaskById(taskId, this.projectRoot);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    if (!task.subtasks || task.subtasks.length === 0) {
      throw new Error('Task has no subtasks. Run "taskmaster expand" first.');
    }

    const existingState = this.readState();
    if (existingState && !options.force) {
      throw new Error(
        'Workflow already in progress. Use --force to override, or run "taskmaster autopilot resume".'
      );
    }
    if (!this.git.isGitRepo()) {
      throw new Error('Not a git repository. Initialize git first.');
    }

    // BRANCH_SETUP: Create git branch
    const branchName = `task-${taskId}`;
    try {
      await this.git.createBranch(branchName);
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }

    const state = {
      taskId: String(taskId),
      branchName,
      phase: 'SUBTASK_LOOP',
      tddPhase: 'RED',
      currentSubtaskIndex: 0,
      maxAttempts: options.maxAttempts || 3,
      attempts: 0,
      startedAt: new Date().toISOString(),
      errors: [],
      metadata: {},
    };
    this.writeState(state);

    // Mark task as in-progress
    setTaskStatus(taskId, 'in-progress', this.projectRoot);

    // Mark first subtask as in-progress
    const subtask = task.subtasks[0];
    setTaskStatus(`${taskId}.${subtask.id}`, 'in-progress', this.projectRoot);

    return this.getStatus();
  }

    getStatus() {
    const state = this.readState();
    if (!state) {
      return null;
    }

    const task = findTaskById(state.taskId, this.projectRoot);
    const currentSubtask = task?.subtasks?.[state.currentSubtaskIndex];
    const completed = state.currentSubtaskIndex;
    const total = task?.subtasks?.length || 0;

    return {
      taskId: state.taskId,
      branchName: state.branchName,
      phase: state.phase,
      tddPhase: state.tddPhase,
      currentSubtaskIndex: state.currentSubtaskIndex,
      maxAttempts: state.maxAttempts,
      attempts: state.attempts,
      startedAt: state.startedAt,
      errors: state.errors,
      progress: {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      currentSubtask: currentSubtask ? {
        id: currentSubtask.id,
        title: currentSubtask.title,
        status: currentSubtask.status,
        description: currentSubtask.description,
      } : null,
      subtasks: task?.subtasks?.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
      })) || [],
      canProceed: state.phase !== 'COMPLETE',
    };
  }

    getNextAction() {
    const status = this.getStatus();
    if (!status) {
      throw new Error('No active workflow. Run "taskmaster autopilot start <taskId>" first.');
    }

    if (status.phase === 'COMPLETE') {
      return {
        action: 'complete',
        description: 'Workflow is complete. Ready for review/merge.',
        phase: status.phase,
        tddPhase: null,
        taskId: status.taskId,
        branchName: status.branchName,
        progress: status.progress,
        currentSubtask: null,
        expectedFiles: [],
        context: { canProceed: false, errors: status.errors },
      };
    }

    const actions = {
      RED: {
        action: 'generate_test',
        description: 'Write a failing test for the current subtask',
        expectedFiles: ['test file'],
      },
      GREEN: {
        action: 'implement_code',
        description: 'Implement code to make tests pass',
        expectedFiles: ['implementation file'],
      },
      COMMIT: {
        action: 'commit_changes',
        description: 'Commit changes and advance to next subtask',
        expectedFiles: [],
      },
    };

    const actionInfo = actions[status.tddPhase] || actions.RED;

    return {
      ...actionInfo,
      phase: status.phase,
      tddPhase: status.tddPhase,
      taskId: status.taskId,
      branchName: status.branchName,
      progress: status.progress,
      currentSubtask: status.currentSubtask,
      context: { canProceed: status.canProceed, errors: status.errors },
    };
  }

    completePhase(testResults) {
    const state = this.readState();
    if (!state) {
      throw new Error('No active workflow');
    }

    if (state.phase === 'COMPLETE') {
      throw new Error('Workflow is already complete');
    }

    try {
      this.validator.validate(state.tddPhase, testResults);
    } catch (error) {
      // Log error
      state.errors.push({
        timestamp: new Date().toISOString(),
        phase: state.tddPhase,
        message: error.message,
      });
      state.attempts++;
      this.writeState(state);
      throw error;
    }

    // Advance TDD phase
    const tddIndex = TDD_PHASES.indexOf(state.tddPhase);
    state.tddPhase = TDD_PHASES[(tddIndex + 1) % TDD_PHASES.length];
    state.attempts = 0; // Reset attempts on success

    this.writeState(state);
    return this.getStatus();
  }

    async commit(options = {}) {
    const state = this.readState();
    if (!state) {
      throw new Error('No active workflow');
    }

    if (state.tddPhase !== 'COMMIT') {
      throw new Error(`Not in COMMIT phase. Current phase: ${state.tddPhase}`);
    }

    const task = findTaskById(state.taskId, this.projectRoot);
    const subtask = task.subtasks[state.currentSubtaskIndex];

    // Generate commit message
    const message = options.customMessage || this.commitGen.generate(subtask, state.taskId);
    try {
      await this.git.commit(message, options.files);
    } catch (error) {
      throw new Error(`Failed to commit: ${error.message}`);
    }

    const commitHash = this.git.getLastCommitHash();

    // Mark subtask done
    setTaskStatus(`${state.taskId}.${subtask.id}`, 'done', this.projectRoot);

    // Advance to next subtask or complete
    state.currentSubtaskIndex++;
    state.attempts = 0;

    if (state.currentSubtaskIndex >= task.subtasks.length) {
      // All subtasks complete
      state.phase = 'COMPLETE';
      state.tddPhase = null;
      state.completedAt = new Date().toISOString();
      setTaskStatus(state.taskId, 'done', this.projectRoot);
    } else {
      state.tddPhase = 'RED';
      const nextSubtask = task.subtasks[state.currentSubtaskIndex];
      setTaskStatus(`${state.taskId}.${nextSubtask.id}`, 'in-progress', this.projectRoot);
    }

    this.writeState(state);

    return {
      ...this.getStatus(),
      commit: {
        hash: commitHash,
        message,
      },
      isComplete: state.phase === 'COMPLETE',
    };
  }

    abort() {
    const state = this.readState();
    if (!state) {
      throw new Error('No active workflow');
    }

    fs.unlinkSync(this.statePath);

    return {
      success: true,
      message: 'Workflow aborted. Branch and code preserved.',
      taskId: state.taskId,
      branchName: state.branchName,
    };
  }

    resume() {
    const state = this.readState();
    if (!state) {
      throw new Error('No workflow to resume. Run "taskmaster autopilot start <taskId>" first.');
    }

    // Ensure we're on the right branch
    const currentBranch = this.git.getCurrentBranch();
    if (currentBranch !== state.branchName) {
      try {
        this.git.exec(`git checkout ${state.branchName}`);
      } catch (error) {
        throw new Error(`Failed to checkout workflow branch: ${error.message}`);
      }
    }

    return this.getStatus();
  }
}
