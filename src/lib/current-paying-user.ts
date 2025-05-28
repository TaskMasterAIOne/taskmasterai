import { db } from "./firebase"; // Assuming firebase.ts exports your db instance
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  increment,
} from "firebase/firestore";

// --- Hardcoded Email Lists (Fallback / Manual Override) --
const PREMIUM_EMAILS = [
    "robinmyh@gmail.com",
    "oliverbeckett069420@gmail.com",
    "bajinsrinivasr@lexington1.net",
    "guyplayin2k@gmail.com",
    "chagio@gmail.com",
    "patrick@envoymobile.com",
    "a.adityaabhinav10@gmail.com",
    "mitevandon94@gmail.com",
    "starboyy87@outlook.com",
    "draco77654@gmail.com",
    "poojarameshkumar789@gmail.com",
    "achallapureddy@gmail.com",
    "ali.ahsan.a214@gmail.com",
    "nihalikatta@gmail.com"
];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];

// --- User Tier Type ---
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

// --- Usage Limits ---
export const NOTE_LIMITS = {
    basic: { pdfAi: 2, youtube: 1 },
    pro: { pdfAi: 10, youtube: 5 },
    premium: { pdfAi: Infinity, youtube: Infinity },
};
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
}

// --- Core Tier Logic ---

/**
 * Determines the user's tier.
 * 1. Checks Firestore for 'activeTier' and 'subscriptionStatus' (set by Stripe webhook).
 * 2. If not found or inactive, falls back to hardcoded email lists.
 * Returns 'loading' if userId or email (for fallback) is being determined.
 * @param {string | null | undefined} userId - The user's Firebase UID.
 * @param {string | null | undefined} email - The user's email address (for fallback).
 * @returns {Promise<UserTier>} A promise resolving to the calculated user tier.
 */
export const getUserTier = async (userId: string | null | undefined, email: string | null | undefined): Promise<UserTier> => {
    if (userId === undefined || userId === null) return 'loading'; // Still determining auth state

    try {
        // --- Step 1: Check Firestore for Stripe-managed subscription ---
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const stripeStatus = data.subscriptionStatus;
            const stripeTier = data.activeTier; // This should be 'pro' or 'premium'

            // If user has an active Stripe subscription, that takes precedence
            if (stripeStatus === 'active' && (stripeTier === 'pro' || stripeTier === 'premium')) {
                return stripeTier;
            }
        }
        // If no active Stripe subscription, proceed to email fallback.
        // User document might not exist yet if they haven't completed any action that creates it,
        // or if the webhook hasn't run/updated it yet.
    } catch (error) {
        console.error(`Error fetching Firestore tier for ${userId}:`, error);
        // Fall through to email check if Firestore read fails
    }

    // --- Step 2: Fallback to hardcoded email lists ---
    // This requires the email to be passed to the function now.
    if (email === undefined) return 'loading'; // Still determining email
    if (!email) return 'basic'; // No email provided for fallback

    if (PREMIUM_EMAILS.includes(email)) {
        return 'premium';
    }
    if (PRO_EMAILS.includes(email)) {
        return 'pro';
    }

    return 'basic'; // Default if no Stripe sub and not in email lists
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
 * @returns {{ pdfAi: number; youtube: number }} The note limits.
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


// --- Chat Usage Functions (Logic remains the same) ---

export const getCurrentMonthUserChatUsage = async (userId: string, currentMonth: string): Promise<ChatUsageData | null> => {
  if (!userId || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
    console.warn("Invalid params for getCurrentMonthUserChatUsage.");
    return null;
  }
  try {
    const usageRef = doc(db, `users/${userId}/usage/chat`);
    const docSnap = await getDoc(usageRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as ChatUsageData;
      if (data?.month === currentMonth && typeof data.count === 'number') {
        return { count: data.count, month: data.month, lastUpdated: data.lastUpdated };
      }
    }
  } catch (error) {
    console.error(`Error getting chat usage for ${userId}:`, error);
  }
  return null;
};

export const incrementUserChatUsage = async (userId: string): Promise<void> => {
  if (!userId) {
      throw new Error("Invalid parameters for incrementing chat usage.");
  }
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageRef = doc(db, `users/${userId}/usage/chat`);
  try {
      const docSnap = await getDoc(usageRef);
      if (docSnap.exists() && docSnap.data()?.month === currentMonth) {
          await updateDoc(usageRef, {
              count: increment(1),
              lastUpdated: serverTimestamp()
          });
      } else {
          await setDoc(usageRef, {
              count: 1,
              month: currentMonth,
              lastUpdated: serverTimestamp()
          });
      }
  } catch (error) {
      console.error(`Error incrementing/resetting chat usage for ${userId}:`, error);
      throw new Error(`Failed to update chat usage.`);
  }
};

// --- Note Usage Functions (Logic remains the same) ---

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
            const currentMonthYear = new Date().toISOString().slice(0, 7);
            const usageFieldName = `noteCounts_${currentMonthYear}`;
            const usageData = userData?.[usageFieldName];

            if (usageData && typeof usageData.pdfAi === 'number' && typeof usageData.youtube === 'number') {
                return {
                    pdfAi: usageData.pdfAi,
                    youtube: usageData.youtube,
                    month: currentMonthYear
                };
            }
        } else {
             console.warn(`User doc not found for ${userId} fetching note usage.`);
        }
    } catch (error) {
        console.error(`Error getting note usage for ${userId}:`, error);
    }
    return null;
};

export const updateUserNoteUsage = async (userId: string, usageCounts: { pdfAi: number; youtube: number }, currentMonth: string): Promise<void> => {
    if (!userId || typeof usageCounts?.pdfAi !== 'number' || typeof usageCounts?.youtube !== 'number' || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
        console.error("Invalid params for updateUserNoteUsage:", { userId, usageCounts, currentMonth });
        throw new Error("Invalid params for updating note usage.");
    }
    try {
        const userRef = doc(db, 'users', userId);
        const usageFieldName = `noteCounts_${currentMonth}`;
        const updateData = {
            [usageFieldName]: {
                pdfAi: usageCounts.pdfAi,
                youtube: usageCounts.youtube,
            }
        };
        await setDoc(userRef, updateData, { merge: true });
    } catch (error) {
        console.error(`Error updating note usage for ${userId}:`, error);
        throw new Error(`Failed to update note usage.`);
    }
};
