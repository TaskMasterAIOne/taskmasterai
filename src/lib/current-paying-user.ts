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

const PREMIUM_EMAILS = [
    "bajinsrinivasr@lexington1.net",  "1cosmic20@gmail.com", "enable73@gmail.com", "williansugiyama@gmail.com", "amlitha@gmail.com", "paulkoh4@gmail.com", "richard@openhaul.com", "suryar9108@gmail.com", "yhlvyp@gmail.com", "poojarameshkumar789@gmail.com", "achallapureddy@gmail.com", "ali.ahsan.a214@gmail.com", "amrish.naranappa@gmail.com",
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
  notesStreakCount: number;
  lastNotesStreakUpdate: Timestamp | Date | null;
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
}

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

export const prepareInitialProfileData = (userId: string, email?: string | null, displayName?: string | null, photoURL?: string | null, firstName?: string | null, lastName?: string | null): Omit<UserProfileData, 'updatedAt' | 'lastLoginAt'> => {
    const now = Timestamp.now();
    const initialTier: UserTier = (email && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) ? 'premium' :
                                (email && PRO_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) ? 'pro' : 'basic';
    return {
        uid: userId,
        email: email ?? null,
        displayName: displayName ?? null,
        name: displayName ?? null,
        photoURL: photoURL ?? null,
        firstName: firstName?.trim() ?? '',
        lastName: lastName?.trim() ?? '',
        points: 0,
        level: 1,
        overallStreakCount: 0,
        lastOverallStreakUpdate: null,
        notesStreakCount: 0,
        lastNotesStreakUpdate: null,
        badges: [],
        createdAt: now,
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
    switch (tier) {
        case 'premium': return Infinity;
        case 'pro': return PRO_CHAT_LIMIT;
        case 'basic': return BASIC_CHAT_LIMIT;
        case 'loading': return 0;
        default: return BASIC_CHAT_LIMIT;
    }
};

export const getNoteLimitsForTier = (tier: UserTier): { pdfAi: number; youtube: number } => {
    return NOTE_LIMITS[tier] || NOTE_LIMITS.basic;
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
  const currentMonth = new Date().toISOString().slice(0, 7);
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
    const currentMonthYear = new Date().toISOString().slice(0, 7);
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfileData;
            const monthlyUsage = userData?.noteUsageByMonth?.[currentMonthYear];
            if (monthlyUsage && typeof monthlyUsage.pdfAi === 'number' && typeof monthlyUsage.youtube === 'number') {
                return { pdfAi: monthlyUsage.pdfAi, youtube: monthlyUsage.youtube, month: currentMonthYear };
            }
            return { pdfAi: 0, youtube: 0, month: currentMonthYear };
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
    } catch (error) {
        console.error(`Error updating note usage for ${userId}:`, error);
        throw new Error(`Failed to update note usage.`);
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
        level: data.level || calculateLevel(data.points || 0),
        lastOverallStreakUpdate: toDateSafe(data.lastOverallStreakUpdate),
        lastNotesStreakUpdate: toDateSafe(data.lastNotesStreakUpdate),
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
    const fullInitialData = {
        ...initialData,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    let newTierAwarded: UserTier | undefined = undefined;

    if (!userSnap.exists()) {
        const initialData = createProfileInTransaction(transaction, userRef, userId, userDetailsForCreation);
        const newPoints = pointsToAdd;
        initialData.points = newPoints;
        initialData.level = calculateLevel(newPoints);
        transaction.update(userRef, { points: newPoints, level: initialData.level });
        return { newPoints: initialData.points, newLevel: initialData.level, newTier: undefined };
    } else {
        const currentProfileData = userSnap.data() as UserProfileData;
        const currentPoints = currentProfileData.points || 0;
        const newPoints = currentPoints + pointsToAdd;
        const newLevel = calculateLevel(newPoints);

        const updateData: any = {
            points: newPoints,
            level: newLevel,
            updatedAt: serverTimestamp(),
        };

        const currentTier = await getUserTier(userId, currentProfileData.email);
        if ( (currentTier === 'basic' || currentTier === 'pro') &&
            (!currentProfileData.premiumAwardedUntil || toDateSafe(currentProfileData.premiumAwardedUntil)! < new Date()) &&
            newPoints >= POINTS_FOR_FREE_PREMIUM && currentPoints < POINTS_FOR_FREE_PREMIUM
        ) {
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
            updateData.premiumAwardedUntil = Timestamp.fromDate(oneWeekFromNow);
            newTierAwarded = 'premium';
        }
        transaction.update(userRef, updateData);
        return { newPoints, newLevel, newTier: newTierAwarded };
    }
  });
};

export const updateUserStreak = async (
    userId: string,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; },
    streakType: 'overall' | 'notes' = 'overall'
): Promise<{ newStreakCount: number, streakBroken: boolean }> => {
  const userRef = doc(db, 'users', userId);

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
        const initialData = createProfileInTransaction(transaction, userRef, userId, userDetailsForCreation);
        const now = Timestamp.now();
        if (streakType === 'overall') {
            initialData.overallStreakCount = 1;
            initialData.lastOverallStreakUpdate = now;
        } else {
            initialData.notesStreakCount = 1;
            initialData.lastNotesStreakUpdate = now;
        }
        transaction.update(userRef, {
            overallStreakCount: initialData.overallStreakCount,
            lastOverallStreakUpdate: initialData.lastOverallStreakUpdate,
            notesStreakCount: initialData.notesStreakCount,
            lastNotesStreakUpdate: initialData.lastNotesStreakUpdate,
        });
        return { newStreakCount: 1, streakBroken: false };
    } else {
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
    }
  });
};

export const addUserBadge = async (
  userId: string,
  badgeId: string,
  userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
        const initialData = createProfileInTransaction(transaction, userRef, userId, userDetailsForCreation);
        initialData.badges = [badgeId];
        transaction.update(userRef, { badges: initialData.badges });
    } else {
        transaction.update(userRef, {
            badges: arrayUnion(badgeId),
            updatedAt: serverTimestamp()
        });
    }
  });
};

export const incrementUserProfileCounter = async (
    userId: string,
    counterField: keyof Pick<UserProfileData, 'notesCreatedCount' | 'pdfNotesCreatedCount' | 'youtubeNotesCreatedCount' | 'aiNotesCreatedCount' | 'noteFlashcardsCreatedCount' | 'noteChatsStartedCount'>,
    incrementValue: number = 1,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<void> => {
    const userRef = doc(db, 'users', userId);
    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
            const initialData = createProfileInTransaction(transaction, userRef, userId, userDetailsForCreation);
            (initialData as any)[counterField] = incrementValue;
            transaction.update(userRef, { [counterField]: incrementValue });
        } else {
            transaction.update(userRef, {
                [counterField]: increment(incrementValue),
                updatedAt: serverTimestamp()
            });
        }
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
