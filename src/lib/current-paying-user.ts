import { db } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";
import { User } from "firebase/auth";

export const PREMIUM_EMAILS = [
    "bajinsrinivasr@lexington1.net",  "1cosmic20@gmail.com", "enable73@gmail.com", "williansugiyama@gmail.com", "amlitha@gmail.com", "paulkoh4@gmail.com", "richard@openhaul.com",
    "poojarameshkumar789@gmail.com", "achallapureddy@gmail.com", "ali.ahsan.a214@gmail.com", "amrish.naranappa@gmail.com",
    "navaneeth.ravindranath@gmail.com", "Goduwin_Ravi@yahoo.com", "gautham.paddu@outlook.com", "Isha.kandhaluram@gmail.com", "learner@example.com", "benjamin.schreiber3@gmail.com"
];

export const PRO_EMAILS = ["srinibaj10@gmail.com"];

export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

export const NOTE_LIMITS = {
    basic: { pdfAi: 2, youtube: 1 },
    pro: { pdfAi: 10, youtube: 5 },
    premium: { pdfAi: Infinity, youtube: Infinity },
    loading: { pdfAi: 0, youtube: 0 },
};
export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;
export const BRIEF_REFRESH_LIMIT_PRO = 10;
export const POINTS_FOR_FREE_PREMIUM = 1000;

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

// This interface now defines the structure of the main users/{userId} document
export interface UserProfileData {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  name?: string;
  firstName?: string;
  lastName?: string;
  
  points: number;
  level: number;
  overallStreakCount: number;
  lastOverallStreakUpdate: Timestamp | Date | null;
  notesStreakCount: number;
  lastNotesStreakUpdate: Timestamp | Date | null;
  badges: string[];
  
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;
  
  premiumAwardedUntil?: Timestamp | Date | null;
  activeTier: UserTier;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'incomplete' | null;

  noteUsageByMonth?: { [monthYear: string]: { pdfAi: number; youtube: number; lastUpdated: Timestamp } };
  notesCreatedCount?: number;
  pdfNotesCreatedCount?: number;
  youtubeNotesCreatedCount?: number;
  aiNotesCreatedCount?: number;
  noteFlashcardsCreatedCount?: number;
  noteChatsStartedCount?: number;
}

// Helper to safely convert Firestore Timestamps (or other date formats) to Date objects
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

// This function prepares the initial data for a BRAND NEW user.
// It's exported so SignUp.tsx can use it.
export const prepareNewUserData = (
    user: User, 
    firstName?: string, 
    lastName?: string
): Omit<UserProfileData, 'level'> & {level: number, createdAt: any, updatedAt: any, lastLoginAt: any} => {
    const now = serverTimestamp();
    const fullName = (firstName && lastName) 
        ? `${firstName.trim()} ${lastName.trim()}` 
        : user.displayName || "New User";
    
    const email = user.email || "";
    const initialTier: UserTier = PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase()) ? 'premium' :
                                  PRO_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase()) ? 'pro' : 'basic';

    return {
        uid: user.uid,
        email: user.email,
        firstName: firstName?.trim() || "",
        lastName: lastName?.trim() || "",
        name: fullName,
        displayName: fullName,
        photoURL: user.photoURL || null,
        
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        activeTier: initialTier,
        subscriptionStatus: null,
        
        points: 0,
        level: 1,
        overallStreakCount: 0,
        lastOverallStreakUpdate: null,
        notesStreakCount: 0,
        lastNotesStreakUpdate: null,
        badges: [],
        premiumAwardedUntil: null,

        noteUsageByMonth: {},
        notesCreatedCount: 0,
        pdfNotesCreatedCount: 0,
        youtubeNotesCreatedCount: 0,
        aiNotesCreatedCount: 0,
        noteFlashcardsCreatedCount: 0,
        noteChatsStartedCount: 0,
    };
};

