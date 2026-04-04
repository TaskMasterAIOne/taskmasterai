import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Helpers
function setupProject(tmpDir) {
  const configDir = path.join(tmpDir, '.taskmaster-ai');
  const tasksDir = path.join(configDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(path.join(configDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(configDir, 'reports'), { recursive: true });

  const config = {
    projectName: 'Test',
    version: '0.1.0',
    models: {
      main: { provider: 'google', modelId: 'gemini-2.5-flash', maxTokens: 8192, temperature: 0.7 },
      research: { provider: 'google', modelId: 'gemini-2.5-pro', maxTokens: 8192, temperature: 0.5 },
      fallback: { provider: 'google', modelId: 'gemini-2.0-flash', maxTokens: 4096, temperature: 0.7 },
    },
    defaults: { numTasks: 10, numSubtasks: 5, priority: 'medium' },
    global: { defaultTag: 'master', logLevel: 'info' },
  };
  fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config));

  const state = { currentTag: 'master', lastSwitched: new Date().toISOString() };
  fs.writeFileSync(path.join(configDir, 'state.json'), JSON.stringify(state));

  const tasksData = {
    tags: {
      master: {
        tasks: [
          { id: 1, title: 'Task One', description: 'First task', status: 'pending', priority: 'high', dependencies: [], details: '', testStrategy: '', subtasks: [] },
          { id: 2, title: 'Task Two', description: 'Second task', status: 'pending', priority: 'medium', dependencies: [1], details: '', testStrategy: '', subtasks: [] },
          { id: 3, title: 'Task Three', description: 'Third task', status: 'done', priority: 'low', dependencies: [], details: '', testStrategy: '', subtasks: [
            { id: 1, title: 'Sub 3.1', description: 'First subtask', status: 'done', details: '' },
            { id: 2, title: 'Sub 3.2', description: 'Second subtask', status: 'pending', details: '' },
          ]},
        ],
        metadata: { createdAt: new Date().toISOString() },
      },
    },
  };
  fs.writeFileSync(path.join(tasksDir, 'tasks.json'), JSON.stringify(tasksData));
  return tmpDir;
}

describe('tasks.js – findTaskById', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should find a top-level task by numeric id', async () => {
    const { findTaskById } = await import('../src/lib/tasks.js');
    const task = findTaskById(1, tmpDir);
    assert.ok(task, 'Task 1 should exist');
    assert.equal(task.title, 'Task One');
  });

  it('should find a subtask by dot notation', async () => {
    const { findTaskById } = await import('../src/lib/tasks.js');
    const sub = findTaskById('3.1', tmpDir);
    assert.ok(sub, 'Subtask 3.1 should exist');
    assert.equal(sub.title, 'Sub 3.1');
  });

  it('should return null for non-existent task', async () => {
    const { findTaskById } = await import('../src/lib/tasks.js');
    const result = findTaskById(999, tmpDir);
    assert.equal(result, null);
  });
});

describe('tasks.js – addTask and deleteTask', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add a task and assign the next ID', async () => {
    const { addTask, getAllTasks } = await import('../src/lib/tasks.js');
    const newTask = addTask({
      title: 'New Task',
      description: 'Added by test',
      status: 'pending',
      priority: 'medium',
      dependencies: [],
      details: '',
      testStrategy: '',
    }, tmpDir);

    assert.ok(newTask.id > 3, 'New task should have ID > 3');
    const all = getAllTasks(tmpDir);
    assert.ok(all.find(t => t.id === newTask.id), 'New task should be in the list');
  });

  it('should delete a task by id', async () => {
    const { deleteTask, findTaskById } = await import('../src/lib/tasks.js');
    const result = deleteTask(1, tmpDir);
    assert.ok(result, 'deleteTask should return truthy');
    const after = findTaskById(1, tmpDir);
    assert.equal(after, null, 'Task 1 should be gone');
  });
});

describe('tasks.js – setTaskStatus', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should update task status', async () => {
    const { setTaskStatus, findTaskById } = await import('../src/lib/tasks.js');
    setTaskStatus(1, 'in-progress', tmpDir);
    const task = findTaskById(1, tmpDir);
    assert.equal(task.status, 'in-progress');
  });
});

describe('tasks.js – addSubtasks and clearSubtasks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add subtasks to a task', async () => {
    const { addSubtasks, findTaskById } = await import('../src/lib/tasks.js');
    addSubtasks(1, [
      { title: 'Sub A', description: 'First sub', status: 'pending' },
      { title: 'Sub B', description: 'Second sub', status: 'pending' },
    ], false, tmpDir);

    const task = findTaskById(1, tmpDir);
    assert.ok(task.subtasks.length >= 2, 'Task 1 should have subtasks');
  });

  it('should clear subtasks when replace=true', async () => {
    const { addSubtasks, findTaskById } = await import('../src/lib/tasks.js');
    addSubtasks(3, [
      { title: 'Replacement', description: 'Only one', status: 'pending' },
    ], true, tmpDir);

    const task = findTaskById(3, tmpDir);
    assert.equal(task.subtasks.length, 1, 'Replace should clear existing subtasks');
    assert.equal(task.subtasks[0].title, 'Replacement');
  });

  it('clearSubtasks should remove all subtasks', async () => {
    const { clearSubtasks, findTaskById } = await import('../src/lib/tasks.js');
    clearSubtasks(3, tmpDir);
    const task = findTaskById(3, tmpDir);
    assert.equal(task.subtasks.length, 0);
  });
});

