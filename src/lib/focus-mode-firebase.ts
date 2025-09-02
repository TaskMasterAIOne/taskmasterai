
import { db, auth } from './firebase';
import {
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  increment,
  type DocumentData,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECONDS = 5 * 60;
const DEFAULT_LONG_BREAK_SECONDS = 15 * 60;
const DEFAULT_CYCLES_GOAL = 4;

const XP_PER_MINUTE_FOCUSED = 1;
const XP_BONUS_SESSION_COMPLETION = 50;
const XP_BONUS_GOAL_ACHIEVED = 25;

export interface FocusSessionData {
  id?: string;
  userId: string;
  status: 'idle' | 'running' | 'paused' | 'break_running' | 'break_paused' | 'completed' | 'cancelled';
  type: 'pomodoro' | 'custom_timer' | 'stopwatch';
  timerName?: string | null;
  pomodoroWorkSeconds?: number | null;
  pomodoroShortBreakSeconds?: number | null;
  pomodoroLongBreakSeconds?: number | null;
  pomodoroCyclesGoal?: number | null;
  currentCycle?: number | null;
  isLongBreakNext: boolean;
  plannedDurationSeconds?: number | null;
  startTime?: Timestamp | null;
  endTime?: Timestamp | null;
  pauseTime?: Timestamp | null;
  accumulatedFocusSeconds: number;
  accumulatedBreakSeconds: number;
  currentSegmentProgressSeconds: number;
  linkedItemId?: string | null;
  linkedItemCollection?: 'tasks' | 'goals' | 'projects' | 'plans' | null;
  linkedItemName?: string | null;
  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sessionGoalText?: string | null;
  sessionGoalAchieved?: boolean | null;
  preFocusCheckIn?: {
    mood?: 'good' | 'okay' | 'bad' | null;
    energyLevel?: number | null;
    customInput?: string | null;
  } | null;
  ambientSound?: {
    name: string;
    src: string;
    volume: number;
  } | null;
  postSessionFeedback?: {
    productivityRating?: number | null;
    reflection?: string | null;
  } | null;
  aiSuggestedWorkDuration?: number | null;
  aiSuggestedBreakDuration?: number | null;
  xpEarned?: number | null;
}

export interface UserStreakData {
    current: number;
    longest: number;
    lastFocusTimestamp: Timestamp | null;
}

// --- Pomodoro Settings for User ---
export interface UserPomodoroSettings {
  workSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  cyclesGoal: number;
  updatedAt?: Timestamp; // Optional for reading, will be set on save
}

export const getUserPomodoroSettings = async (userId: string): Promise<UserPomodoroSettings | null> => {
  if (!userId) {
    console.warn("getUserPomodoroSettings: No userId provided.");
    return null;
  }
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'pomodoro');
  try {
    const docSnap = await getDoc(settingsDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserPomodoroSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user Pomodoro settings:", error);
    return null;
  }
};

export const saveUserPomodoroSettings = async (userId: string, settings: Omit<UserPomodoroSettings, 'updatedAt'>): Promise<void> => {
  if (!userId) {
    console.warn("saveUserPomodoroSettings: No userId provided.");
    return;
  }
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'pomodoro');
  try {
    await setDoc(settingsDocRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true }); // merge:true ensures we don't overwrite other potential settings under /users/{uid}/settings
  } catch (error) {
    console.error("Error saving user Pomodoro settings:", error);
  }
};
// --- End Pomodoro Settings ---


interface CreatePomodoroSessionBase {
  timerName?: string;
  pomodoroWorkSeconds?: number;
  pomodoroShortBreakSeconds?: number;
  pomodoroLongBreakSeconds?: number;
  pomodoroCyclesGoal?: number;
  linkedItemId?: string | null;
  linkedItemName?: string | null;
  linkedItemCollection?: 'tasks' | 'goals' | 'projects' | 'plans' | null;
  notes?: string | null;
  startTime?: Timestamp | null;
  sessionGoalText?: string | null;
  preFocusCheckIn?: FocusSessionData['preFocusCheckIn'];
  ambientSound?: FocusSessionData['ambientSound'];
}
export interface CreatePomodoroSessionInput extends CreatePomodoroSessionBase {
  type: 'pomodoro';
  currentCycle?: number;
}