// Simplified tier check logic
export const getUserTier = async (userId: string, userProfile?: UserProfileData): Promise<UserTier> => {
    if (!userId) return 'loading';

    let profile = userProfile;
    if (!profile) {
        try {
            const userRef = doc(db, 'users', userId);
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                profile = docSnap.data() as UserProfileData;
            } else {
                return 'basic'; // User doc doesn't exist
            }
        } catch (error) {
            console.error(`Error fetching user for tier check ${userId}:`, error);
            return 'basic'; // Default to basic on error
        }
    }

    if (!profile) return 'basic';

    const awardedUntil = toDateSafe(profile.premiumAwardedUntil);
    if (awardedUntil && awardedUntil > new Date()) {
        return 'premium';
    }

    if (profile.subscriptionStatus === 'active' && (profile.activeTier === 'pro' || profile.activeTier === 'premium')) {
        return profile.activeTier;
    }
    
    const currentEmail = profile.email?.toLowerCase();
    if (currentEmail) {
        if (PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'premium';
        if (PRO_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'pro';
    }

    return profile.activeTier || 'basic';
};

// --- USAGE LOGIC (UNCHANGED, but depends on other functions) ---
export const getChatLimitForTier = (tier: UserTier): number => { /* ... unchanged ... */ };
export const getNoteLimitsForTier = (tier: UserTier): { pdfAi: number; youtube: number } => { /* ... unchanged ... */ };
export const getCurrentMonthUserChatUsage = async (userId: string, currentMonth: string): Promise<ChatUsageData | null> => { /* ... unchanged ... */ };
export const incrementUserChatUsage = async (userId: string): Promise<void> => { /* ... unchanged ... */ };

// --- PROGRESS/GAMIFICATION LOGIC (REFACTORED) ---
// All functions now point to the single users/{userId} document.
// The complex "create if not exists" logic is removed, assuming the doc is created on signup.

export const getUserNoteUsage = async (userId: string): Promise<NoteUsageData> => {
    if (!userId) return { pdfAi: 0, youtube: 0, month: '' };
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfileData;
            const monthlyUsage = userData?.noteUsageByMonth?.[currentMonthYear];
            if (monthlyUsage && typeof monthlyUsage.pdfAi === 'number' && typeof monthlyUsage.youtube === 'number') {
                return { ...monthlyUsage, month: currentMonthYear };
            } else {
                 await updateDoc(userRef, {
                    [`noteUsageByMonth.${currentMonthYear}`]: { pdfAi: 0, youtube: 0, lastUpdated: serverTimestamp() },
                    updatedAt: serverTimestamp()
                });
                return { pdfAi: 0, youtube: 0, month: currentMonthYear };
            }
        }
    } catch (error) {
        console.error(`Error getting note usage for ${userId}:`, error);
    }
    return { pdfAi: 0, youtube: 0, month: currentMonthYear };
};

export const updateUserNoteUsage = async (userId: string, typeToIncrement: 'pdfAi' | 'youtube'): Promise<void> => {
    if (!userId || !typeToIncrement) {
        throw new Error("Invalid params for updating note usage.");
    }
    const userRef = doc(db, 'users', userId);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const updatePath = `noteUsageByMonth.${currentMonth}.${typeToIncrement}`;
    const lastUpdatedPath = `noteUsageByMonth.${currentMonth}.lastUpdated`;

    try {
        await updateDoc(userRef, {
            [updatePath]: increment(1),
            [lastUpdatedPath]: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error(`Error updating note usage for ${userId}:`, error);
        // If the update fails (likely because the month's map doesn't exist), set it first.
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const userData = userSnap.data() as UserProfileData;
            const noteUsage = userData.noteUsageByMonth || {};
            if (!noteUsage[currentMonth]) {
                noteUsage[currentMonth] = { pdfAi: 0, youtube: 0, lastUpdated: Timestamp.now() };
            }
            (noteUsage[currentMonth] as any)[typeToIncrement]++;
            await updateDoc(userRef, { noteUsageByMonth: noteUsage, updatedAt: serverTimestamp() });
        }
    }
};

export const onUserProfileSnapshot = (userId: string, callback: (profile: UserProfileData | null) => void): (() => void) => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
      callback({
        ...data,
        uid: docSnap.id,
        level: data.level || calculateLevel(data.points || 0),
        lastOverallStreakUpdate: toDateSafe(data.lastOverallStreakUpdate),
        lastNotesStreakUpdate: toDateSafe(data.lastNotesStreakUpdate),
        createdAt: toDateSafe(data.createdAt) || new Date(),
        updatedAt: toDateSafe(data.updatedAt) || new Date(),
        premiumAwardedUntil: toDateSafe(data.premiumAwardedUntil),
      } as UserProfileData);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to user profile:", error);
    callback(null);
  });
};

