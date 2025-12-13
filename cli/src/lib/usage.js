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
const PLAN_LIMITS = {
  plus: 500,
  pro: 2000,
  enterprise: -1, // -1 means unlimited
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
    };
  }
  
  // Update local counter
  data.months[monthKey][operationType] = (data.months[monthKey][operationType] || 0) + count;
  data.months[monthKey].aiOperations = (data.months[monthKey].aiOperations || 0) + count;
  data.months[monthKey].lastUpdated = new Date().toISOString();
  
  writeUsageData(data);
  
  // Sync with server (non-blocking)
  try {
    const serverResult = await serverIncrementUsage(operationType, count);
    if (serverResult.success && serverResult.usage) {
      // Store server-reported usage for reference
      data.months[monthKey].serverTasksUsed = serverResult.usage.tasksUsed;
      data.months[monthKey].serverRemaining = serverResult.usage.remaining;
      data.months[monthKey].isOverage = serverResult.usage.isOverage;
      writeUsageData(data);
      return {
        ...data.months[monthKey],
        serverUsage: serverResult.usage,
      };
    }
  } catch (error) {
    // Server sync failed, but local tracking succeeded
    console.warn(`Note: Server usage sync failed (${error.message}). Local tracking continues.`);
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
  
  // -1 means unlimited (Enterprise)
  if (limit === -1) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: -1,
      used,
      plan: license.plan,
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
    reason: allowed ? null : `Monthly limit of ${limit} AI operations reached. Upgrade your plan at https://taskmaster.one/pricing`,
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
  
  return check;
}

/**
 * Get usage summary for display
 */
export function getUsageSummary() {
  const license = readStoredLicense();
  const usage = getCurrentUsage();
  const limit = getPlanLimit();
  const used = usage.aiOperations || 0;
  
  // -1 means unlimited (Enterprise)
  const isUnlimited = limit === -1;
  
  return {
    plan: license?.planName || license?.plan || 'None',
    used,
    limit: isUnlimited ? 'Unlimited' : limit,
    remaining: isUnlimited ? 'Unlimited' : Math.max(0, limit - used),
    percentage: isUnlimited ? 0 : (limit > 0 ? Math.round((used / limit) * 100) : 0),
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
};