interface CreateCustomTimerSessionBase {
  timerName?: string;
  plannedDurationSeconds: number;
  linkedItemId?: string | null;
  linkedItemName?: string | null;
  linkedItemCollection?: 'tasks' | 'goals' | 'projects' | 'plans' | null;
  notes?: string | null;
  startTime?: Timestamp | null;
  sessionGoalText?: string | null;
  preFocusCheckIn?: FocusSessionData['preFocusCheckIn'];
  ambientSound?: FocusSessionData['ambientSound'];
}
export interface CreateCustomTimerSessionInput extends CreateCustomTimerSessionBase {
  type: 'custom_timer';
}

export type CreateFocusSessionInput = CreatePomodoroSessionInput | CreateCustomTimerSessionInput;


export const createFocusSession = async (userId: string, sessionInput: CreateFocusSessionInput): Promise<string> => {
  if (!userId) throw new Error('User ID is required to create a focus session.');

  const commonData: Omit<FocusSessionData, 'type' | 'pomodoroWorkSeconds' | 'pomodoroShortBreakSeconds' | 'pomodoroLongBreakSeconds' | 'pomodoroCyclesGoal' | 'currentCycle' | 'plannedDurationSeconds' | 'id' | 'sessionGoalAchieved' | 'xpEarned' | 'currentSegmentProgressSeconds'> = {
    userId,
    status: sessionInput.startTime ? 'running' : 'idle',
    accumulatedFocusSeconds: 0,
    accumulatedBreakSeconds: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    notes: sessionInput.notes || null,
    linkedItemId: sessionInput.linkedItemId || null,
    linkedItemCollection: sessionInput.linkedItemCollection || null,
    linkedItemName: sessionInput.linkedItemName || null,
    timerName: sessionInput.timerName || (sessionInput.type === 'pomodoro' ? 'Pomodoro' : 'Custom Timer'),
    startTime: sessionInput.startTime || null,
    endTime: null,
    pauseTime: null,
    isLongBreakNext: false,
    sessionGoalText: sessionInput.sessionGoalText || null,
    preFocusCheckIn: sessionInput.preFocusCheckIn || null,
    ambientSound: sessionInput.ambientSound || null,
    postSessionFeedback: null,
    aiSuggestedWorkDuration: null,
    aiSuggestedBreakDuration: null,
  };

  let specificData: Pick<FocusSessionData, 'type' | 'pomodoroWorkSeconds' | 'pomodoroShortBreakSeconds' | 'pomodoroLongBreakSeconds' | 'pomodoroCyclesGoal' | 'currentCycle' | 'plannedDurationSeconds'>;

  if (sessionInput.type === 'pomodoro') {
    // Fetch user settings for Pomodoro defaults if not provided in sessionInput
    const userSettings = await getUserPomodoroSettings(userId);

    specificData = {
      type: 'pomodoro',
      pomodoroWorkSeconds: sessionInput.pomodoroWorkSeconds ?? userSettings?.workSeconds ?? DEFAULT_WORK_SECONDS,
      pomodoroShortBreakSeconds: sessionInput.pomodoroShortBreakSeconds ?? userSettings?.shortBreakSeconds ?? DEFAULT_SHORT_BREAK_SECONDS,
      pomodoroLongBreakSeconds: sessionInput.pomodoroLongBreakSeconds ?? userSettings?.longBreakSeconds ?? DEFAULT_LONG_BREAK_SECONDS,
      pomodoroCyclesGoal: sessionInput.pomodoroCyclesGoal ?? userSettings?.cyclesGoal ?? DEFAULT_CYCLES_GOAL,
      currentCycle: sessionInput.currentCycle !== undefined ? sessionInput.currentCycle : 0,
      plannedDurationSeconds: null,
    };
  } else if (sessionInput.type === 'custom_timer') {
    // Ensure plannedDurationSeconds is valid for custom timer sessions
    if (sessionInput.plannedDurationSeconds === undefined || sessionInput.plannedDurationSeconds === null || typeof sessionInput.plannedDurationSeconds !== 'number' || sessionInput.plannedDurationSeconds <= 0) {
      throw new Error('Custom timer sessions require a valid plannedDurationSeconds (must be a positive number)');
    }
    
    specificData = {
      type: 'custom_timer',
      plannedDurationSeconds: sessionInput.plannedDurationSeconds,
      pomodoroWorkSeconds: null,
      pomodoroShortBreakSeconds: null,
      pomodoroLongBreakSeconds: null,
      pomodoroCyclesGoal: null,
      currentCycle: null,
    };
  } else {
    const exhaustiveCheck: never = sessionInput;
    throw new Error(`Unsupported session type: ${exhaustiveCheck}`);
  }

  const fullSessionData: FocusSessionData = {
    ...commonData,
    ...specificData,
    currentSegmentProgressSeconds: 0,
    sessionGoalAchieved: null,
    xpEarned: 0,
  };

  const docRef = await addDoc(collection(db, 'focusSessions'), fullSessionData);
  return docRef.id;
};

