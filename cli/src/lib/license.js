/**
 * License Manager for TaskMaster AI
 * Handles license key validation, storage, and caching
 * Connects to Firebase backend for validation
 * Also syncs API keys and model config from dashboard
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// API endpoints - Firebase Functions URLs
// These should match the deployed function endpoints
const FUNCTIONS_BASE_URL = process.env.TASKMASTER_FUNCTIONS_URL || 
  'https://us-central1-taskmaster-ai-e2302.cloudfunctions.net';
const LICENSE_API_URL = process.env.TASKMASTER_LICENSE_API_URL || 
  `${FUNCTIONS_BASE_URL}/validateLicense`;
const CONFIG_API_URL = process.env.TASKMASTER_CONFIG_API_URL || 
  `${FUNCTIONS_BASE_URL}/getUserConfig`;
const USAGE_API_URL = process.env.TASKMASTER_USAGE_API_URL || 
  `${FUNCTIONS_BASE_URL}/incrementUsage`;

// Cache duration: 24 hours (in milliseconds)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Config sync duration: 1 hour (in milliseconds)
const CONFIG_SYNC_DURATION_MS = 60 * 60 * 1000;

// Grace period after expiry: 3 days
const GRACE_PERIOD_DAYS = 3;

/**
 * Get the path to the global license file
 * @returns {string} Path to ~/.taskmaster-ai/license.json
 */
export function getLicenseFilePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  return path.join(taskmasterDir, 'license.json');
}

/**
 * Get the path to the cached config file (API keys + models from dashboard)
 * @returns {string} Path to ~/.taskmaster-ai/config-cache.json
 */
export function getConfigCachePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  return path.join(taskmasterDir, 'config-cache.json');
}

/**
 * Ensure the ~/.taskmaster-ai directory exists
 */
function ensureTaskmasterDir() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }
}

/**
 * Read the stored license data
 * @returns {Object|null} License data or null if not found
 */
