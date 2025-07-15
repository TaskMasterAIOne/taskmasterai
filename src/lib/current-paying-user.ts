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
    "bajinsrinivasr@lexington1.net", "draco77654@gmail.com", "1cosmic20@gmail.com",
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

export interface UserProfileData {
  id: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  points: number;
  level: number;
  overallStreakCount: number;
  lastOverallStreakUpdate: Timestamp | Date | null;
  notesStreakCount: number;
  lastNotesStreakUpdate: Timestamp | Date | null;
  badges: string[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
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

const toDateSafeForProfile = (timestampField: any): Date | null => {
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
        } catch (e) { console.warn("toDateSafeForProfile: Error converting plain object to Date", e); return null; }
    }
    return null;
};

const prepareInitialProfileData = (userId: string, email?: string | null, displayName?: string | null, photoURL?: string | null): UserProfileData => {
    const now = Timestamp.now();
    const initialTier: UserTier = (email && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) ? 'premium' :
                                (email && PRO_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) ? 'pro' : 'basic';
    return {
        id: userId,
        email: email ?? null,
        displayName: displayName ?? null,
        photoURL: photoURL ?? null,
        points: 0,
        level: 1,
        overallStreakCount: 0,
        lastOverallStreakUpdate: null,
        notesStreakCount: 0,
        lastNotesStreakUpdate: null,
        badges: [],
        createdAt: now,
        updatedAt: now,
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
    };
};

export const getUserTier = async (userId: string | null | undefined, emailFromProfileOrAuth: string | null | undefined, profileData?: UserProfileData | null): Promise<UserTier> => {
    if (!userId) return 'loading';

    let userProfile = profileData;
    if (!userProfile) {
        try {
            const userRef = doc(db, 'users', userId, 'profile', 'data');
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Partial<UserProfileData>;
                userProfile = {
                    ...prepareInitialProfileData(userId, data.email || emailFromProfileOrAuth, data.displayName, data.photoURL),
                    ...data,
                    id: docSnap.id,
                    lastOverallStreakUpdate: toDateSafeForProfile(data.lastOverallStreakUpdate),
                    lastNotesStreakUpdate: toDateSafeForProfile(data.lastNotesStreakUpdate),
                    createdAt: toDateSafeForProfile(data.createdAt) || new Date(),
                    updatedAt: toDateSafeForProfile(data.updatedAt) || new Date(),
                    premiumAwardedUntil: toDateSafeForProfile(data.premiumAwardedUntil),
                    activeTier: data.activeTier || 'basic',
                };
            } else {
                 return (emailFromProfileOrAuth && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(emailFromProfileOrAuth.toLowerCase())) ? 'premium' :
                       (emailFromProfileOrAuth && PRO_EMAILS.map(e => e.toLowerCase()).includes(emailFromProfileOrAuth.toLowerCase())) ? 'pro' : 'basic';
            }
        } catch (error) {
            console.error(`Error fetching Firestore profile for tier check ${userId}:`, error);
             return (emailFromProfileOrAuth && PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(emailFromProfileOrAuth.toLowerCase())) ? 'premium' :
                       (emailFromProfileOrAuth && PRO_EMAILS.map(e => e.toLowerCase()).includes(emailFromProfileOrAuth.toLowerCase())) ? 'pro' : 'basic';
        }
    }

    if (!userProfile) {
        return 'basic';
    }

    if (userProfile.premiumAwardedUntil) {
        const awardedUntilDate = toDateSafeForProfile(userProfile.premiumAwardedUntil);
        if (awardedUntilDate && awardedUntilDate > new Date()) {
            return 'premium';
        }
    }

    if (userProfile.subscriptionStatus === 'active' && (userProfile.activeTier === 'pro' || userProfile.activeTier === 'premium')) {
        return userProfile.activeTier;
    }

    const currentEmail = (emailFromProfileOrAuth || userProfile.email)?.toLowerCase();
    if (currentEmail) {
        if (PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'premium';
        if (PRO_EMAILS.map(e => e.toLowerCase()).includes(currentEmail)) return 'pro';
    }

    return userProfile.activeTier || 'basic';
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
        const userProfileRef = doc(db, 'users', userId, 'profile', 'data');
        const docSnap = await getDoc(userProfileRef);
        if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfileData;
            const monthlyUsage = userData?.noteUsageByMonth?.[currentMonthYear];
            if (monthlyUsage && typeof monthlyUsage.pdfAi === 'number' && typeof monthlyUsage.youtube === 'number') {
                return { pdfAi: monthlyUsage.pdfAi, youtube: monthlyUsage.youtube, month: currentMonthYear };
            } else if (userData) {
                 await updateDoc(userProfileRef, {
                    [`noteUsageByMonth.${currentMonthYear}`]: { pdfAi: 0, youtube: 0, lastUpdated: serverTimestamp() },
                    updatedAt: serverTimestamp()
                });
                return { pdfAi: 0, youtube: 0, month: currentMonthYear };
            }
        } else {
             return { pdfAi: 0, youtube: 0, month: currentMonthYear };
        }
    } catch (error) {
        console.error(`Error getting note usage for ${userId}:`, error);
    }
    return { pdfAi: 0, youtube: 0, month: currentMonthYear };
};

