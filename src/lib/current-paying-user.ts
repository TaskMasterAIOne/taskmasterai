/* ------------------------------------------------------------------
   src/lib/current-paying-user.ts

   Manages user tiers (premium/pro/basic) and tracks chat and note usage.
   ------------------------------------------------------------------ */

import { db } from "./firebase"; // Assuming firebase.ts is in the same directory
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp, // Keep import
} from "firebase/firestore";

// --- Tier Definitions ---
// These emails determine the user's tier. Ensure this list is kept up-to-date.
const PREMIUM_EMAILS = [
    "robinmyh@gmail.com",
    "oliverbeckett069420@gmail.com",
    "bajinsrinivasr@lexington1.net",
   "stevenmoore99op@gmail.com"
];
export const PRO_EMAILS = ["srinibaj10@gmail.com"]; // Export if needed elsewhere, but primarily used internally

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
// Premium has effectively unlimited chats (represented as Infinity in checks)

// --- Data Structures ---
export interface ChatUsageData {
    count: number;
    month: string; // Format: YYYY-MM
    lastUpdated?: Timestamp; // Optional: Track when usage was last updated
}

// --- START: Added Note Usage Data Structure ---
export interface NoteUsageData {
    pdfAi: number;
    youtube: number;
    month: string; // Format: YYYY-MM
    // lastUpdated?: Timestamp; // Optional
}
// --- END: Added Note Usage Data Structure ---


// --- Core Logic ---

/**
 * Determines the user's tier based on their email address.
 * Returns 'loading' if email is being determined, 'basic' if null/undefined or not pro/premium.
 * @param {string | null | undefined} email - The user's email address.
 * @returns {UserTier} The calculated user tier.
 */
export const getUserTier = (email: string | null | undefined): UserTier => {
    if (email === undefined) return 'loading'; // Still determining auth state
    if (!email) return 'basic'; // Logged in but no email somehow? -> basic
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
        case 'loading': return 0; // No limit applies while loading
        default: return BASIC_CHAT_LIMIT; // Default fallback
    }
};

// --- START: Added Note Limit Retrieval Function ---
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
        case 'loading': return { pdfAi: 0, youtube: 0 }; // No limits apply while loading
        default: return NOTE_LIMITS.basic; // Default fallback
    }
};
// --- END: Added Note Limit Retrieval Function ---


// --- START: Chat Usage Functions ---

/**
 * Fetches the user's chat usage data for the current month from Firestore.
 * Reads from `users/{userId}/usage/chat`.
 * @param {string} userId - The user's Firebase UID.
 * @returns {Promise<ChatUsageData | null>} A promise resolving to the usage data or null if not found/error/wrong month.
 */
export const getUserChatUsage = async (userId: string): Promise<ChatUsageData | null> => {
  if (!userId) {
      console.warn("getUserChatUsage called without userId.");
      return null;
  }
  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`); // Path to the chat usage doc
    const docSnap = await getDoc(usageRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ChatUsageData;
      const currentMonthYear = new Date().toISOString().slice(0, 7);

      // Validate data structure and month match
      if (data && typeof data.count === 'number' && data.month === currentMonthYear) {
        return { count: data.count, month: data.month, lastUpdated: data.lastUpdated };
      } else {
         console.log(`Chat usage data found for user ${userId} but for month ${data?.month} (current: ${currentMonthYear}) or invalid format.`);
         return null;
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
 * Updates or creates the user's chat usage count for a specific month in Firestore.
 * Writes to `users/{userId}/usage/chat`.
 * @param {string} userId - The user's Firebase UID.
 * @param {number} newCount - The new chat count for the month.
 * @param {string} currentMonth - The current month in "YYYY-MM" format.
 * @returns {Promise<void>} A promise that resolves when the update is complete or rejects on error.
 */
export const updateUserChatUsage = async (userId: string, newCount: number, currentMonth: string): Promise<void> => {
  if (!userId || typeof newCount !== 'number' || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
      console.error("Invalid parameters for updateUserChatUsage:", { userId, newCount, currentMonth });
      throw new Error("Invalid parameters for updating chat usage.");
  }
  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`); // Path to the chat usage doc
    await setDoc(usageRef, {
      count: newCount,
      month: currentMonth,
      lastUpdated: serverTimestamp()
    });
     // console.log(`Chat usage updated for user ${userId} for month ${currentMonth}: ${newCount}`);
  } catch (error) {
    console.error(`Error updating user chat usage for ${userId}:`, error);
    throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
// --- END: Chat Usage Functions ---


// --- START: Note Usage Functions ---

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
                // Data exists and looks valid for the current month
                return {
                    pdfAi: userData[usageFieldName].pdfAi,
                    youtube: userData[usageFieldName].youtube,
                    month: currentMonthYear
                    // lastUpdated: userData[usageFieldName].lastUpdated // Optional: if you add this field later
                };
            } else {
                // User exists, but no usage data for this month or data is invalid
                console.log(`Note usage data not found or invalid for user ${userId} for month ${currentMonthYear}.`);
                return null;
            }
        } else {
             // User document doesn't exist
             console.warn(`User document not found for userId: ${userId} when fetching note usage.`);
             return null;
        }
    } catch (error) {
        console.error(`Error getting user note usage for ${userId}:`, error);
        return null; // Return null on error
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

        // Prepare the update object specifically for the monthly usage field
        const updateData = {
            [usageFieldName]: {
                pdfAi: usageCounts.pdfAi,
                youtube: usageCounts.youtube,
                // lastUpdated: serverTimestamp() // Optional: track last update time for this field
            }
        };

        // Use setDoc with merge: true to update or create the specific month's field
        // without overwriting other fields in the user document.
        await setDoc(userRef, updateData, { merge: true });

        // console.log(`Note usage updated for user ${userId} for month ${currentMonth}:`, usageCounts); // Optional success log
    } catch (error) {
        console.error(`Error updating user note usage for ${userId}:`, error);
        throw new Error(`Failed to update note usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};
// --- END: Note Usage Functions ---
