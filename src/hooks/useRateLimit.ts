// Rate Limiting React Hook
// ===========================================
// Provides easy-to-use rate limiting for React components

import { useState, useCallback, useEffect } from 'react';
import { 
  checkRateLimit, 
  recordUsage, 
  getCurrentUsage,
  getUserUsageStats,
  getRateLimitMessage,
  withRateLimit,
  type RateLimitType 
} from '../lib/rate-limiter';
import { UserTier } from '../lib/current-paying-user';

interface UseRateLimitOptions {
  userId: string;
  userTier: UserTier;
  type: RateLimitType;
  onLimitExceeded?: (message: string, retryAfter?: number) => void;
}

interface UseRateLimitResult {
  isAllowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  canPerformAction: () => boolean;
  performActionWithLimit: <T>(action: () => Promise<T>) => Promise<T>;
  getMessage: () => string;
  resetTime: number;
}

/**
 * Hook for rate limiting in React components
 */
export function useRateLimit(options: UseRateLimitOptions): UseRateLimitResult {
  const { userId, userTier, type, onLimitExceeded } = options;
  
  const [lastCheck, setLastCheck] = useState(0);
  
  // Force re-render to update rate limit status
  const forceUpdate = useCallback(() => {
    setLastCheck(Date.now());
  }, []);
  
  // Update every minute to refresh limits
  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, [forceUpdate]);
  
  const getCurrentLimitStatus = useCallback(() => {
    const limitCheck = checkRateLimit(userId, userTier, type);
    const usage = getCurrentUsage(userId, userTier, type);
    
    return {
      ...limitCheck,
      ...usage
    };
  }, [userId, userTier, type, lastCheck]);
  
  const status = getCurrentLimitStatus();
  
  const canPerformAction = useCallback(() => {
    const check = checkRateLimit(userId, userTier, type);
    return check.allowed;
  }, [userId, userTier, type]);
  
  const performActionWithLimit = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    try {
      const result = await withRateLimit(userId, userTier, type, action);
      forceUpdate(); // Update the UI after successful action
      return result;
    } catch (error: any) {
      if (error.code === 'RATE_LIMIT_EXCEEDED') {
        const message = getRateLimitMessage(type, userTier, error.retryAfter);
        if (onLimitExceeded) {
          onLimitExceeded(message, error.retryAfter);
        }
      }
      throw error;
    }
  }, [userId, userTier, type, onLimitExceeded, forceUpdate]);
  
  const getMessage = useCallback(() => {
    if (status.allowed) {
      return `${status.remaining} ${type} actions remaining`;
    }
    return getRateLimitMessage(type, userTier, status.retryAfter);
  }, [status, type, userTier]);
  
  return {
    isAllowed: status.allowed,
    remaining: status.remaining,
    limit: status.limit,
    used: status.used,
    resetTime: status.resetTime,
    canPerformAction,
    performActionWithLimit,
    getMessage
  };
}

/**
 * Hook for getting usage stats (simplified for internal use)
 */
export function useUserUsageStats(userId: string, userTier: UserTier) {
  return getUserUsageStats(userId, userTier);
}

/**
 * Simple hook to check if an action is allowed
 */
export function useCanPerformAction(
  userId: string, 
  userTier: UserTier, 
  type: RateLimitType
): boolean {
  const [canPerform, setCanPerform] = useState(true);
  
  useEffect(() => {
    const check = checkRateLimit(userId, userTier, type);
    setCanPerform(check.allowed);
    
    // Recheck when the window resets
    if (!check.allowed && check.retryAfter) {
      const timeout = setTimeout(() => {
        const newCheck = checkRateLimit(userId, userTier, type);
        setCanPerform(newCheck.allowed);
      }, check.retryAfter * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [userId, userTier, type]);
  
  return canPerform;
}