export const updateUserPointsAndLevel = async (userId: string, pointsToAdd: number): Promise<{ newPoints: number, newLevel: number, newTier?: UserTier }> => {
  const userRef = doc(db, 'users', userId);
  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) { throw new Error("User document not found for point update."); }

    let newTierAwarded: UserTier | undefined = undefined;
    const currentProfileData = userSnap.data() as UserProfileData;
    const currentPoints = currentProfileData.points || 0;
    const newPoints = currentPoints + pointsToAdd;
    const newLevel = calculateLevel(newPoints);

    const updateData: any = {
        points: newPoints,
        level: newLevel,
        updatedAt: serverTimestamp(),
    };

    const currentTier = currentProfileData.activeTier || 'basic';
    if ((currentTier === 'basic' || currentTier === 'pro') &&
        (!currentProfileData.premiumAwardedUntil || toDateSafe(currentProfileData.premiumAwardedUntil)! < new Date()) &&
        newPoints >= POINTS_FOR_FREE_PREMIUM && currentPoints < POINTS_FOR_FREE_PREMIUM) {
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
        updateData.premiumAwardedUntil = Timestamp.fromDate(oneWeekFromNow);
        newTierAwarded = 'premium';
    }
    
    transaction.update(userRef, updateData);
    return { newPoints, newLevel, newTier: newTierAwarded };
  });
};

export const updateUserStreak = async (userId: string, streakType: 'overall' | 'notes' = 'overall'): Promise<{ newStreakCount: number, streakBroken: boolean }> => {
  const userRef = doc(db, 'users', userId);

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) { throw new Error("User document not found for streak update."); }

    const currentProfileData = userSnap.data() as UserProfileData;
    let currentStreak: number;
    let lastUpdateRaw: Timestamp | Date | null;
    const now = new Date();
    let streakBroken = false;

    if (streakType === 'overall') {
        currentStreak = currentProfileData.overallStreakCount || 0;
        lastUpdateRaw = currentProfileData.lastOverallStreakUpdate;
    } else {
        currentStreak = currentProfileData.notesStreakCount || 0;
        lastUpdateRaw = currentProfileData.lastNotesStreakUpdate;
    }

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
        const updateData: any = { updatedAt: serverTimestamp() };
        if (streakType === 'overall') {
            updateData.overallStreakCount = currentStreak;
            updateData.lastOverallStreakUpdate = Timestamp.fromDate(now);
        } else {
            updateData.notesStreakCount = currentStreak;
            updateData.lastNotesStreakUpdate = Timestamp.fromDate(now);
        }
        transaction.update(userRef, updateData);
    }
    return { newStreakCount: currentStreak, streakBroken };
  });
};

export const addUserBadge = async (userId: string, badgeId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
      const currentBadges = userSnap.data().badges || [];
      if (!currentBadges.includes(badgeId)) {
          await updateDoc(userRef, {
              badges: arrayUnion(badgeId),
              updatedAt: serverTimestamp()
          });
      }
  }
};

export const incrementUserProfileCounter = async (userId: string, counterField: keyof Pick<UserProfileData, 'notesCreatedCount' | 'pdfNotesCreatedCount' | 'youtubeNotesCreatedCount' | 'aiNotesCreatedCount' | 'noteFlashcardsCreatedCount' | 'noteChatsStartedCount'>): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        [counterField]: increment(1),
        updatedAt: serverTimestamp()
    });
};

export const calculateLevel = (points: number): number => {
    if (points <= 0) return 1;
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
