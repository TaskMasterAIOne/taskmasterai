/* ------------------------------------------------------------------
   src/lib/current-paying-user.ts

   Manages user tiers (premium/pro/basic) and tracks chat and note usage.
   ------------------------------------------------------------------ */

import { db } from "./firebase"; // Assuming firebase.ts is in the same directory
import {
  doc,
  getDoc,
  setDoc,
  updateDoc, // Import updateDoc
  serverTimestamp,
  Timestamp,
  increment, // Import increment
} from "firebase/firestore";

// --- Tier Definition ---
const PREMIUM_EMAILS = [
    "robinmyh@gmail.com",
    "oliverbeckett069420@gmail.com",
    "bajinsrinivasr@lexington1.net",
"guyplayin2k@gmail.com",
   "draco77654@gmail.com",
   "chagio@gmail.com"
];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];

// --- User Tier Type ---
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

// --- START: Added Note Usage Limits ---
export const NOTE_LIMITS = {
    basic: { pdfAi: 2, youtube: 1 },
    pro: { pdfAi: 10, youtube: 5 },
    premium: { pdfAi: Infinity, youtube: Infinity },
};
// --- END: Added Note Usage Limits ---

// --- Chat Usage Limits ---
export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;

// --- Data Structures ---
export interface ChatUsageData {
    count: number;
    month: string; // Format: YYYY-MM
    lastUpdated?: Timestamp;
}

export interface NoteUsageData {
    pdfAi: number;
    youtube: number;
    month: string; // Format: YYYY-MM
    // lastUpdated?: Timestamp; // Optional
}


// --- Core Logic ---

/**
 * Determines the user's tier based on their email address.
 * Returns 'loading' if email is being determined, 'basic' if null/undefined or not pro/premium.
 * @param {string | null | undefined} email - The user's email address.
 * @returns {UserTier} The calculated user tier.
 */
export const getUserTier = (email: string | null | undefined): UserTier => {
    if (email === undefined) return 'loading';
    if (!email) return 'basic';
    if (PREMIUM_EMAILS.includes(email)) return 'premium';
    if (PRO_EMAILS.includes(email)) return 'pro';
    return 'basic';
};

/**
 * Retrieves the chat usage limit for a given user tier.
 * @param {UserTier} tier - The user's tier.
 * @returns {number} The chat limit (Infinity for premium).
 */
export const getChatLimitForTier = (tier: UserTier): number => {
    switch (tier) {
        case 'premium': return Infinity;
        case 'pro': return PRO_CHAT_LIMIT;
        case 'basic': return BASIC_CHAT_LIMIT;
        case 'loading': return 0;
        default: return BASIC_CHAT_LIMIT;
    }
};

/**
 * Retrieves the note creation limits for a given user tier.
 * @param {UserTier} tier - The user's tier.
 * @returns {{ pdfAi: number; youtube: number }} The note limits (Infinity for premium).
 */
export const getNoteLimitsForTier = (tier: UserTier): { pdfAi: number; youtube: number } => {
    switch (tier) {
        case 'premium': return NOTE_LIMITS.premium;
        case 'pro': return NOTE_LIMITS.pro;
        case 'basic': return NOTE_LIMITS.basic;
        case 'loading': return { pdfAi: 0, youtube: 0 };
        default: return NOTE_LIMITS.basic;
    }
};


// --- START: Chat Usage Functions ---

/**
 * Fetches the user's chat usage data for the current month from Firestore.
 * Reads from `users/{userId}/usage/chat`.
 * Returns the data only if it exists and matches the current month.
 * @param {string} userId - The user's Firebase UID.
 * @param {string} currentMonth - The current month in "YYYY-MM" format.
 * @returns {Promise<ChatUsageData | null>} A promise resolving to the usage data or null.
 */