export function readStoredLicense() {
  const licensePath = getLicenseFilePath();
  
  try {
    if (fs.existsSync(licensePath)) {
      const data = fs.readFileSync(licensePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Warning: Error reading license file: ${error.message}`);
  }
  
  return null;
}

/**
 * Write license data to storage
 * @param {Object} licenseData - License data to store
 */
export function writeLicenseData(licenseData) {
  ensureTaskmasterDir();
  const licensePath = getLicenseFilePath();
  
  try {
    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save license: ${error.message}`);
  }
}

/**
 * Remove the stored license (deactivate)
 * @returns {boolean} True if successfully removed
 */
export function removeLicenseData() {
  const licensePath = getLicenseFilePath();
  
  try {
    if (fs.existsSync(licensePath)) {
      fs.unlinkSync(licensePath);
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Failed to deactivate license: ${error.message}`);
  }
}

/**
 * Check if cached validation is still valid
 * @param {Object} licenseData - Stored license data
 * @returns {boolean} True if cache is still valid
 */
function isCacheValid(licenseData) {
  if (!licenseData?.lastValidated) return false;
  
  const lastValidated = new Date(licenseData.lastValidated);
  const now = new Date();
  const elapsed = now - lastValidated;
  
  return elapsed < CACHE_DURATION_MS;
}

/**
 * Validate license key against the server
 * @param {string} licenseKey - License key to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateLicenseWithServer(licenseKey) {
  try {
    const response = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey }),
    });

    const result = await response.json();
    
    return {
      valid: result.valid === true,
      status: result.status,
      plan: result.plan,
      planName: result.planName,
      tasksPerMonth: result.tasksPerMonth,
      expiresAt: result.expiresAt,
      gracePeriodEnd: result.gracePeriodEnd,
      error: result.error,
    };
  } catch (error) {
    // If network error, allow offline grace period
    return {
      valid: false,
      offline: true,
      error: 'Unable to validate license - network error',
    };
  }
}

/**
 * Activate a license key
 * @param {string} licenseKey - License key to activate
 * @returns {Promise<Object>} Activation result
 */
export async function activateLicense(licenseKey) {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return {
      success: false,
      error: 'Invalid license key format',
    };
  }

  // Validate the license key format (should start with tm_live_ or tm_test_)
  if (!licenseKey.startsWith('tm_live_') && !licenseKey.startsWith('tm_test_')) {
    return {
      success: false,
      error: 'Invalid license key format. License keys should start with "tm_live_" or "tm_test_"',
    };
  }

  // Validate with server
  const validation = await validateLicenseWithServer(licenseKey);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'License key is not valid',
    };
  }

  // Store the license
  const licenseData = {
    licenseKey,
    plan: validation.plan,
    planName: validation.planName,
    tasksPerMonth: validation.tasksPerMonth,
    status: validation.status,
    expiresAt: validation.expiresAt,
    activatedAt: new Date().toISOString(),
    lastValidated: new Date().toISOString(),
  };

  writeLicenseData(licenseData);

  // Also sync user config (API keys + models) from dashboard
  const configSync = await syncUserConfig(true);
  
  // For PRO/Enterprise users, also sync hosted API keys
  let hostedKeysMessage = null;
  if (validation.plan === 'pro' || validation.plan === 'enterprise') {
    const hostedKeysSync = await syncHostedApiKeys(true);
    if (hostedKeysSync.success) {
      hostedKeysMessage = `Hosted API keys available: ${hostedKeysSync.providers?.join(', ') || 'all providers'}`;
    }
  }
  
  return {
    success: true,
    plan: validation.plan,
    planName: validation.planName,
    tasksPerMonth: validation.tasksPerMonth,
    expiresAt: validation.expiresAt,
    configSynced: configSync.success,
    configMessage: configSync.success 
      ? `API keys synced from dashboard` 
      : `Config sync: ${configSync.error || 'No config found'}`,
    hostedKeysAvailable: validation.plan === 'pro' || validation.plan === 'enterprise',
    hostedKeysMessage,
  };
}

/**
 * Get current license status
 * @param {boolean} forceRefresh - Force server validation even if cache is valid
 * @returns {Promise<Object>} License status
 */
export async function getLicenseStatus(forceRefresh = false) {
  const stored = readStoredLicense();

  if (!stored || !stored.licenseKey) {
    return {
      valid: false,
      activated: false,
      error: 'No license key found. Run "taskmaster activate <license-key>" to activate.',
    };
  }

  // Check if cached validation is still valid
  if (!forceRefresh && isCacheValid(stored) && stored.status === 'active') {
    return {
      valid: true,
      activated: true,
      cached: true,
      plan: stored.plan,
      planName: stored.planName,
      tasksPerMonth: stored.tasksPerMonth,
      status: stored.status,
      expiresAt: stored.expiresAt,
      lastValidated: stored.lastValidated,
    };
  }

  // Validate with server
  const validation = await validateLicenseWithServer(stored.licenseKey);

  // Handle offline mode - allow if recently validated and was active
  if (validation.offline && stored.status === 'active') {
    const lastValidated = new Date(stored.lastValidated);
    const gracePeriodEnd = new Date(lastValidated.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
    
    if (new Date() < gracePeriodEnd) {
      return {
        valid: true,
        activated: true,
        cached: true,
        offline: true,
        plan: stored.plan,
        planName: stored.planName,
        tasksPerMonth: stored.tasksPerMonth,
        status: 'active',
        expiresAt: stored.expiresAt,
        lastValidated: stored.lastValidated,
        warning: 'Offline mode - connect to internet to revalidate',
      };
    }
  }

  // Update stored data with validation result
  if (validation.valid) {
    stored.status = validation.status;
    stored.plan = validation.plan;
    stored.planName = validation.planName;
    stored.tasksPerMonth = validation.tasksPerMonth;
    stored.expiresAt = validation.expiresAt;
    stored.lastValidated = new Date().toISOString();
    writeLicenseData(stored);

    return {
      valid: true,
      activated: true,
      plan: validation.plan,
      planName: validation.planName,
      tasksPerMonth: validation.tasksPerMonth,
      status: validation.status,
      expiresAt: validation.expiresAt,
      lastValidated: stored.lastValidated,
    };
  }

  // License is invalid
  stored.status = validation.status || 'invalid';
  stored.lastValidated = new Date().toISOString();
  writeLicenseData(stored);

  return {
    valid: false,
    activated: true,
    status: validation.status,
    error: validation.error || 'License is no longer valid. Please renew your subscription.',
  };
}

/**
 * Deactivate the current license
 * @returns {Object} Deactivation result
 */
export function deactivateLicense() {
  const stored = readStoredLicense();

  if (!stored || !stored.licenseKey) {
    return {
      success: false,
      error: 'No license key is currently activated.',
    };
  }

  removeLicenseData();
  clearConfigCache(); // Also clear the synced config
  clearHostedKeysCache(); // Also clear hosted API keys

  return {
    success: true,
    message: 'License deactivated successfully.',
  };
}

/**
 * Format license status for display
 * @param {Object} status - License status object
 * @returns {string} Formatted status string
 */
export function formatLicenseStatus(status) {
  if (!status.activated) {
    return 'No license activated';
  }

  if (!status.valid) {
    return `License invalid: ${status.error}`;
  }

  const lines = [
    `Plan: ${status.planName || status.plan}`,
    `Status: ${status.status}`,
    `Tasks/month: ${status.tasksPerMonth?.toLocaleString() || 'N/A'}`,
  ];

  if (status.expiresAt) {
    const expires = new Date(status.expiresAt);
    lines.push(`Expires: ${expires.toLocaleDateString()}`);
  }

  if (status.lastValidated) {
    const validated = new Date(status.lastValidated);
    lines.push(`Last validated: ${validated.toLocaleString()}`);
  }

  if (status.cached) {
    lines.push('(Using cached validation)');
  }

  if (status.offline) {
    lines.push('⚠️  Offline mode - connect to revalidate');
  }

  if (status.warning) {
    lines.push(`⚠️  ${status.warning}`);
  }

  return lines.join('\n');
}

// ============================================
// CONFIG SYNC (API Keys + Models from Dashboard)
// ============================================

/**
 * Read the cached config from disk
 * @returns {Object|null} Cached config or null
 */
export function readCachedConfig() {
  const configPath = getConfigCachePath();
  
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Warning: Error reading config cache: ${error.message}`);
  }
  
  return null;
}

/**
 * Write config cache to disk
 * @param {Object} config - Config to cache
 */
function writeConfigCache(config) {
  ensureTaskmasterDir();
  const configPath = getConfigCachePath();
  
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`Warning: Error saving config cache: ${error.message}`);
  }
}