export const updateUserNoteUsage = async (userId: string, typeToIncrement: 'pdfAi' | 'youtube', currentMonth: string): Promise<void> => {
    if (!userId || !typeToIncrement || !currentMonth || !/^\d{4}-\d{2}$/.test(currentMonth)) {
        throw new Error("Invalid params for updating note usage.");
    }
    const userProfileRef = doc(db, 'users', userId, 'profile', 'data');

    try {
        await runTransaction(db, async (transaction) => {
            const profileSnap = await transaction.get(userProfileRef);
            if (!profileSnap.exists()) {
                const initialData = prepareInitialProfileData(userId);
                initialData.noteUsageByMonth = {
                    [currentMonth]: { pdfAi: 0, youtube: 0, lastUpdated: Timestamp.now() }
                };
                (initialData.noteUsageByMonth[currentMonth] as any)[typeToIncrement] = 1;
                transaction.set(userProfileRef, initialData);
            } else {
                const currentData = profileSnap.data() as UserProfileData;
                let noteUsageByMonth = currentData.noteUsageByMonth || {};
                let noteUsageForMonth = noteUsageByMonth[currentMonth] || { pdfAi: 0, youtube: 0, lastUpdated: Timestamp.now() };

                noteUsageForMonth[typeToIncrement] = (noteUsageForMonth[typeToIncrement] || 0) + 1;
                noteUsageForMonth.lastUpdated = Timestamp.now();
                noteUsageByMonth[currentMonth] = noteUsageForMonth;
                transaction.update(userProfileRef, {
                    noteUsageByMonth: noteUsageByMonth,
                    updatedAt: serverTimestamp()
                });
            }
        });
    } catch (error) {
        console.error(`Error updating note usage for ${userId}:`, error);
        throw new Error(`Failed to update note usage.`);
    }
};

export const onUserProfileSnapshot = (userId: string, callback: (profile: UserProfileData | null) => void): (() => void) => {
  const profileRef = doc(db, 'users', userId, 'profile', 'data');
  return onSnapshot(profileRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as Partial<UserProfileData>;
      const defaultProfile = prepareInitialProfileData(userId, data.email, data.displayName, data.photoURL);
      callback({
        ...defaultProfile,
        ...data,
        id: docSnap.id,
        level: data.level || calculateLevel(data.points || 0),
        lastOverallStreakUpdate: toDateSafeForProfile(data.lastOverallStreakUpdate),
        lastNotesStreakUpdate: toDateSafeForProfile(data.lastNotesStreakUpdate),
        createdAt: toDateSafeForProfile(data.createdAt) || new Date(),
        updatedAt: toDateSafeForProfile(data.updatedAt) || new Date(),
        premiumAwardedUntil: toDateSafeForProfile(data.premiumAwardedUntil),
        activeTier: data.activeTier || defaultProfile.activeTier,
        notesStreakCount: data.notesStreakCount || 0,
        notesCreatedCount: data.notesCreatedCount || 0,
        pdfNotesCreatedCount: data.pdfNotesCreatedCount || 0,
        youtubeNotesCreatedCount: data.youtubeNotesCreatedCount || 0,
        aiNotesCreatedCount: data.aiNotesCreatedCount || 0,
        noteFlashcardsCreatedCount: data.noteFlashcardsCreatedCount || 0,
        noteChatsStartedCount: data.noteChatsStartedCount || 0,
      });
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error listening to user profile:", error);
    callback(null);
  });
};

