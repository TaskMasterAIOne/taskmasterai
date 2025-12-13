/**
 * License Manager for TaskMaster AI
 * Handles license key validation, storage, and caching
 * Connects to Firebase backend for validation
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// License validation endpoint - Your Firebase Functions URL
const LICENSE_API_URL = process.env.TASKMASTER_LICENSE_API_URL || 
  'https://validatelicense-t5fyd2wiia-uc.a.run.app';

// Cache duration: 24 hours (in milliseconds)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

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

  return {
    success: true,
    plan: validation.plan,
    planName: validation.planName,
    tasksPerMonth: validation.tasksPerMonth,
    expiresAt: validation.expiresAt,
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

export default {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  formatLicenseStatus,
  readStoredLicense,
  getLicenseFilePath,
};
