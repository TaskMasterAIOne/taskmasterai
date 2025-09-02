// Rate Limiting Utility
// ===========================================
// Protects against API abuse and manages user consumption
// across different tiers with intelligent rate limiting

import { RATE_LIMITS, USER_TIERS } from '../config/constants';
import { UserTier } from './current-paying-user';

// Types for rate limiting
export type RateLimitType = keyof typeof RATE_LIMITS;
export type RateLimitWindow = 'minute' | 'hour' | 'day';

interface RateLimitEntry {
  count: number;
  windowStart: number;
  lastReset: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// In-memory store (you might want to use Redis or Firebase for production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit windows in milliseconds
const WINDOWS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,  
  day: 24 * 60 * 60 * 1000
} as const;

// Map rate limit types to their time windows
const RATE_LIMIT_WINDOWS: Record<RateLimitType, RateLimitWindow> = {
  api: 'minute',
  chat: 'minute', 
  notes: 'hour',
  uploads: 'hour',
  imageGen: 'day'
} as const;

/**
 * Generates a unique key for rate limiting
 */
function getRateLimitKey(userId: string, type: RateLimitType): string {
  const window = RATE_LIMIT_WINDOWS[type];
  const now = Date.now();
  const windowMs = WINDOWS[window];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  
  return `${userId}:${type}:${windowStart}`;
}

/**
 * Checks if a user can perform an action within rate limits
 */
export function checkRateLimit(
  userId: string, 
  userTier: UserTier, 
  type: RateLimitType
): RateLimitResult {
  const limit = RATE_LIMITS[type][userTier];
  const window = RATE_LIMIT_WINDOWS[type];
  const windowMs = WINDOWS[window];
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = getRateLimitKey(userId, type);
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry || entry.windowStart !== windowStart) {
    entry = {
      count: 0,
      windowStart,
      lastReset: now
    };
    rateLimitStore.set(key, entry);
  }
  
  const remaining = Math.max(0, limit - entry.count);
  const resetTime = windowStart + windowMs;
  const allowed = entry.count < limit;
  
  return {
    allowed,
    limit,
    remaining,
    resetTime,
    retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
  };
}

/**
 * Records usage of an action (increments counter)
 */
export function recordUsage(userId: string, type: RateLimitType): void {
  const key = getRateLimitKey(userId, type);
  const entry = rateLimitStore.get(key);
  
  if (entry) {
    entry.count += 1;
    rateLimitStore.set(key, entry);
  }
}

/**
 * Gets current usage for a user and action type
 */
export function getCurrentUsage(
  userId: string, 
  userTier: UserTier, 
  type: RateLimitType
): { used: number; limit: number; remaining: number } {
  const limit = RATE_LIMITS[type][userTier];
  const key = getRateLimitKey(userId, type);
  const entry = rateLimitStore.get(key);
  
  const used = entry?.count || 0;
  const remaining = Math.max(0, limit - used);
  
  return { used, limit, remaining };
}

/**
 * Middleware-style rate limiter for API calls
 */
export async function withRateLimit<T>(
  userId: string,
  userTier: UserTier,
  type: RateLimitType,
  action: () => Promise<T>
): Promise<T> {
  const rateLimitCheck = checkRateLimit(userId, userTier, type);
  
  if (!rateLimitCheck.allowed) {
    const error = new Error(
      `Rate limit exceeded. Try again in ${rateLimitCheck.retryAfter} seconds.`
    ) as any;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.retryAfter = rateLimitCheck.retryAfter;
    error.limit = rateLimitCheck.limit;
    error.resetTime = rateLimitCheck.resetTime;
    throw error;
  }
  
  // Record the usage
  recordUsage(userId, type);
  
  try {
    return await action();
  } catch (error) {
    // If the action fails, we might want to refund the usage
    // For now, we'll keep it simple and not refund
    throw error;
  }
}

/**
 * Get user-friendly rate limit message
 */
export function getRateLimitMessage(
  type: RateLimitType, 
  userTier: UserTier,
  retryAfter?: number
): string {
  const limit = RATE_LIMITS[type][userTier];
  const window = RATE_LIMIT_WINDOWS[type];
  
  const windowText = window === 'minute' ? 'minute' : 
                    window === 'hour' ? 'hour' : 'day';
  
  const baseMessage = `You've reached your ${type} limit of ${limit} per ${windowText}.`;
  
  if (retryAfter) {
    const timeText = retryAfter > 60 ? 
      `${Math.ceil(retryAfter / 60)} minutes` : 
      `${retryAfter} seconds`;
    return `${baseMessage} Try again in ${timeText}.`;
  }
  
  if (userTier === 'basic') {
    return `${baseMessage} Upgrade to Pro or Premium for higher limits!`;
  }
  
  return baseMessage;
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const cutoff = now - WINDOWS.day; // Keep data for max 1 day
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastReset < cutoff) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup old entries every hour
setInterval(cleanupRateLimits, WINDOWS.hour);

/**
 * Reset rate limits for a user (admin function)
 */
export function resetUserRateLimits(userId: string): void {
  for (const key of rateLimitStore.keys()) {
    if (key.startsWith(`${userId}:`)) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get all current usage for a user across all types
 */
export function getUserUsageStats(userId: string, userTier: UserTier) {
  const stats: Record<RateLimitType, ReturnType<typeof getCurrentUsage>> = {} as any;
  
  for (const type of Object.keys(RATE_LIMITS) as RateLimitType[]) {
    stats[type] = getCurrentUsage(userId, userTier, type);
  }
  
  return stats;
}
