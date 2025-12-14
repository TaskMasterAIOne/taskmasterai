/**
 * Usage Tracking for TaskMaster AI
 * Tracks AI operations against plan limits
 * Syncs with server for accurate billing
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { readStoredLicense, incrementUsage as serverIncrementUsage } from './license.js';

// Plan limits (tasks per month) - matching backend PLAN_DETAILS
// These should match the values in backend/functions/index.js PLAN_DETAILS
const PLAN_LIMITS = {
  plus: 100,      // $29/month - 100 tasks included
  pro: 1000,      // $199/month - 1000 tasks included
  enterprise: 5000, // $599+/month - 5000+ tasks included
};

/**
 * Get the usage file path
 */
function getUsageFilePath() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  return path.join(taskmasterDir, 'usage.json');
}

/**
 * Ensure the usage directory exists
 */
function ensureUsageDir() {
  const taskmasterDir = path.join(os.homedir(), '.taskmaster-ai');
  if (!fs.existsSync(taskmasterDir)) {
    fs.mkdirSync(taskmasterDir, { recursive: true });
  }
}

/**
 * Get the current month key (YYYY-MM format)
 */
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Read usage data
 */
export function readUsageData() {
  const usagePath = getUsageFilePath();
  
  try {
    if (fs.existsSync(usagePath)) {
      const data = fs.readFileSync(usagePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn(`Warning: Error reading usage file: ${error.message}`);
  }
  
  return { months: {} };
}

/**
 * Write usage data
 */
function writeUsageData(data) {
  ensureUsageDir();
  const usagePath = getUsageFilePath();
  
  try {
    fs.writeFileSync(usagePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`Warning: Error writing usage file: ${error.message}`);
  }
}

/**
 * Get current month's usage
 */
export function getCurrentUsage() {
  const data = readUsageData();
  const monthKey = getCurrentMonthKey();
  
  if (!data.months[monthKey]) {
    data.months[monthKey] = {
      aiOperations: 0,
      tasksParsed: 0,
      tasksExpanded: 0,
      tasksAdded: 0,
      complexityAnalyses: 0,
      lastUpdated: null,
    };
  }
  
  return data.months[monthKey];
}

/**
 * Increment usage counter (local + server sync)
 * IMPORTANT: Server sync is required for accurate billing
 */
export async function incrementUsage(operationType = 'aiOperations', count = 1) {
  const data = readUsageData();
  const monthKey = getCurrentMonthKey();
  
  if (!data.months[monthKey]) {
    data.months[monthKey] = {
      aiOperations: 0,
      tasksParsed: 0,
      tasksExpanded: 0,
      tasksAdded: 0,
      complexityAnalyses: 0,
      lastUpdated: null,
      failedSyncs: 0,
      pendingSync: 0,
    };
  }
  
  // SECURITY: Validate count is positive
  const validatedCount = Math.max(1, Math.floor(Number(count) || 1));
  
  // Update local counter
  data.months[monthKey][operationType] = (data.months[monthKey][operationType] || 0) + validatedCount;
  data.months[monthKey].aiOperations = (data.months[monthKey].aiOperations || 0) + validatedCount;
  data.months[monthKey].lastUpdated = new Date().toISOString();
  
  // Track pending sync count (for retry later)
  data.months[monthKey].pendingSync = (data.months[monthKey].pendingSync || 0) + validatedCount;
  
  writeUsageData(data);
  
  // Sync with server - REQUIRED for accurate billing
  let serverSyncSuccess = false;
  let retryCount = 0;
  const maxRetries = 3;
  
  while (!serverSyncSuccess && retryCount < maxRetries) {
    try {
      const serverResult = await serverIncrementUsage(operationType, validatedCount);
      if (serverResult.success && serverResult.usage) {
        // Store server-reported usage for reference
        data.months[monthKey].serverTasksUsed = serverResult.usage.tasksUsed;
        data.months[monthKey].serverRemaining = serverResult.usage.remaining;
        data.months[monthKey].isOverage = serverResult.usage.isOverage;
        data.months[monthKey].failedSyncs = 0; // Reset failed counter on success
        data.months[monthKey].pendingSync = Math.max(0, (data.months[monthKey].pendingSync || 0) - validatedCount);
        data.months[monthKey].lastServerSync = new Date().toISOString();
        serverSyncSuccess = true;
        writeUsageData(data);
        return {
          ...data.months[monthKey],
          serverUsage: serverResult.usage,
        };
      }
      break; // Non-success response, don't retry
    } catch (error) {
      retryCount++;
      if (retryCount < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }
  
  // Server sync failed after retries
  if (!serverSyncSuccess) {
    data.months[monthKey].failedSyncs = (data.months[monthKey].failedSyncs || 0) + 1;
    data.months[monthKey].lastFailedSync = new Date().toISOString();
    writeUsageData(data);
    
    // IMPORTANT: Log warning about sync failure
    console.warn(`⚠️  Usage sync failed (attempt ${retryCount}). Usage will be synced on next successful operation.`);
    console.warn(`   Pending unsynced operations: ${data.months[monthKey].pendingSync}`);
  }
  
  return data.months[monthKey];
}

/**
 * Get the user's plan limit
 * Returns -1 for unlimited, 0 for no license, or the actual limit
 */
export function getPlanLimit() {
  const license = readStoredLicense();
  
  if (!license || !license.plan) {
    return 0; // No license = no limit
  }
  
  // Use the tasksPerMonth from the license if available
  if (license.tasksPerMonth !== undefined && license.tasksPerMonth !== null) {
    // -1 means unlimited
    return license.tasksPerMonth;
  }
  
  // Fall back to default plan limits
  const planName = license.plan.toLowerCase();
  return PLAN_LIMITS[planName] !== undefined ? PLAN_LIMITS[planName] : 0;
}

/**
 * Check if the user can perform an AI operation
 * Returns { allowed: boolean, remaining: number, limit: number, used: number }
 */
export function checkUsageLimit(operationCount = 1) {
  const license = readStoredLicense();
  
  if (!license) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      reason: 'No license activated',
    };
  }
  
  const limit = getPlanLimit();
  const usage = getCurrentUsage();
  const used = usage.aiOperations || 0;
  
  // No limit check for no license
  if (limit === 0) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used,
      reason: 'No active license',
    };
  }
  
  const remaining = Math.max(0, limit - used);
  const allowed = remaining >= operationCount;
  
  return {
    allowed,
    remaining,
    limit,
    used,
    plan: license.plan,
    reason: allowed ? null : `Monthly limit of ${limit} AI operations reached. Upgrade your plan at https://www.taskmaster.one/pricing`,
  };
}

