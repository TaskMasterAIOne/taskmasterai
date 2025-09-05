// src/lib/current-paying-user.ts

import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";

// Import constants from central config
import { 
    PREMIUM_EMAILS, 
    PRO_EMAILS, 
    CHAT_LIMITS, 
    NOTE_LIMITS,
    RATE_LIMITS,
    INTERN_EMAILS 
} from '../config/constants';

// Re-export for backwards compatibility
export { PREMIUM_EMAILS, PRO_EMAILS, INTERN_EMAILS, NOTE_LIMITS, RATE_LIMITS };

export type UserTier = keyof typeof CHAT_LIMITS;

// Legacy constants for backwards compatibility
export const BASIC_CHAT_LIMIT = CHAT_LIMITS.basic;
export const PRO_CHAT_LIMIT = CHAT_LIMITS.pro;
export const BRIEF_REFRESH_LIMIT_PRO = 20;
export const POINTS_FOR_FREE_PREMIUM = 200;

export interface ChatUsageData {
    count: number;
    month: string;
    lastUpdated?: Timestamp;
}
export interface NoteUsageData {
    pdfAi: number;
    youtube: number;
    month: string;
}

export interface UserProfileData {
  uid: string;
  email: string | null;
  displayName: string | null;
  name: string | null;
  photoURL: string | null;
  firstName?: string;
  lastName?: string;
  points: number;
  level: number;
  overallStreakCount: number;
  lastOverallStreakUpdate: Timestamp | Date | null;

  badges: string[];
  createdAt: Timestamp | Date;
  lastLoginAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  premiumAwardedUntil?: Timestamp | Date | null;
  activeTier: UserTier;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'incomplete' | null;
  stripeCustomerId?: string | null;
  noteUsageByMonth: { [monthYear: string]: { pdfAi: number; youtube: number; lastUpdated: Timestamp } };
  notesCreatedCount: number;
  pdfNotesCreatedCount: number;
  youtubeNotesCreatedCount: number;
  aiNotesCreatedCount: number;
  noteFlashcardsCreatedCount: number;
  noteChatsStartedCount: number;
  notionAccessData?: any;
  tokens: number;
  uploadBonusCount: number;
  abuseWarningCount: number;
  studentDiscountGranted?: boolean;
  studentDiscountEmail?: string;
  studentDiscountGrantedAt?: Timestamp | Date | null;
  studentDiscountExpiresAt?: Timestamp | Date | null;
}

// Helper to get current month in local timezone (YYYY-MM format)
export const getCurrentMonthLocal = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const toDateSafe = (timestampField: any): Date | null => {
    if (!timestampField) return null;
    if (timestampField instanceof Timestamp) return timestampField.toDate();
    if (timestampField instanceof Date) return timestampField;
    if (typeof timestampField === 'string' || typeof timestampField === 'number') {
        const d = new Date(timestampField);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof timestampField === 'object' && timestampField !== null &&
        typeof (timestampField as any).seconds === 'number' && typeof (timestampField as any).nanoseconds === 'number') {
        try {
            return new Timestamp((timestampField as any).seconds, (timestampField as any).nanoseconds).toDate();
        } catch (e) { console.warn("toDateSafe: Error converting plain object to Date", e); return null; }
    }
    return null;
};

export const prepareInitialProfileData = (userId: string, email?: string | null, displayName?: string | null, photoURL?: string | null, firstName?: string | null, lastName?: string | null): Omit<UserProfileData, 'updatedAt' | 'lastLoginAt' | 'createdAt'> => {
    const lowercasedEmail = email?.toLowerCase();
    const initialTier: UserTier = (lowercasedEmail && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) ? 'premium' :
                                (lowercasedEmail && PRO_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) ? 'pro' : 'basic';
    return {
        uid: userId,
        email: email ?? null,
        displayName: displayName ?? null,
        name: displayName ?? null,
        photoURL: photoURL ?? null,
        firstName: firstName?.trim() ?? '',
        lastName: lastName?.trim() ?? '',
        points: 0,
        level: 0,
        overallStreakCount: 0,
        lastOverallStreakUpdate: null,

        badges: [],
        premiumAwardedUntil: null,
        activeTier: initialTier,
        subscriptionStatus: null,
        noteUsageByMonth: {},
        notesCreatedCount: 0,
        pdfNotesCreatedCount: 0,
        youtubeNotesCreatedCount: 0,
        aiNotesCreatedCount: 0,
        noteFlashcardsCreatedCount: 0,
        noteChatsStartedCount: 0,
        tokens: 500,
        uploadBonusCount: 0,
        abuseWarningCount: 0,
    };
};