describe('tasks.js – removeSubtask', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should remove a subtask by dot ID', async () => {
    const { removeSubtask, findTaskById } = await import('../src/lib/tasks.js');
    const result = removeSubtask('3.1', {}, tmpDir);
    assert.equal(result.removed.title, 'Sub 3.1');
    const task = findTaskById(3, tmpDir);
    assert.equal(task.subtasks.length, 1);
  });

  it('should throw for invalid (non-dot) ID', async () => {
    const { removeSubtask } = await import('../src/lib/tasks.js');
    assert.throws(() => removeSubtask('3', {}, tmpDir), /subtask ID/);
  });

  it('should convert subtask to standalone task when convert=true', async () => {
    const { removeSubtask, getAllTasks } = await import('../src/lib/tasks.js');
    const result = removeSubtask('3.2', { convert: true }, tmpDir);
    assert.ok(result.convertedTask, 'Should have a convertedTask');
    assert.ok(result.convertedTask.id > 3, 'Converted task gets new ID');
    assert.equal(result.convertedTask.title, 'Sub 3.2');

    const all = getAllTasks(tmpDir);
    assert.ok(all.find(t => t.id === result.convertedTask.id), 'Converted task is in the list');
  });
});

describe('tasks.js – dependencies', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should add a dependency', async () => {
    const { addDependency, findTaskById } = await import('../src/lib/tasks.js');
    addDependency(1, 3, tmpDir);
    const task = findTaskById(1, tmpDir);
    assert.ok(task.dependencies.includes(3));
  });

  it('should remove a dependency', async () => {
    const { removeDependency, findTaskById } = await import('../src/lib/tasks.js');
    removeDependency(2, 1, tmpDir);
    const task = findTaskById(2, tmpDir);
    assert.ok(!task.dependencies.includes(1));
  });

  it('validateDependencies should detect invalid refs', async () => {
    const { getAllTasks, saveAllTasks, validateDependencies } = await import('../src/lib/tasks.js');
    // addDependency refuses to add a dep on a non-existent task, so inject directly
    const tasks = getAllTasks(tmpDir);
    const task = tasks.find(t => t.id === 1);
    task.dependencies.push(999);
    saveAllTasks(tasks, tmpDir);

    const issues = validateDependencies(tmpDir);
    assert.ok(issues.length > 0, 'Should find dependency on non-existent task');
  });
});

describe('tasks.js – tag operations', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('getCurrentTag should return master by default', async () => {
    const { getCurrentTag } = await import('../src/lib/tasks.js');
    assert.equal(getCurrentTag(tmpDir), 'master');
  });

  it('createTag should create a new empty tag', async () => {
    const { createTag, getAllTags } = await import('../src/lib/tasks.js');
    createTag('feature-x', {}, tmpDir);
    const tags = getAllTags(tmpDir);
    assert.ok(tags.find(t => t.name === 'feature-x'), 'New tag should exist');
  });

  it('switchTag should change current tag', async () => {
    const { createTag, switchTag, getCurrentTag } = await import('../src/lib/tasks.js');
    createTag('dev', {}, tmpDir);
    switchTag('dev', tmpDir);
    assert.equal(getCurrentTag(tmpDir), 'dev');
  });

  it('copyTag should duplicate tasks', async () => {
    const { copyTag, getTasksForTag } = await import('../src/lib/tasks.js');
    copyTag('master', 'backup', {}, tmpDir);
    const backupTasks = getTasksForTag('backup', tmpDir);
    assert.ok(backupTasks.length > 0, 'Copied tag should have tasks');
  });

  it('renameTag should rename and preserve tasks', async () => {
    const { createTag, renameTag, getAllTags, getTasksForTag } = await import('../src/lib/tasks.js');
    createTag('old-name', {}, tmpDir);
    renameTag('old-name', 'new-name', tmpDir);
    const tags = getAllTags(tmpDir);
    assert.ok(!tags.find(t => t.name === 'old-name'), 'Old name should be gone');
    assert.ok(tags.find(t => t.name === 'new-name'), 'New name should exist');
  });

  it('deleteTagData should remove a tag', async () => {
    const { createTag, deleteTagData, getAllTags } = await import('../src/lib/tasks.js');
    createTag('temp', {}, tmpDir);
    deleteTagData('temp', tmpDir);
    const tags = getAllTags(tmpDir);
    assert.ok(!tags.find(t => t.name === 'temp'), 'Deleted tag should be gone');
  });
});

describe('tasks.js – getNextTask', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-tasks-'));
    setupProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return a task with all dependencies satisfied', async () => {
    const { getNextTask } = await import('../src/lib/tasks.js');
    const next = getNextTask(tmpDir);
    assert.ok(next, 'Should return a next task');
    // Task 1 has no deps and is pending -> should be next
    assert.equal(next.id, 1);
  });
});
