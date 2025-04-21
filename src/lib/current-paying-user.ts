/* ------------------------------------------------------------------
   src/lib/current-paying-user.ts

   Manages user tiers (premium/pro/basic) and tracks chat usage.
   ------------------------------------------------------------------ */

import { db } from "./firebase"; // Assuming firebase.ts is in the same directory
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp, // Import Timestamp in case needed, though serverTimestamp is used for updates
} from "firebase/firestore";

// --- Tier Definitions ---
// These emails determine the user's tier. Ensure this list is kept up-to-date.
const PREMIUM_EMAILS = [
    "robinmyh@gmail.com",
    "oliverbeckett069420@gmail.com",
    "bajinsrinivasr@lexington1.net"
];
export const PRO_EMAILS = ["srinibaj10@gmail.com"]; // Export if needed elsewhere, but primarily used internally

// --- User Tier Type ---
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

// --- Usage Limits ---
export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;
// Premium has effectively unlimited chats (represented as Infinity in checks)

// --- Data Structures ---
export interface ChatUsageData {
    count: number;
    month: string; // Format: YYYY-MM
    lastUpdated?: Timestamp; // Optional: Track when usage was last updated
}

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

/**
 * Fetches the user's chat usage data for the current month from Firestore.
 * @param {string} userId - The user's Firebase UID.
 * @returns {Promise<ChatUsageData | null>} A promise resolving to the usage data or null if not found/error/wrong month.
 */
export const getUserChatUsage = async (userId: string): Promise<ChatUsageData | null> => {
  if (!userId) {
      console.warn("getUserChatUsage called without userId.");
      return null;
  }
  try {
    // Path to the document storing monthly chat usage
    // Example: users/{userId}/usage/chat_YYYY-MM (Alternative Structure)
    // Current Structure (as per dashboard-firebase): users/{userId}/usage/chat (stores latest month)
    const usageRef = doc(db, `users/${userId}/usage/chat`);
    const docSnap = await getDoc(usageRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ChatUsageData; // Assert the type
      const currentMonthYear = new Date().toISOString().slice(0, 7); // Format: YYYY-MM

      // Validate data structure and month match
      if (data && typeof data.count === 'number' && data.month === currentMonthYear) {
        return { count: data.count, month: data.month, lastUpdated: data.lastUpdated };
      } else {
         // Data exists but is for a previous month or invalid format
         console.log(`Chat usage data found for user ${userId} but for month ${data?.month} (current: ${currentMonthYear}) or invalid format.`);
         return null; // Treat as no valid data for the *current* month
      }
    } else {
      // No usage document found for the user (or specifically for this path)
      return null;
    }
  } catch (error) {
    console.error(`Error getting user chat usage for ${userId}:`, error);
    return null; // Return null on error to prevent breaking UI
  }
};

/**
 * Updates or creates the user's chat usage count for a specific month in Firestore.
 * Uses setDoc to overwrite the document at `users/{userId}/usage/chat` with the current month's data.
 * @param {string} userId - The user's Firebase UID.
 * @param {number} newCount - The new chat count for the month.
 * @param {string} currentMonth - The current month in "YYYY-MM" format.
 * @returns {Promise<void>} A promise that resolves when the update is complete or rejects on error.
 */
export const updateUserChatUsage = async (userId: string, newCount: number, currentMonth: string): Promise<void> => {
  if (!userId || typeof newCount !== 'number' || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
      console.error("Invalid parameters for updateUserChatUsage:", { userId, newCount, currentMonth });
      throw new Error("Invalid parameters for updating chat usage."); // Throw error for invalid input
  }
  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`);
    // Overwrite the document with the new count and current month
    await setDoc(usageRef, {
      count: newCount,
      month: currentMonth,
      lastUpdated: serverTimestamp() // Use serverTimestamp for reliable time
    });
     // console.log(`Chat usage updated for user ${userId} for month ${currentMonth}: ${newCount}`); // Optional success log
  } catch (error) {
    console.error(`Error updating user chat usage for ${userId}:`, error);
    // Re-throw the error to allow calling function to handle it (e.g., UI feedback)
    throw new Error(`Failed to update chat usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
