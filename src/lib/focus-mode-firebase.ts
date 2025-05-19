
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
  increment, // For XP
  type DocumentData,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';

export { hfApiKey, geminiApiKey } from './dashboard-firebase';

const DEFAULT_WORK_SECONDS = 25 * 60;
const DEFAULT_SHORT_BREAK_SECONDS = 5 * 60;
const DEFAULT_LONG_BREAK_SECONDS = 15 * 60;
const DEFAULT_CYCLES_GOAL = 4;

// XP Calculation Constants (example values)
const XP_PER_MINUTE_FOCUSED = 1; // 1 XP per minute of focused work
const XP_BONUS_SESSION_COMPLETION = 50; // Bonus for completing a session (not just cancelled)
const XP_BONUS_GOAL_ACHIEVED = 25; // Bonus for achieving session goal

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

  linkedItemId?: string | null;
  linkedItemCollection?: 'tasks' | 'goals' | 'projects' | 'plans' | null;
  linkedItemName?: string | null;

  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  sessionGoalText?: string | null;
  sessionGoalAchieved?: boolean | null; // New: Track if goal was met
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
  xpEarned?: number | null; // New: XP for this session
}

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

  const commonData: Omit<FocusSessionData, 'type' | 'pomodoroWorkSeconds' | 'pomodoroShortBreakSeconds' | 'pomodoroLongBreakSeconds' | 'pomodoroCyclesGoal' | 'currentCycle' | 'plannedDurationSeconds' | 'id' | 'sessionGoalAchieved' | 'xpEarned'> = {
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
    specificData = {
      type: 'pomodoro',
      pomodoroWorkSeconds: sessionInput.pomodoroWorkSeconds || DEFAULT_WORK_SECONDS,
      pomodoroShortBreakSeconds: sessionInput.pomodoroShortBreakSeconds || DEFAULT_SHORT_BREAK_SECONDS,
      pomodoroLongBreakSeconds: sessionInput.pomodoroLongBreakSeconds || DEFAULT_LONG_BREAK_SECONDS,
      pomodoroCyclesGoal: sessionInput.pomodoroCyclesGoal || DEFAULT_CYCLES_GOAL,
      currentCycle: 1,
      plannedDurationSeconds: null,
    };
  } else if (sessionInput.type === 'custom_timer') {
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
  
  const fullSessionData = { 
    ...commonData, 
    ...specificData,
    sessionGoalAchieved: null, // Initialize
    xpEarned: 0, // Initialize XP
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
  await updateDoc(sessionRef, {
    ...sanitizedUpdates,
    updatedAt: serverTimestamp(),
  });
};

// ... (deleteFocusSession, onUserFocusSessionsSnapshot, getAllUserProductivityItems, addNoteToFocusSession remain largely the same) ...
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

  let qConstraints = [
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
    const q = query(collection(db, collInfo.name), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.completed) { 
        items.push({
          id: docSnap.id,
          name: data[collInfo.field] || `Untitled ${collInfo.field}`,
          type: collInfo.field.charAt(0).toUpperCase() + collInfo.field.slice(1),
          collection: collInfo.name
        });
      }
    });
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

// Function to calculate XP (simple version)
export const calculateXpForSession = (session: FocusSessionData): number => {
    let xp = 0;
    if (session.status === 'completed' || (session.status === 'cancelled' && (session.accumulatedFocusSeconds || 0) > 0) ) {
        const minutesFocused = Math.floor((session.accumulatedFocusSeconds || 0) / 60);
        xp += minutesFocused * XP_PER_MINUTE_FOCUSED;
        if (session.status === 'completed') {
            xp += XP_BONUS_SESSION_COMPLETION;
        }
        if (session.sessionGoalAchieved) {
            xp += XP_BONUS_GOAL_ACHIEVED;
        }
    }
    return Math.max(0, xp); // Ensure XP is not negative
};

// Function to update user's total XP (conceptual - user document structure assumed)
export const updateUserTotalXp = async (userId: string, xpToAdd: number) => {
    if (!userId || xpToAdd === 0) return;
    const userProfileRef = doc(db, 'users', userId); // Assumes 'users' collection for profiles
    try {
        await updateDoc(userProfileRef, {
            totalXp: increment(xpToAdd),
            lastXpEarnedAt: serverTimestamp(),
        });
    } catch (error) {
        // If user profile doc doesn't exist, create it with totalXp (or handle error)
        // This is a common pattern if user profiles are created on demand.
        console.warn("Failed to update totalXp, user profile might not exist or other error:", error);
        // Optionally, try to set the document if it doesn't exist.
        // await setDoc(userProfileRef, { totalXp: xpToAdd, createdAt: serverTimestamp() }, { merge: true });
    }
};

export const savePostSessionFeedback = async (
    sessionId: string, 
    feedback: FocusSessionData['postSessionFeedback'], 
    sessionGoalAchieved: boolean | null,
    userId: string // Needed to update total XP
) => {
    if (!sessionId) throw new Error("Session ID is required.");
    
    // First, get the session to calculate XP based on its final state
    const sessionRef = doc(db, "focusSessions", sessionId);
    const sessionSnap = await getDocs(query(collection(db, "focusSessions"), where("__name__", "==", sessionId), limit(1)));

    let sessionData: FocusSessionData | null = null;
    if (!sessionSnap.empty) {
        sessionData = { id: sessionSnap.docs[0].id, ...sessionSnap.docs[0].data() } as FocusSessionData;
    }

    if (!sessionData) {
        console.error("Could not retrieve session data to calculate XP.");
        // Proceed to update feedback without XP if session data is missing
        await updateFocusSession(sessionId, { postSessionFeedback: feedback, sessionGoalAchieved });
        return;
    }
    
    // Update session with feedback and goal achievement status
    const updatedSessionForXpCalc = { ...sessionData, postSessionFeedback: feedback, sessionGoalAchieved };
    const xpEarned = calculateXpForSession(updatedSessionForXpCalc);

    await updateFocusSession(sessionId, { 
        postSessionFeedback: feedback, 
        sessionGoalAchieved: sessionGoalAchieved,
        xpEarned: xpEarned 
    });

    if (xpEarned > 0 && userId) {
        await updateUserTotalXp(userId, xpEarned);
    }
};


export const updateSessionAmbientSound = async (sessionId: string, sound: FocusSessionData['ambientSound']) => {
    if (!sessionId) throw new Error("Session ID is required.");
    await updateFocusSession(sessionId, { ambientSound: sound });
};

// Placeholder for fetching total XP - in a real app, this would be part of user profile listener
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