/**
 * Check if config cache is still valid
 * @param {Object} cachedConfig - Cached config object
 * @returns {boolean} True if cache is still valid
 */
function isConfigCacheValid(cachedConfig) {
  if (!cachedConfig?.syncedAt) return false;
  
  const syncedAt = new Date(cachedConfig.syncedAt);
  const now = new Date();
  const elapsed = now - syncedAt;
  
  return elapsed < CONFIG_SYNC_DURATION_MS;
}

/**
 * Fetch user config from server
 * @param {string} licenseKey - License key to authenticate
 * @returns {Promise<Object>} User config (apiKeys, models)
 */
async function fetchUserConfig(licenseKey) {
  try {
    const response = await fetch(CONFIG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey }),
    });

    const result = await response.json();
    
    if (result.success && result.config) {
      return {
        success: true,
        apiKeys: result.config.apiKeys || {},
        models: result.config.models || null,
        syncedAt: result.config.syncedAt || new Date().toISOString(),
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to fetch config',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Network error fetching config',
    };
  }
}

/**
 * Sync user config from dashboard (API keys + models)
 * Called during license validation or explicitly
 * @param {boolean} forceRefresh - Force refresh even if cache is valid
 * @returns {Promise<Object>} Synced config
 */
export async function syncUserConfig(forceRefresh = false) {
  const stored = readStoredLicense();
  
  if (!stored?.licenseKey) {
    return {
      success: false,
      error: 'No license key found. Activate first.',
    };
  }

  // Check if cached config is still valid
  const cachedConfig = readCachedConfig();
  if (!forceRefresh && cachedConfig && isConfigCacheValid(cachedConfig)) {
    return {
      success: true,
      cached: true,
      apiKeys: cachedConfig.apiKeys || {},
      models: cachedConfig.models || null,
      syncedAt: cachedConfig.syncedAt,
    };
  }

  // Fetch from server
  const result = await fetchUserConfig(stored.licenseKey);
  
  if (result.success) {
    // Save to cache
    const configToCache = {
      apiKeys: result.apiKeys,
      models: result.models,
      syncedAt: result.syncedAt,
    };
    writeConfigCache(configToCache);
    
    return {
      success: true,
      cached: false,
      apiKeys: result.apiKeys,
      models: result.models,
      syncedAt: result.syncedAt,
    };
  }
  
  // If fetch failed but we have cached config, return it with warning
  if (cachedConfig) {
    return {
      success: true,
      cached: true,
      offline: true,
      apiKeys: cachedConfig.apiKeys || {},
      models: cachedConfig.models || null,
      syncedAt: cachedConfig.syncedAt,
      warning: 'Using cached config (could not reach server)',
    };
  }
  
  return {
    success: false,
    error: result.error || 'Failed to sync config',
  };
}