/**
 * Enforce usage limit - throws error if limit exceeded
 */
export function enforceUsageLimit(operationCount = 1) {
  const check = checkUsageLimit(operationCount);
  
  if (!check.allowed) {
    throw new Error(check.reason || 'Usage limit exceeded');
  }
  
  // SECURITY: Check for too many failed syncs (potential abuse)
  const usage = getCurrentUsage();
  const failedSyncs = usage.failedSyncs || 0;
  const pendingSync = usage.pendingSync || 0;
  
  // If more than 10 operations haven't synced, require sync before continuing
  if (pendingSync > 10) {
    console.warn(`⚠️  ${pendingSync} operations pending sync. Attempting to reconcile...`);
    // Allow operation but flag for attention
  }
  
  // If more than 20 consecutive failures, block until resolved
  if (failedSyncs > 20) {
    throw new Error(
      `Usage tracking offline. Please check your network connection and try again.\n` +
      `If this persists, run: taskmaster sync --usage`
    );
  }
  
  return check;
}

/**
 * Sync any pending usage to server
 * Call this periodically or on sync command
 * @param {boolean} forceReconcile - If true, reconcile local vs server difference
 */
export async function syncPendingUsage(forceReconcile = false) {
  const data = readUsageData();
  const monthKey = getCurrentMonthKey();
  const monthData = data.months[monthKey];
  
  if (!monthData) {
    return { success: true, message: 'No usage data found' };
  }
  
  let pendingCount = monthData.pendingSync || 0;
  
  // If force reconcile, calculate difference between local and server
  if (forceReconcile) {
    const localTotal = monthData.aiOperations || 0;
    const serverTotal = monthData.serverTasksUsed || 0;
    const difference = localTotal - serverTotal;
    
    if (difference > 0) {
      console.log(`Reconciling: Local=${localTotal}, Server=${serverTotal}, Difference=${difference}`);
      pendingCount = difference;
    }
  }
  
  if (pendingCount <= 0) {
    return { success: true, message: 'No pending usage to sync' };
  }
  
  try {
    const serverResult = await serverIncrementUsage('pendingReconciliation', pendingCount);
    
    if (serverResult.success) {
      data.months[monthKey].pendingSync = 0;
      data.months[monthKey].failedSyncs = 0;
      data.months[monthKey].lastServerSync = new Date().toISOString();
      data.months[monthKey].serverTasksUsed = serverResult.usage?.tasksUsed;
      writeUsageData(data);
      
      return {
        success: true,
        message: `Synced ${pendingCount} pending operations`,
        usage: serverResult.usage
      };
    }
    
    return {
      success: false,
      error: serverResult.error || 'Sync failed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get usage summary for display
 */
export function getUsageSummary() {
  const license = readStoredLicense();
  const usage = getCurrentUsage();
  const limit = getPlanLimit();
  const used = usage.aiOperations || 0;
  
  return {
    plan: license?.planName || license?.plan || 'None',
    used,
    limit: limit > 0 ? limit : 0,
    remaining: limit > 0 ? Math.max(0, limit - used) : 0,
    percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
    breakdown: {
      tasksParsed: usage.tasksParsed || 0,
      tasksExpanded: usage.tasksExpanded || 0,
      tasksAdded: usage.tasksAdded || 0,
      complexityAnalyses: usage.complexityAnalyses || 0,
    },
  };
}

export default {
  getCurrentUsage,
  incrementUsage,
  getPlanLimit,
  checkUsageLimit,
  enforceUsageLimit,
  getUsageSummary,
  syncPendingUsage,
};