export const getUserTier = async (userId: string | null | undefined, emailFromAuth?: string | null): Promise<UserTier> => {
    if (!userId) return 'loading';
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userProfile = docSnap.data() as UserProfileData;
            
            // Check for active student discount first
            if (userProfile.studentDiscountGranted && userProfile.studentDiscountExpiresAt) {
                const studentExpiresDate = toDateSafe(userProfile.studentDiscountExpiresAt);
                if (studentExpiresDate && studentExpiresDate > new Date()) {
                    console.log('User has active student discount - returning pro tier');
                    return 'pro';
                }
            }
            
            if (userProfile.premiumAwardedUntil) {
                const awardedUntilDate = toDateSafe(userProfile.premiumAwardedUntil);
                if (awardedUntilDate && awardedUntilDate > new Date()) {
                    return 'premium';
                }
            }
            if (userProfile.subscriptionStatus === 'active' && (userProfile.activeTier === 'pro' || userProfile.activeTier === 'premium')) {
                return userProfile.activeTier;
            }
            const currentEmail = (userProfile.email || emailFromAuth)?.toLowerCase();
            if (currentEmail) {
                if (PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'premium';
                if (PRO_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'pro';
            }
            return userProfile.activeTier || 'basic';
        } else {
             const lowercasedEmail = emailFromAuth?.toLowerCase();
             if (lowercasedEmail && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) return 'premium';
             if (lowercasedEmail && PRO_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) return 'pro';
             return 'basic';
        }
    } catch (error) {
        console.error(`Error fetching user for tier check ${userId}:`, error);
        const lowercasedEmail = emailFromAuth?.toLowerCase();
        if (lowercasedEmail && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) return 'premium';
        if (lowercasedEmail && PRO_EMAILS.map(e => e.toLowerCase()).includes(lowercasedEmail)) return 'pro';
        return 'basic';
    }
};

export const getChatLimitForTier = (tier: UserTier): number => {
    return CHAT_LIMITS[tier] || CHAT_LIMITS.basic;
};

export const getNoteLimitsForTier = (tier: UserTier): { pdfAi: number; youtube: number } => {
    // Filter out loading tier as it doesn't have limits
    if (tier === 'loading') {
        return { pdfAi: 0, youtube: 0 };
    }
    
    return NOTE_LIMITS.pdfAi[tier] ? { 
        pdfAi: NOTE_LIMITS.pdfAi[tier], 
        youtube: NOTE_LIMITS.youtube[tier] 
    } : { 
        pdfAi: NOTE_LIMITS.pdfAi.basic, 
        youtube: NOTE_LIMITS.youtube.basic 
    };
};