/**
 * Get API key from synced config
 * @param {string} provider - Provider name (anthropic, openai, etc.)
 * @returns {string|null} API key or null
 */
export function getSyncedApiKey(provider) {
  const cachedConfig = readCachedConfig();
  if (!cachedConfig?.apiKeys) return null;
  return cachedConfig.apiKeys[provider] || null;
}

/**
 * Get model config from synced config
 * @returns {Object|null} Model config or null
 */
export function getSyncedModels() {
  const cachedConfig = readCachedConfig();
  return cachedConfig?.models || null;
}

/**
 * Clear the config cache (e.g., on deactivate)
 */
export function clearConfigCache() {
  const configPath = getConfigCachePath();
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  } catch (error) {
    // Ignore errors
  }
}

// ============================================
// HOSTED API KEYS (PRO Plan Only)
// Provides API keys hosted by TaskMaster AI for PRO subscribers
// ============================================

/**
 * Get the path to the hosted keys cache file
 * @returns {string} Path to ~/.taskmaster-ai/hosted-keys-cache.json
 */
export function getHostedKeysCachePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  return path.join(taskmasterDir, 'hosted-keys-cache.json');
}

/**
 * Read cached hosted keys from disk
 * @returns {Object|null} Cached hosted keys or null
 */
export function readCachedHostedKeys() {
  const cachePath = getHostedKeysCachePath();
  
  try {
    if (fs.existsSync(cachePath)) {
      const data = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Ignore errors
  }
  
  return null;
}

/**
 * Write hosted keys cache to disk
 * @param {Object} keysData - Hosted keys data to cache
 */
function writeHostedKeysCache(keysData) {
  ensureTaskmasterDir();
  const cachePath = getHostedKeysCachePath();
  
  try {
    fs.writeFileSync(cachePath, JSON.stringify(keysData, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`Warning: Error saving hosted keys cache: ${error.message}`);
  }
}

/**
 * Check if hosted keys cache is still valid
 * @param {Object} cachedKeys - Cached keys object
 * @returns {boolean} True if cache is still valid
 */
function isHostedKeysCacheValid(cachedKeys) {
  if (!cachedKeys?.fetchedAt) return false;
  
  const fetchedAt = new Date(cachedKeys.fetchedAt);
  const now = new Date();
  const elapsed = now - fetchedAt;
  
  return elapsed < HOSTED_KEYS_CACHE_DURATION_MS;
}

/**
 * Clear the hosted keys cache (e.g., on deactivate or plan change)
 */
export function clearHostedKeysCache() {
  const cachePath = getHostedKeysCachePath();
  try {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Fetch hosted API keys from server
 * @param {string} licenseKey - License key to authenticate
 * @returns {Promise<Object>} Hosted API keys
 */
async function fetchHostedApiKeys(licenseKey) {
  try {
    const response = await fetch(HOSTED_KEYS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey }),
    });

    const result = await response.json();
    
    if (result.success && result.hostedKeys) {
      return {
        success: true,
        hostedKeys: result.hostedKeys,
        providers: result.providers,
        plan: result.plan,
        fetchedAt: result.fetchedAt,
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to fetch hosted keys',
      upgrade: result.upgrade || false,
      currentPlan: result.currentPlan,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Network error fetching hosted keys',
    };
  }
}

/**
 * Sync hosted API keys from server (PRO/Enterprise plan only)
 * @param {boolean} forceRefresh - Force refresh even if cache is valid
 * @returns {Promise<Object>} Hosted keys sync result
 */
export async function syncHostedApiKeys(forceRefresh = false) {
  const stored = readStoredLicense();
  
  if (!stored?.licenseKey) {
    return {
      success: false,
      error: 'No license key found. Activate first.',
    };
  }

  // Check if user is on PRO or Enterprise plan
  if (stored.plan !== 'pro' && stored.plan !== 'enterprise') {
    return {
      success: false,
      error: 'Hosted API keys are only available for Pro and Enterprise plan subscribers',
      upgrade: true,
      currentPlan: stored.plan,
    };
  }

  // Check if cached keys are still valid
  const cachedKeys = readCachedHostedKeys();
  if (!forceRefresh && cachedKeys && isHostedKeysCacheValid(cachedKeys)) {
    return {
      success: true,
      cached: true,
      hostedKeys: cachedKeys.hostedKeys || {},
      providers: cachedKeys.providers || [],
      fetchedAt: cachedKeys.fetchedAt,
    };
  }

  // Fetch from server
  const result = await fetchHostedApiKeys(stored.licenseKey);
  
  if (result.success) {
    // Save to cache
    const dataToCache = {
      hostedKeys: result.hostedKeys,
      providers: result.providers,
      plan: result.plan,
      fetchedAt: result.fetchedAt,
    };
    writeHostedKeysCache(dataToCache);
    
    return {
      success: true,
      cached: false,
      hostedKeys: result.hostedKeys,
      providers: result.providers,
      fetchedAt: result.fetchedAt,
    };
  }
  
  // If fetch failed but we have cached keys, return them with warning
  if (cachedKeys) {
    return {
      success: true,
      cached: true,
      offline: true,
      hostedKeys: cachedKeys.hostedKeys || {},
      providers: cachedKeys.providers || [],
      fetchedAt: cachedKeys.fetchedAt,
      warning: 'Using cached hosted keys (could not reach server)',
    };
  }
  
  return {
    success: false,
    error: result.error || 'Failed to sync hosted keys',
    upgrade: result.upgrade || false,
    currentPlan: result.currentPlan,
  };
}

/**
 * Get hosted API key for a specific provider
 * Only works for PRO plan users
 * @param {string} provider - Provider name (anthropic, openai, etc.)
 * @returns {string|null} API key or null
 */
export function getHostedApiKey(provider) {
  // First check if user is on PRO plan
  const stored = readStoredLicense();
  if (!stored?.licenseKey || stored.plan !== 'pro') {
    return null;
  }

  // Check cached hosted keys
  const cachedKeys = readCachedHostedKeys();
  if (!cachedKeys?.hostedKeys) return null;
  
  const providerLower = provider.toLowerCase();
  return cachedKeys.hostedKeys[providerLower] || null;
}

/**
 * Check if hosted API keys are available (PRO/Enterprise plan check)
 * @returns {boolean} True if user is on PRO or Enterprise plan and can use hosted keys
 */
export function canUseHostedApiKeys() {
  const stored = readStoredLicense();
  return (stored?.plan === 'pro' || stored?.plan === 'enterprise') && stored?.status === 'active';
}

/**
 * Track hosted key usage (for rate limiting and analytics)
 * Called after using a hosted API key for an AI operation
 * @param {string} provider - Provider name (anthropic, openai, etc.)
 * @param {string} operation - Operation type (e.g., 'parse-prd', 'expand')
 * @param {Object} usage - Token usage { inputTokens, outputTokens }
 * @returns {Promise<Object>} Tracking result with rate limit info
 */
export async function trackHostedKeyUsage(provider, operation, usage = {}) {
  const stored = readStoredLicense();
  
  if (!stored?.licenseKey || (stored.plan !== 'pro' && stored.plan !== 'enterprise')) {
    return { success: false, error: 'Not a PRO or Enterprise user' };
  }

  try {
    const response = await fetch(TRACK_HOSTED_USAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: stored.licenseKey,
        provider,
        operation,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        rateLimit: result.rateLimit,
      };
    }
    
    // Handle rate limit exceeded
    if (response.status === 429) {
      return {
        success: false,
        rateLimited: true,
        error: result.error,
        resetAt: result.resetAt,
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to track usage',
    };
  } catch (error) {
    // Don't block operations if tracking fails
    console.warn(`Warning: Failed to track hosted key usage: ${error.message}`);
    return {
      success: false,
      error: 'Network error tracking usage',
      offline: true,
    };
  }
}

/**
 * Check if using a hosted key (for display purposes)
 * @param {string} provider - Provider to check
 * @returns {boolean} True if using hosted key for this provider
 */
export function isUsingHostedKey(provider) {
  if (!canUseHostedApiKeys()) return false;
  
  // Check if user has their own key (env or synced)
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (envKey) return false;
  
  const syncedKey = getSyncedApiKey(provider);
  if (syncedKey) return false;
  
  // Check if we have a hosted key
  const hostedKey = getHostedApiKey(provider);
  return !!hostedKey;
}

// ============================================
// USAGE TRACKING
// ============================================

/**
 * Increment usage counter after AI operation
 * @param {string} operation - Operation type (e.g., 'parse-prd', 'expand', 'add-task')
 * @param {number} count - Number of tasks to increment (default: 1)
 * @returns {Promise<Object>} Usage result with remaining tasks
 */
export async function incrementUsage(operation, count = 1) {
  const stored = readStoredLicense();
  
  if (!stored?.licenseKey) {
    return {
      success: false,
      error: 'No license key found',
    };
  }

  try {
    const response = await fetch(USAGE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        licenseKey: stored.licenseKey,
        operation,
        count
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        usage: result.usage,
      };
    }
    
    return {
      success: false,
      error: result.error || 'Failed to track usage',
    };
  } catch (error) {
    // Don't block the operation if usage tracking fails
    console.warn(`Warning: Usage tracking failed: ${error.message}`);
    return {
      success: false,
      error: 'Network error tracking usage',
      offline: true,
    };
  }
}

/**
 * Get usage summary for display
 * @param {Object} usageResult - Result from incrementUsage
 * @returns {string|null} Formatted usage string or null
 */
export function formatUsageSummary(usageResult) {
  if (!usageResult?.success || !usageResult?.usage) return null;
  
  const { tasksUsed, tasksPerMonth, remaining, isOverage, overageCount, overageRate } = usageResult.usage;
  
  if (tasksPerMonth <= 0) {
    return `Tasks used: ${tasksUsed}`;
  }
  
  if (isOverage) {
    const overageCost = (overageCount * overageRate).toFixed(2);
    return `Tasks: ${tasksUsed}/${tasksPerMonth} (${overageCount} overage @ $${overageRate}/task = $${overageCost})`;
  }
  
  const percentUsed = Math.round((tasksUsed / tasksPerMonth) * 100);
  return `Tasks: ${tasksUsed}/${tasksPerMonth} (${remaining} remaining, ${percentUsed}% used)`;
}

export default {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  formatLicenseStatus,
  readStoredLicense,
  getLicenseFilePath,
  // Config sync exports
  syncUserConfig,
  readCachedConfig,
  getSyncedApiKey,
  getSyncedModels,
  clearConfigCache,
  getConfigCachePath,
  // Usage tracking exports
  incrementUsage,
  formatUsageSummary,
  // Task sync exports
  syncTasksToCloud,
  getTasksFromCloud,
  // Hosted API keys exports (PRO/Enterprise plan only)
  syncHostedApiKeys,
  getHostedApiKey,
  canUseHostedApiKeys,
  clearHostedKeysCache,
  getHostedKeysCachePath,
  trackHostedKeyUsage,
  isUsingHostedKey,
};

// ============================================
// TASK CLOUD SYNC
// Sync tasks between CLI and web dashboard
// ============================================

const TASK_SYNC_API_URL = process.env.TASKMASTER_TASK_SYNC_URL || 
  `${FUNCTIONS_BASE_URL}/syncTasks`;
const GET_TASKS_API_URL = process.env.TASKMASTER_GET_TASKS_URL || 
  `${FUNCTIONS_BASE_URL}/getTasks`;
const HOSTED_KEYS_API_URL = process.env.TASKMASTER_HOSTED_KEYS_URL || 
  `${FUNCTIONS_BASE_URL}/getHostedApiKeys`;
const TRACK_HOSTED_USAGE_URL = process.env.TASKMASTER_TRACK_HOSTED_USAGE_URL || 
  `${FUNCTIONS_BASE_URL}/trackHostedKeyUsage`;

// Hosted keys cache duration: 1 hour (in milliseconds)
const HOSTED_KEYS_CACHE_DURATION_MS = 60 * 60 * 1000;

/**
 * Sync tasks to cloud for web dashboard viewing
 * @param {Array} tasks - Array of tasks to sync
 * @param {Object} options - Sync options
 * @returns {Object} Sync result
 */
export async function syncTasksToCloud(tasks, options = {}) {
  try {
    const license = readStoredLicense();
    if (!license?.licenseKey) {
      return { success: false, error: 'No license key found' };
    }

    const projectId = options.projectId || 'default';
    const tag = options.tag || 'master';
    const metadata = options.metadata || {};

    const response = await fetch(TASK_SYNC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: license.licenseKey,
        projectId,
        tag,
        tasks,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: error.error || 'Sync failed' };
    }

    const result = await response.json();
    return {
      success: true,
      stats: result.stats,
      syncedAt: result.syncedAt,
    };
  } catch (error) {
    // Silently fail - don't block CLI operations
    return { success: false, error: error.message };
  }
}

/**
 * Get tasks from cloud
 * @param {Object} options - Get options
 * @returns {Object} Tasks result
 */
export async function getTasksFromCloud(options = {}) {
  try {
    const license = readStoredLicense();
    if (!license?.licenseKey) {
      return { success: false, error: 'No license key found' };
    }

    const projectId = options.projectId || 'default';
    const tag = options.tag || 'master';

    const response = await fetch(GET_TASKS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: license.licenseKey,
        projectId,
        tag,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: error.error || 'Failed to get tasks' };
    }

    const result = await response.json();
    return {
      success: true,
      tasks: result.tasks,
      metadata: result.metadata,
      syncedAt: result.syncedAt,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