export const updateFocusSession = async (sessionId: string, updates: Partial<FocusSessionData>): Promise<void> => {
  if (!sessionId) throw new Error('Session ID is required to update a focus session.');

  const sanitizedUpdates: { [key: string]: any } = {};
  for (const key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      const typedKey = key as keyof FocusSessionData;
      if (updates[typedKey] !== undefined) {
        sanitizedUpdates[typedKey] = updates[typedKey];
      } else {
        sanitizedUpdates[typedKey] = null;
      }
    }
  }

  const sessionRef = doc(db, 'focusSessions', sessionId);

  try {
    await updateDoc(sessionRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    // If the document doesn't exist or there's a precondition failure, try to create it
    if (error?.code === 'not-found' || error?.code === 'failed-precondition') {
      console.warn(`Session ${sessionId} not found or precondition failed, attempting to recreate:`, error);

      // Try to get the document first to see if it exists
      const docSnap = await getDoc(sessionRef);
      if (!docSnap.exists()) {
        throw new Error(`Session ${sessionId} does not exist and cannot be updated.`);
      }

      // If it exists but update failed, try again with setDoc and merge
      await setDoc(sessionRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      // Re-throw other errors
      throw error;
    }
  }
};

export const deleteFocusSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) throw new Error('Session ID is required to delete a focus session.');
  await deleteDoc(doc(db, 'focusSessions', sessionId));
};

export const onUserFocusSessionsSnapshot = (
  userId: string,
  callback: (sessions: FocusSessionData[]) => void,
  options: { count?: number; includeCompleted?: boolean; includeCancelled?: boolean } = { count: 20, includeCompleted: true, includeCancelled: true }
): (() => void) => {
  if (!userId) return () => {};

  let qConstraints: any[] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  ];

  if (options.includeCompleted === false) {
    qConstraints.push(where('status', '!=', 'completed'));
  }
  if (options.includeCancelled === false) {
    qConstraints.push(where('status', '!=', 'cancelled'));
  }
  if (options.count) {
    qConstraints.push(limit(options.count));
  }

  const q = query(collection(db, 'focusSessions'), ...qConstraints);

  return onSnapshot(q, (snapshot) => {
    const sessions: FocusSessionData[] = [];
    snapshot.forEach((docSnap) => {
      sessions.push({ id: docSnap.id, ...docSnap.data() } as FocusSessionData);
    });
    callback(sessions);
  }, (error) => {
    console.error("Error listening to focus sessions:", error);
    callback([]);
  });
};