export const updateUserPointsAndLevel = async (
    userId: string,
    pointsToAdd: number,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<{ newPoints: number, newLevel: number, newTier?: UserTier }> => {
  const profileRef = doc(db, 'users', userId, 'profile', 'data');

  return runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    let newTierAwarded: UserTier | undefined = undefined;

    if (!profileSnap.exists()) {
        const initialData = prepareInitialProfileData(
            userId,
            userDetailsForCreation?.email,
            userDetailsForCreation?.displayName,
            userDetailsForCreation?.photoURL
        );
        const newPoints = pointsToAdd;
        initialData.points = newPoints;
        initialData.level = calculateLevel(newPoints);
        transaction.set(profileRef, initialData);
        return { newPoints: initialData.points, newLevel: initialData.level, newTier: undefined };
    } else {
        const currentProfileData = profileSnap.data() as UserProfileData;
        const currentPoints = currentProfileData.points || 0;
        const newPoints = currentPoints + pointsToAdd;
        const newLevel = calculateLevel(newPoints);

        const updateData: any = {
            points: newPoints,
            level: newLevel,
            updatedAt: serverTimestamp(),
        };

        const currentTier = await getUserTier(userId, currentProfileData.email, currentProfileData);
        if ( (currentTier === 'basic' || currentTier === 'pro') &&
            (!currentProfileData.premiumAwardedUntil || toDateSafeForProfile(currentProfileData.premiumAwardedUntil)! < new Date()) &&
            newPoints >= POINTS_FOR_FREE_PREMIUM && currentPoints < POINTS_FOR_FREE_PREMIUM
        ) {
            const oneWeekFromNow = new Date();
            oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
            updateData.premiumAwardedUntil = Timestamp.fromDate(oneWeekFromNow);
            newTierAwarded = 'premium';
        }
        transaction.update(profileRef, updateData);
        return { newPoints, newLevel, newTier: newTierAwarded };
    }
  });
};

export const updateUserStreak = async (
    userId: string,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; },
    streakType: 'overall' | 'notes' = 'overall'
): Promise<{ newStreakCount: number, streakBroken: boolean }> => {
  const profileRef = doc(db, 'users', userId, 'profile', 'data');

  return runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);

    if (!profileSnap.exists()) {
        const initialData = prepareInitialProfileData(
            userId,
            userDetailsForCreation?.email,
            userDetailsForCreation?.displayName,
            userDetailsForCreation?.photoURL
        );
        const now = Timestamp.now();
        if (streakType === 'overall') {
            initialData.overallStreakCount = 1;
            initialData.lastOverallStreakUpdate = now;
        } else {
            initialData.notesStreakCount = 1;
            initialData.lastNotesStreakUpdate = now;
        }
        transaction.set(profileRef, initialData);
        return { newStreakCount: 1, streakBroken: false };
    } else {
        const currentProfileData = profileSnap.data() as UserProfileData;
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

        const lastUpdate = lastUpdateRaw ? toDateSafeForProfile(lastUpdateRaw) : null;
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
            transaction.update(profileRef, updateData);
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
  const profileRef = doc(db, 'users', userId, 'profile', 'data');
  await runTransaction(db, async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    if (!profileSnap.exists()) {
        const initialData = prepareInitialProfileData(
            userId,
            userDetailsForCreation?.email,
            userDetailsForCreation?.displayName,
            userDetailsForCreation?.photoURL,
        );
        initialData.badges = [badgeId];
        transaction.set(profileRef, initialData);
    } else {
        const currentProfileData = profileSnap.data() as UserProfileData;
        const badges = currentProfileData.badges || [];
        if (!badges.includes(badgeId)) {
            transaction.update(profileRef, {
                badges: arrayUnion(badgeId),
                updatedAt: serverTimestamp()
            });
        }
    }
  });
};

export const incrementUserProfileCounter = async (
    userId: string,
    counterField: keyof Pick<UserProfileData, 'notesCreatedCount' | 'pdfNotesCreatedCount' | 'youtubeNotesCreatedCount' | 'aiNotesCreatedCount' | 'noteFlashcardsCreatedCount' | 'noteChatsStartedCount'>,
    incrementValue: number = 1,
    userDetailsForCreation?: { email?: string | null; displayName?: string | null; photoURL?: string | null; }
): Promise<void> => {
    const profileRef = doc(db, 'users', userId, 'profile', 'data');
    await runTransaction(db, async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists()) {
            const initialData = prepareInitialProfileData(
                userId,
                userDetailsForCreation?.email,
                userDetailsForCreation?.displayName,
                userDetailsForCreation?.photoURL,
            );
            (initialData as any)[counterField] = incrementValue;
            transaction.set(profileRef, initialData);
        } else {
            transaction.update(profileRef, {
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

export const createUserProfileDocument = async (
    userId: string,
    email?: string | null,
    displayName?: string | null,
    photoURL?: string | null,
    transaction?: FirestoreTransaction
): Promise<UserProfileData> => {
  const profileRef = doc(db, 'users', userId, 'profile', 'data');
  const initialData = prepareInitialProfileData(userId, email, displayName, photoURL);

  if (transaction) {
    transaction.set(profileRef, initialData);
  } else {
    await setDoc(profileRef, initialData);
  }
  return {
      ...initialData,
      createdAt: (initialData.createdAt as Timestamp).toDate(),
      updatedAt: (initialData.updatedAt as Timestamp).toDate(),
      activeTier: initialData.activeTier,
  };
};