export const getCurrentMonthUserChatUsage = async (userId: string, currentMonth: string): Promise<ChatUsageData | null> => {
  if (!userId || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
    return null;
  }
  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`);
    const docSnap = await getDoc(usageRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as ChatUsageData;
      if (data?.month === currentMonth && typeof data.count === 'number') {
        return { count: data.count, month: data.month, lastUpdated: data.lastUpdated };
      } else if (data?.month !== currentMonth) {
        await setDoc(usageRef, { count: 0, month: currentMonth, lastUpdated: serverTimestamp() });
        return { count: 0, month: currentMonth, lastUpdated: Timestamp.now() };
      }
    } else {
        await setDoc(usageRef, { count: 0, month: currentMonth, lastUpdated: serverTimestamp() });
        return { count: 0, month: currentMonth, lastUpdated: Timestamp.now() };
    }
  } catch (error) {
    console.error(`Error getting/resetting chat usage for ${userId}:`, error);
  }
  return { count: 0, month: currentMonth, lastUpdated: Timestamp.now() };
};

export const incrementUserChatUsage = async (userId: string): Promise<void> => {
  if (!userId) {
      throw new Error("Invalid parameters for incrementing chat usage.");
  }
  const currentMonth = getCurrentMonthLocal();
  const usageRef = doc(db, `users/${userId}/usage/chat`);
  try {
    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(usageRef);
        if (docSnap.exists() && docSnap.data()?.month === currentMonth) {
            transaction.update(usageRef, {
                count: increment(1),
                lastUpdated: serverTimestamp()
            });
        } else {
            transaction.set(usageRef, {
                count: 1,
                month: currentMonth,
                lastUpdated: serverTimestamp()
            });
        }
    });
  } catch (error) {
      console.error(`Error incrementing/resetting chat usage for ${userId}:`, error);
      throw new Error(`Failed to update chat usage.`);
  }
};

export const getUserNoteUsage = async (userId: string): Promise<NoteUsageData | null> => {
    if (!userId) return null;
    const currentMonthYear = getCurrentMonthLocal();
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfileData;
            const monthlyUsage = userData?.noteUsageByMonth?.[currentMonthYear];
            if (monthlyUsage && typeof monthlyUsage.pdfAi === 'number' && typeof monthlyUsage.youtube === 'number') {
                return { pdfAi: monthlyUsage.pdfAi, youtube: monthlyUsage.youtube, month: currentMonthYear };
            }
            // Return safe defaults if monthlyUsage is undefined or missing properties
            return { 
                pdfAi: monthlyUsage?.pdfAi || 0, 
                youtube: monthlyUsage?.youtube || 0, 
                month: currentMonthYear 
            };
        }
        return { pdfAi: 0, youtube: 0, month: currentMonthYear };
    } catch (error) {
        console.error(`Error getting note usage for ${userId}:`, error);
        return { pdfAi: 0, youtube: 0, month: currentMonthYear };
    }
};

export const updateUserNoteUsage = async (userId: string, typeToIncrement: 'pdfAi' | 'youtube', currentMonth: string): Promise<void> => {
    if (!userId || !typeToIncrement || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
        throw new Error("Invalid params for updating note usage.");
    }
    const userRef = doc(db, 'users', userId);
    const updatePath = `noteUsageByMonth.${currentMonth}.${typeToIncrement}`;
    const lastUpdatedPath = `noteUsageByMonth.${currentMonth}.lastUpdated`;
    const now = serverTimestamp();
    
    // Add retry logic for race conditions
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            await runTransaction(db, async (transaction) => {
                const userSnap = await transaction.get(userRef);
                if (!userSnap.exists()) {
                     return;
                }
                const currentData = userSnap.data() as UserProfileData;
                const monthUsage = currentData.noteUsageByMonth?.[currentMonth];
                if (monthUsage) {
                    transaction.update(userRef, {
                        [updatePath]: increment(1),
                        [lastUpdatedPath]: now,
                        updatedAt: now
                    });
                } else {
                     transaction.update(userRef, {
                        [`noteUsageByMonth.${currentMonth}`]: {
                            pdfAi: typeToIncrement === 'pdfAi' ? 1 : 0,
                            youtube: typeToIncrement === 'youtube' ? 1 : 0,
                            lastUpdated: Timestamp.now()
                        },
                        updatedAt: now
                    });
                }
            });
            
            // Success - break out of retry loop
            break;
            
        } catch (error: any) {
            if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
                // Wait before retrying with exponential backoff + jitter
                const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }
            
            // If it's not a retryable error or we've exhausted retries, log and rethrow
            console.error(`Error updating note usage for ${userId} after retries:`, error);
            throw new Error(`Failed to update note usage.`);
        }
    }
};

export const onUserProfileSnapshot = (userId: string, callback: (profile: UserProfileData | null) => void): (() => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfileData;
      callback({
        ...data,
        uid: docSnap.id,
        level: data.level !== undefined ? data.level : calculateLevel(data.points || 0),
        lastOverallStreakUpdate: toDateSafe(data.lastOverallStreakUpdate),

        createdAt: toDateSafe(data.createdAt) || new Date(),
        updatedAt: toDateSafe(data.updatedAt) || new Date(),
        lastLoginAt: toDateSafe(data.lastLoginAt) || new Date(),
        premiumAwardedUntil: toDateSafe(data.premiumAwardedUntil),
      });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to user profile:", error);
    callback(null);
  });
};

const createProfileInTransaction = (
    transaction: any,
    profileRef: any,
    userId: string,
    userDetails: { email?: string | null; displayName?: string | null; photoURL?: string | null; } = {}
) => {
    const initialData = prepareInitialProfileData(
        userId,
        userDetails.email,
        userDetails.displayName,
        userDetails.photoURL
    );
    const now = serverTimestamp();
    const fullInitialData = {
        ...initialData,
        createdAt: now,
        lastLoginAt: now,
        updatedAt: now
    };
    transaction.set(profileRef, fullInitialData);
    return fullInitialData;
};

export const updateUserPointsAndLevel = async (
    userId: string,
    pointsToAdd: number,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<{ newPoints: number, newLevel: number, newTier?: UserTier }> => {
  const userRef = doc(db, 'users', userId);
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Read current data first
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user with initial points
        const initialData = {
          uid: userId,
          email: userDetailsForCreation?.email || null,
          displayName: userDetailsForCreation?.displayName || null,
          photoURL: userDetailsForCreation?.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          points: pointsToAdd,
          level: calculateLevel(pointsToAdd),
          badges: [],
          overallStreakCount: 0,
          notesCreatedCount: 0,
          pdfNotesCreatedCount: 0,
          youtubeNotesCreatedCount: 0,
          aiNotesCreatedCount: 0,
          noteFlashcardsCreatedCount: 0,
          noteChatsStartedCount: 0,
        };
        
        await setDoc(userRef, initialData, { merge: true });
        return { newPoints: pointsToAdd, newLevel: calculateLevel(pointsToAdd), newTier: undefined };
      } else {
        const currentProfileData = userSnap.data() as UserProfileData;
        const currentPoints = currentProfileData.points || 0;
        const newPoints = currentPoints + pointsToAdd;
        const newLevel = calculateLevel(newPoints);
        let newTierAwarded: UserTier | undefined = undefined;
        
        const updateData: any = {
          points: newPoints,
          level: newLevel,
          updatedAt: serverTimestamp(),
        };
        
        const currentTier = await getUserTier(userId, currentProfileData.email);
        if ((currentTier === 'basic' || currentTier === 'pro') &&
            (!currentProfileData.premiumAwardedUntil || toDateSafe(currentProfileData.premiumAwardedUntil)! < new Date()) &&
            newPoints >= POINTS_FOR_FREE_PREMIUM && currentPoints < POINTS_FOR_FREE_PREMIUM
        ) {
          const oneWeekFromNow = new Date();
          oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
          updateData.premiumAwardedUntil = Timestamp.fromDate(oneWeekFromNow);
          newTierAwarded = 'premium';
        }
        
        // Use setDoc with merge to avoid conflicts
        await setDoc(userRef, updateData, { merge: true });
        return { newPoints, newLevel, newTier: newTierAwarded };
      }
    } catch (error: any) {
      console.error(`Error updating user points/level (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff + jitter
        const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, return safe defaults
      console.error("Failed to update user points/level after retries:", error);
      return { newPoints: 0, newLevel: 1, newTier: undefined };
    }
  }
  
  // Return safe defaults
  return { newPoints: 0, newLevel: 1, newTier: undefined };
};