export const getAllUserProductivityItems = async (userId: string): Promise<Array<{ id: string; name: string; type: string; collection: 'tasks'|'goals'|'projects'|'plans' }>> => {
  if (!userId) return [];
  const items: Array<{ id: string; name: string; type: string; collection: 'tasks'|'goals'|'projects'|'plans' }> = [];
  const collectionsToFetch: Array<{ name: 'tasks'|'goals'|'projects'|'plans'; field: string }> = [
    { name: 'tasks', field: 'task' },
    { name: 'goals', field: 'goal' },
    { name: 'projects', field: 'project' },
    { name: 'plans', field: 'plan' },
  ];

  for (const collInfo of collectionsToFetch) {
    try {
        const q = query(collection(db, collInfo.name), where('userId', '==', userId), where('completed', '==', false));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
        const data = docSnap.data();
        items.push({
            id: docSnap.id,
            name: data[collInfo.field] || data.name || `Untitled ${collInfo.field}`,
            type: collInfo.field.charAt(0).toUpperCase() + collInfo.field.slice(1),
            collection: collInfo.name
        });
        });
    } catch (e) {
        console.warn(`Could not fetch ${collInfo.name} or 'completed' field missing:`, e);
         const qFallback = query(collection(db, collInfo.name), where('userId', '==', userId));
         const snapshotFallback = await getDocs(qFallback);
         snapshotFallback.forEach(docSnap => {
             const data = docSnap.data();
             if(data.completed === undefined || data.completed === false) {
                 items.push({
                     id: docSnap.id,
                     name: data[collInfo.field] || data.name || `Untitled ${collInfo.field}`,
                     type: collInfo.field.charAt(0).toUpperCase() + collInfo.field.slice(1),
                     collection: collInfo.name
                 });
             }
         });
    }
  }
  return items.sort((a,b) => a.name.localeCompare(b.name));
};

export const addNoteToFocusSession = async (sessionId: string, note: string | null) => {
  if (!sessionId) throw new Error("Session ID is required.");
  const sessionRef = doc(db, "focusSessions", sessionId);
  await updateDoc(sessionRef, {
    notes: note,
    updatedAt: serverTimestamp(),
  });
};

export const calculateXpForSession = (session: FocusSessionData): number => {
    let xp = 0;
    if (session.status === 'completed' || (session.status === 'cancelled' && (session.accumulatedFocusSeconds || 0) > 60) ) {
        const minutesFocused = Math.floor((session.accumulatedFocusSeconds || 0) / 60);
        xp += minutesFocused * XP_PER_MINUTE_FOCUSED;
        if (session.status === 'completed') {
            xp += XP_BONUS_SESSION_COMPLETION;
        }
        if (session.sessionGoalAchieved) {
            xp += XP_BONUS_GOAL_ACHIEVED;
        }
    }
    return Math.max(0, xp);
};

export const updateUserTotalXp = async (userId: string, xpToAdd: number) => {
    if (!userId || xpToAdd <= 0) return;
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const userProfileRef = doc(db, 'users', userId);
            
            // Always use setDoc with merge to avoid race conditions
            await setDoc(userProfileRef, { 
                totalXp: increment(xpToAdd),
                lastXpEarnedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            // If we get here, the operation succeeded
            break;
            
        } catch (error: any) {
            retryCount++;
            console.warn(`XP update attempt ${retryCount} failed:`, error);
            
            if (retryCount >= maxRetries) {
                console.error("Max retries reached for XP update:", error);
                break;
            }
            
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
    }
};

const datesAreOnSameDay = (first: Date, second: Date) =>
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();

const datesAreOnConsecutiveDays = (first: Date, second: Date) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDateNormalized = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    const secondDateNormalized = new Date(second.getFullYear(), second.getMonth(), second.getDate());
    return Math.round(Math.abs((firstDateNormalized.getTime() - secondDateNormalized.getTime()) / oneDay)) === 1;
};

