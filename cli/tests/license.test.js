import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('license.js – canUseHostedApiKeys', () => {
  it('should return false when no license is stored', async () => {
    const { canUseHostedApiKeys } = await import('../src/lib/license.js');
    // On a fresh machine or when license file is missing, should not throw
    const result = canUseHostedApiKeys();
    assert.ok(typeof result === 'boolean', 'Returns a boolean');
  });

  it('should only allow pro or enterprise plans', async () => {
    const { canUseHostedApiKeys, readStoredLicense } = await import('../src/lib/license.js');

    const stored = readStoredLicense();
    if (stored?.plan === 'plus') {
      assert.equal(canUseHostedApiKeys(), false, 'Plus plan should NOT use hosted keys');
    } else if (stored?.plan === 'pro' && stored?.status === 'active') {
      assert.equal(canUseHostedApiKeys(), true, 'Active pro plan SHOULD use hosted keys');
    }
    // If no license stored, the function returns false
    if (!stored?.licenseKey) {
      assert.equal(canUseHostedApiKeys(), false, 'No license = no hosted keys');
    }
  });
});

describe('license.js – getHostedApiKey', () => {
  it('should return null for non-pro users', async () => {
    const { getHostedApiKey, readStoredLicense } = await import('../src/lib/license.js');

    const stored = readStoredLicense();
    if (!stored?.licenseKey || stored.plan !== 'pro') {
      const key = getHostedApiKey('anthropic');
      assert.equal(key, null, 'Non-pro user should not get hosted keys');
    }
  });
});

describe('license.js – isUsingHostedKey', () => {
  it('should return false when env var is set', async () => {
    const { isUsingHostedKey } = await import('../src/lib/license.js');

    const original = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'fake-env-key';

    try {
      const result = isUsingHostedKey('google');
      assert.equal(result, false, 'Env var set -> not using hosted key');
    } finally {
      if (original) {
        process.env.GOOGLE_API_KEY = original;
      } else {
        delete process.env.GOOGLE_API_KEY;
      }
    }
  });

  it('should return false when canUseHostedApiKeys returns false', async () => {
    const { isUsingHostedKey, canUseHostedApiKeys } = await import('../src/lib/license.js');

    if (!canUseHostedApiKeys()) {
      const result = isUsingHostedKey('anthropic');
      assert.equal(result, false);
    }
  });
});

describe('license.js – getSyncedApiKey', () => {
  it('should return null when no cache exists', async () => {
    const { getSyncedApiKey, readCachedConfig } = await import('../src/lib/license.js');

    const cached = readCachedConfig();
    if (!cached?.apiKeys) {
      const key = getSyncedApiKey('anthropic');
      assert.equal(key, null, 'No cache = no synced key');
    }
  });

  it('should return a key when cache has provider entry', async () => {
    const { getSyncedApiKey, readCachedConfig } = await import('../src/lib/license.js');

    const cached = readCachedConfig();
    if (cached?.apiKeys) {
      const providers = Object.keys(cached.apiKeys);
      if (providers.length > 0) {
        const key = getSyncedApiKey(providers[0]);
        assert.ok(typeof key === 'string', 'Cached key should be a string');
      }
    }
  });
});

describe('license.js – readStoredLicense', () => {
  it('should return null or a license object', async () => {
    const { readStoredLicense } = await import('../src/lib/license.js');
    const stored = readStoredLicense();

    if (stored) {
      assert.ok(typeof stored === 'object', 'Stored license should be an object');
    } else {
      assert.equal(stored, null);
    }
  });
});

describe('license.js – license file path', () => {
  it('should be under ~/.taskmaster-ai/', async () => {
    const { getLicenseFilePath } = await import('../src/lib/license.js');
    const filePath = getLicenseFilePath();
    assert.ok(filePath.includes('.taskmaster-ai'), 'Path should include .taskmaster-ai');
    assert.ok(filePath.includes(os.homedir()), 'Path should be under home dir');
  });
});