export const getCurrentMonthUserChatUsage = async (userId: string, currentMonth: string): Promise<ChatUsageData | null> => {
  if (!userId) {
      console.warn("getCurrentMonthUserChatUsage called without userId.");
      return null;
  }
  if (!currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
    console.error("getCurrentMonthUserChatUsage called with invalid currentMonth:", currentMonth);
    return null;
  }

  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`);
    const docSnap = await getDoc(usageRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ChatUsageData;

      // Validate data structure and month match
      if (data && typeof data.count === 'number' && data.month === currentMonth) {
        return { count: data.count, month: data.month, lastUpdated: data.lastUpdated };
      } else {
         // Data exists but is for a previous month or invalid
         console.log(`Chat usage data found for user ${userId} but for month ${data?.month} (current: ${currentMonth}) or invalid format. Will reset on next increment.`);
         return null; // Treat as non-existent for the *current* month
      }
    } else {
      return null; // No chat usage document found
    }
  } catch (error) {
    console.error(`Error getting user chat usage for ${userId}:`, error);
    return null;
  }
};

/**
 * Atomically increments the user's chat usage count for the current month in Firestore.
 * If the usage document doesn't exist or is for a previous month, it resets the count to 1 for the current month.
 * Writes to `users/{userId}/usage/chat`.
 * @param {string} userId - The user's Firebase UID.
 * @returns {Promise<void>} A promise that resolves when the update is complete or rejects on error.
 */
export const incrementUserChatUsage = async (userId: string): Promise<void> => {
  if (!userId) {
      console.error("Invalid parameters for incrementUserChatUsage: userId is required.");
      throw new Error("Invalid parameters for incrementing chat usage.");
  }

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const usageRef = doc(db, `users/${userId}/usage/chat`); // Path to the chat usage doc

  try {
      // We still need to get the document to check the month
      const docSnap = await getDoc(usageRef);

      if (docSnap.exists() && docSnap.data()?.month === currentMonth) {
          // Document exists and is for the current month: Increment Atomically
          await updateDoc(usageRef, {
              count: increment(1), // Use atomic increment
              lastUpdated: serverTimestamp()
          });
          // console.log(`Chat usage incremented for user ${userId} for month ${currentMonth}`);
      } else {
          // Document doesn't exist OR exists but is for a previous month: Reset for current month
          await setDoc(usageRef, {
              count: 1, // Start count at 1 for the first message of the month
              month: currentMonth,
              lastUpdated: serverTimestamp()
          });
           console.log(`Chat usage reset to 1 for user ${userId} for new month ${currentMonth}`);
      }
  } catch (error) {
      console.error(`Error incrementing/resetting user chat usage for ${userId}:`, error);
      throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// --- END: Chat Usage Functions ---


// --- START: Note Usage Functions ---
// Note: Note usage uses setDoc with merge:true, which is generally safe for overwriting
// specific month fields. If atomic increments were needed here (e.g., tracking total notes ever),
// a similar `increment` approach would be used. Current logic seems okay for monthly counts.

/**
 * Fetches the user's note creation usage data for the current month from Firestore.
 * Reads from the main user doc: `users/{userId}` field `noteCounts_YYYY-MM`.
 * @param {string} userId - The user's Firebase UID.
 * @returns {Promise<NoteUsageData | null>} A promise resolving to the note usage data or null if not found/error/wrong month.
 */
export const getUserNoteUsage = async (userId: string): Promise<NoteUsageData | null> => {
    if (!userId) {
        console.warn("getUserNoteUsage called without userId.");
        return null;
    }
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const currentMonthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
            const usageFieldName = `noteCounts_${currentMonthYear}`;

            if (userData && userData[usageFieldName] && typeof userData[usageFieldName].pdfAi === 'number' && typeof userData[usageFieldName].youtube === 'number') {
                return {
                    pdfAi: userData[usageFieldName].pdfAi,
                    youtube: userData[usageFieldName].youtube,
                    month: currentMonthYear
                };
            } else {
                console.log(`Note usage data not found or invalid for user ${userId} for month ${currentMonthYear}.`);
                return null;
            }
        } else {
             console.warn(`User document not found for userId: ${userId} when fetching note usage.`);
             return null;
        }
    } catch (error) {
        console.error(`Error getting user note usage for ${userId}:`, error);
        return null;
    }
};


/**
 * Updates or sets the user's note creation usage counts for a specific month in Firestore.
 * Writes to the main user doc: `users/{userId}` field `noteCounts_YYYY-MM`.
 * Uses `setDoc` with `merge: true` to only update the specific month's usage field.
 * @param {string} userId - The user's Firebase UID.
 * @param {{ pdfAi: number; youtube: number }} usageCounts - The new counts for the month.
 * @param {string} currentMonth - The current month in "YYYY-MM" format.
 * @returns {Promise<void>} A promise that resolves when the update is complete or rejects on error.
 */
export const updateUserNoteUsage = async (userId: string, usageCounts: { pdfAi: number; youtube: number }, currentMonth: string): Promise<void> => {
    if (!userId || typeof usageCounts?.pdfAi !== 'number' || typeof usageCounts?.youtube !== 'number' || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
        console.error("Invalid parameters for updateUserNoteUsage:", { userId, usageCounts, currentMonth });
        throw new Error("Invalid parameters for updating note usage.");
    }
    try {
        const userRef = doc(db, 'users', userId);
        const usageFieldName = `noteCounts_${currentMonth}`;

        const updateData = {
            [usageFieldName]: {
                pdfAi: usageCounts.pdfAi,
                youtube: usageCounts.youtube,
                // lastUpdated: serverTimestamp() // Optional
            }
        };
        await setDoc(userRef, updateData, { merge: true });
        // console.log(`Note usage updated for user ${userId} for month ${currentMonth}:`, usageCounts);
    } catch (error) {
        console.error(`Error updating user note usage for ${userId}:`, error);
        throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// --- END: Note Usage Functions ---