export const updateUserStreakOnSessionCompletion = async (userId: string, sessionCompletedAt: Timestamp) => {
    if (!userId) return;
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const userProfileRef = doc(db, 'users', userId);
            const today = sessionCompletedAt.toDate();

            // Always use setDoc with merge to avoid race conditions
            const docSnap = await getDoc(userProfileRef);
            let currentStreakData: UserStreakData = { current: 0, longest: 0, lastFocusTimestamp: null };

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.streaks) {
                    currentStreakData = data.streaks as UserStreakData;
                }
            }

            let newCurrentStreak = currentStreakData.current;
            let newLongestStreak = currentStreakData.longest;

            if (currentStreakData.lastFocusTimestamp) {
                const lastFocusDay = currentStreakData.lastFocusTimestamp.toDate();
                if (!datesAreOnSameDay(lastFocusDay, today)) {
                    if (datesAreOnConsecutiveDays(lastFocusDay, today)) {
                        newCurrentStreak += 1;
                    } else {
                        newCurrentStreak = 1;
                    }
                }
            } else {
                newCurrentStreak = 1;
            }

            if (newCurrentStreak > newLongestStreak) {
                newLongestStreak = newCurrentStreak;
            }

            const updatedStreakData: UserStreakData = {
                current: newCurrentStreak,
                longest: newLongestStreak,
                lastFocusTimestamp: sessionCompletedAt,
            };

            // Always use setDoc with merge to avoid race conditions
            await setDoc(userProfileRef, { 
                streaks: updatedStreakData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            // If we get here, the operation succeeded
            break;
            
        } catch (error: any) {
            retryCount++;
            console.warn(`Streak update attempt ${retryCount} failed:`, error);
            
            if (retryCount >= maxRetries) {
                console.error("Max retries reached for streak update:", error);
                break;
            }
            
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
    }
};


export const savePostSessionFeedback = async (
    sessionId: string,
    feedback: FocusSessionData['postSessionFeedback'],
    sessionGoalAchieved: boolean | null,
    userId: string
) => {
    if (!sessionId) throw new Error("Session ID is required.");

    const sessionRef = doc(db, "focusSessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);

    let sessionData: FocusSessionData | null = null;
    if (sessionSnap.exists()) {
        sessionData = { id: sessionSnap.id, ...sessionSnap.data() } as FocusSessionData;
    }

    if (!sessionData) {
        console.error("Could not retrieve session data to calculate XP and update streak.");
        await updateFocusSession(sessionId, { postSessionFeedback: feedback, sessionGoalAchieved });
        return;
    }

    const updatedSessionForXpCalc = { ...sessionData, postSessionFeedback: feedback, sessionGoalAchieved, status: 'completed' as 'completed'};
    const xpEarned = calculateXpForSession(updatedSessionForXpCalc);

    await updateFocusSession(sessionId, {
        postSessionFeedback: feedback,
        sessionGoalAchieved: sessionGoalAchieved,
        xpEarned: xpEarned,
        status: 'completed',
        endTime: Timestamp.now(),
    });

    if (xpEarned > 0 && userId) {
        await updateUserTotalXp(userId, xpEarned);
    }

    if (sessionData.status === 'completed' || updatedSessionForXpCalc.status === 'completed') {
        await updateUserStreakOnSessionCompletion(userId, Timestamp.now());
    }
};


export const updateSessionAmbientSound = async (sessionId: string, sound: FocusSessionData['ambientSound']) => {
    if (!sessionId) throw new Error("Session ID is required.");
    await updateFocusSession(sessionId, { ambientSound: sound });
};

export const onUserTotalXpSnapshot = (userId: string, callback: (xp: number) => void): (() => void) => {
    if (!userId) return () => {};
    const userProfileRef = doc(db, 'users', userId);
    return onSnapshot(userProfileRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data().totalXp || 0);
        } else {
            callback(0);
        }
    }, (error) => {
        console.error("Error listening to total XP:", error);
        callback(0);
    });
};

export const onUserStreakDataSnapshot = (userId: string, callback: (streakData: UserStreakData | null) => void): (() => void) => {
    if (!userId) return () => {};
    const userProfileRef = doc(db, 'users', userId);
    return onSnapshot(userProfileRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().streaks) {
            callback(docSnap.data().streaks as UserStreakData);
        } else {
            callback({ current: 0, longest: 0, lastFocusTimestamp: null });
        }
    }, (error) => {
        console.error("Error listening to user streak data:", error);
        callback(null);
    });
};
