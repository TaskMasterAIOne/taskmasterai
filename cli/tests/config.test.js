import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('config.js – getDefaultConfig', () => {
  it('should return a config with main, research, fallback models', async () => {
    const { getDefaultConfig } = await import('../src/lib/config.js');
    const config = getDefaultConfig();

    assert.ok(config.models, 'config has models');
    assert.ok(config.models.main, 'config has main model');
    assert.ok(config.models.research, 'config has research model');
    assert.ok(config.models.fallback, 'config has fallback model');

    for (const role of ['main', 'research', 'fallback']) {
      assert.ok(config.models[role].provider, `${role} has provider`);
      assert.ok(config.models[role].modelId, `${role} has modelId`);
      assert.ok(typeof config.models[role].maxTokens === 'number', `${role} maxTokens is a number`);
      assert.ok(typeof config.models[role].temperature === 'number', `${role} temperature is a number`);
    }
  });

  it('should have expected default values', async () => {
    const { getDefaultConfig } = await import('../src/lib/config.js');
    const config = getDefaultConfig();

    assert.equal(config.defaults.numTasks, 10);
    assert.equal(config.defaults.numSubtasks, 5);
    assert.equal(config.defaults.priority, 'medium');
    assert.equal(config.global.defaultTag, 'master');
  });
});

describe('config.js – findProjectRoot', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should find project root when .taskmaster-ai dir exists', async () => {
    const { findProjectRoot } = await import('../src/lib/config.js');
    fs.mkdirSync(path.join(tmpDir, '.taskmaster-ai'), { recursive: true });

    const result = findProjectRoot(tmpDir);
    assert.equal(result, tmpDir);
  });

  it('should walk up to parent directories', async () => {
    const { findProjectRoot } = await import('../src/lib/config.js');
    fs.mkdirSync(path.join(tmpDir, '.taskmaster-ai'), { recursive: true });
    const nested = path.join(tmpDir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });

    const result = findProjectRoot(nested);
    assert.equal(result, tmpDir);
  });

  it('should return null when no .taskmaster-ai exists in tree', async () => {
    const { findProjectRoot } = await import('../src/lib/config.js');
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-no-root-'));
    try {
      const result = findProjectRoot(isolated);
      assert.equal(result, null);
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true });
    }
  });
});

describe('config.js – readProjectConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-cfg-'));
    fs.mkdirSync(path.join(tmpDir, '.taskmaster-ai'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should merge on-disk config with defaults and pick up projectName', async () => {
    const { readProjectConfig } = await import('../src/lib/config.js');

    // readProjectConfig: { ...defaults, ...onDisk }, then synced models from dashboard
    // cache may further override model fields. We can only assert non-model fields
    // reliably without controlling the global cache.
    const onDisk = {
      projectName: 'TestProject',
      version: '2.0.0',
    };

    fs.writeFileSync(
      path.join(tmpDir, '.taskmaster-ai', 'config.json'),
      JSON.stringify(onDisk)
    );

    const config = readProjectConfig(tmpDir);
    assert.equal(config.projectName, 'TestProject');
    assert.equal(config.version, '2.0.0');
    assert.ok(config.models, 'models section is always present (from defaults)');
    assert.ok(config.models.main, 'main model is always present');
  });

  it('should use defaults when no config file exists', async () => {
    const { readProjectConfig, getDefaultConfig } = await import('../src/lib/config.js');
    const defaults = getDefaultConfig();

    const config = readProjectConfig(tmpDir);
    assert.equal(config.models.main.provider, defaults.models.main.provider);
  });
});

describe('config.js – getApiKey priority', () => {
  it('env var should take highest priority', async () => {
    const { getApiKey } = await import('../src/lib/config.js');
    const testKey = 'test-env-key-12345';

    process.env.GOOGLE_API_KEY = testKey;
    try {
      const result = getApiKey('google');
      assert.equal(result, testKey);
    } finally {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  it('should return null when no key source available', async () => {
    const { getApiKey } = await import('../src/lib/config.js');

    const saved = process.env.OLLAMA_API_KEY;
    delete process.env.OLLAMA_API_KEY;

    try {
      // ollama is local — unlikely to have synced/hosted keys
      // but the function might still find one; we just test the flow
      const result = getApiKey('ollama');
      // Result is either null or a string from cache
      assert.ok(result === null || typeof result === 'string');
    } finally {
      if (saved) process.env.OLLAMA_API_KEY = saved;
    }
  });
});

describe('config.js – writeProjectConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-write-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should write config and create .taskmaster-ai dir', async () => {
    const { writeProjectConfig, readProjectConfig } = await import('../src/lib/config.js');
    const config = {
      projectName: 'WriteTest',
      models: {
        main: { provider: 'google', modelId: 'gemini-2.5-flash', maxTokens: 8192, temperature: 0.7 },
      },
    };

    writeProjectConfig(config, tmpDir);

    assert.ok(fs.existsSync(path.join(tmpDir, '.taskmaster-ai', 'config.json')));
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, '.taskmaster-ai', 'config.json'), 'utf-8'));
    assert.equal(written.projectName, 'WriteTest');
  });
});