// Debounced streak updates to prevent conflicts
const streakUpdateTimers = new Map<string, NodeJS.Timeout>();

export const updateUserStreak = async (
    userId: string,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<{ newStreakCount: number, streakBroken: boolean }> => {
  // Clear any existing timer for this user
  const existingTimer = streakUpdateTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Debounce streak updates by 2 seconds to prevent conflicts
  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      try {
        streakUpdateTimers.delete(userId);
        const result = await performStreakUpdate(userId, userDetailsForCreation);
        resolve(result);
      } catch (error) {
        console.error('Error in debounced streak update:', error);
        resolve({ newStreakCount: 0, streakBroken: false });
      }
    }, 2000);
    
    streakUpdateTimers.set(userId, timer);
  });
};

// Non-transaction based streak update to prevent conflicts
const performStreakUpdate = async (
    userId: string,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<{ newStreakCount: number, streakBroken: boolean }> => {
  const userRef = doc(db, 'users', userId);
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // First, read the current data
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user with initial streak
        const initialData = {
          uid: userId,
          email: userDetailsForCreation?.email || null,
          displayName: userDetailsForCreation?.displayName || null,
          photoURL: userDetailsForCreation?.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          overallStreakCount: 1,
          lastOverallStreakUpdate: Timestamp.fromDate(new Date()),
          points: 0,
          level: 1,
          badges: [],
          notesCreatedCount: 0,
          pdfNotesCreatedCount: 0,
          youtubeNotesCreatedCount: 0,
          aiNotesCreatedCount: 0,
          noteFlashcardsCreatedCount: 0,
          noteChatsStartedCount: 0,
        };
        
        await setDoc(userRef, initialData, { merge: true });
        return { newStreakCount: 1, streakBroken: false };
      } else {
        const currentProfileData = userSnap.data() as UserProfileData;
        let currentStreak: number = currentProfileData.overallStreakCount || 0;
        let lastUpdateRaw: Timestamp | Date | null = currentProfileData.lastOverallStreakUpdate;
        const now = new Date();
        let streakBroken = false;
        const lastUpdate = lastUpdateRaw ? toDateSafe(lastUpdateRaw) : null;
        let shouldUpdate = false;
        
        if (lastUpdate) {
          const lastUpdateDate = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
          const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffTime = todayDate.getTime() - lastUpdateDate.getTime();
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak++;
            shouldUpdate = true;
          } else if (diffDays > 1) {
            currentStreak = 1;
            streakBroken = true;
            shouldUpdate = true;
          }
        } else {
          currentStreak = 1;
          shouldUpdate = true;
        }
        
        if (shouldUpdate) {
          const updateData = { 
            updatedAt: serverTimestamp(),
            overallStreakCount: currentStreak,
            lastOverallStreakUpdate: Timestamp.fromDate(now)
          };
          
          // Use setDoc with merge to avoid conflicts
          await setDoc(userRef, updateData, { merge: true });
        }
        
        return { newStreakCount: currentStreak, streakBroken };
      }
    } catch (error: any) {
      console.error(`Error updating user streak (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff + jitter
        const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, log and return default
      console.error("Failed to update user streak after retries:", error);
      return { newStreakCount: 0, streakBroken: false };
    }
  }
  
  return { newStreakCount: 0, streakBroken: false };
};

export const addUserBadge = async (
  userId: string,
  badgeId: string,
  userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user with initial badge
        const initialData = {
          uid: userId,
          email: userDetailsForCreation?.email || null,
          displayName: userDetailsForCreation?.displayName || null,
          photoURL: userDetailsForCreation?.photoURL || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          points: 0,
          level: 1,
          badges: [badgeId],
          overallStreakCount: 0,
          notesCreatedCount: 0,
          pdfNotesCreatedCount: 0,
          youtubeNotesCreatedCount: 0,
          aiNotesCreatedCount: 0,
          noteFlashcardsCreatedCount: 0,
          noteChatsStartedCount: 0,
        };
        
        await setDoc(userRef, initialData, { merge: true });
      } else {
        // Add badge to existing user
        const updateData = {
          badges: arrayUnion(badgeId),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userRef, updateData, { merge: true });
      }
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        const delay = Math.pow(2, retryCount) * 500 + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      console.error('Error adding user badge:', error);
      throw error;
    }
  }
};

export const incrementUserProfileCounter = async (
    userId: string,
    counterField: keyof Pick<UserProfileData, 'notesCreatedCount' | 'pdfNotesCreatedCount' | 'youtubeNotesCreatedCount' | 'aiNotesCreatedCount' | 'noteFlashcardsCreatedCount' | 'noteChatsStartedCount'>,
    incrementValue: number = 1,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    
    // Use a more robust approach with retry logic for race conditions
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            // Read current data first
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                // Create new user with initial counter value
                const initialData = {
                    uid: userId,
                    email: userDetailsForCreation?.email || null,
                    displayName: userDetailsForCreation?.displayName || null,
                    photoURL: userDetailsForCreation?.photoURL || null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    points: 0,
                    level: 1,
                    badges: [],
                    overallStreakCount: 0,
                    notesCreatedCount: 0,
                    pdfNotesCreatedCount: 0,
                    youtubeNotesCreatedCount: 0,
                    aiNotesCreatedCount: 0,
                    noteFlashcardsCreatedCount: 0,
                    noteChatsStartedCount: 0,
                    [counterField]: incrementValue
                };
                
                await setDoc(userRef, initialData, { merge: true });
            } else {
                // Get current value and increment
                const currentData = userSnap.data() as UserProfileData;
                const currentValue = (currentData[counterField] as number) || 0;
                const newValue = currentValue + incrementValue;
                
                const updateData = {
                    [counterField]: newValue,
                    updatedAt: serverTimestamp()
                };
                
                // Use setDoc with merge to avoid conflicts
                await setDoc(userRef, updateData, { merge: true });
            }
            
            // Success - break out of retry loop
            break;
            
        } catch (error: any) {
            if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
                // Wait before retrying with exponential backoff + jitter
                const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
                await new Promise(resolve => setTimeout(resolve, delay));
                retryCount++;
                continue;
            }
            
            // If it's not a retryable error or we've exhausted retries, log and rethrow
            console.error(`Failed to increment user profile counter ${counterField} after retries:`, error);
            throw error;
        }
    }
};

export const calculateLevel = (points: number): number => {
    if (points <= 0) return 0;
    const base = 100;
    const factor = 1.2;
    let level = 1;
    let pointsNeededForNextLevel = base;
    let cumulativePoints = 0;
    while (points >= cumulativePoints + pointsNeededForNextLevel) {
        cumulativePoints += pointsNeededForNextLevel;
        level++;
        pointsNeededForNextLevel = Math.floor(pointsNeededForNextLevel * factor);
    }
    return level;
};
