// src/lib/dashboard-firebase.ts

import { auth, db } from "./firebase"
import { getFunctions, httpsCallable } from "firebase/functions";
import { type User, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { prepareInitialProfileData } from "./current-paying-user"

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentData,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore"


// Define EventData interface
export interface EventData {
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  description?: string;
  linkedTaskIds?: string[];
  linkedGoalIds?: string[];
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  color?: string;
}

// --- NEWLY ADDED CODE FOR SMART DAILY BRIEF ---

export interface DailyBriefStatus {
    count: number;
    lastRefreshDate: string; // YYYY-MM-DD format
}

/**
 * Fetches the user's daily brief refresh status from Firestore.
 * If the last refresh was not today, it automatically returns a reset count.
 */
export async function getDailyBriefRefreshStatus(userId: string): Promise<DailyBriefStatus> {
    if (!userId) return { count: 0, lastRefreshDate: '' };
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const todayStr = new Date().toISOString().split('T')[0];
            
            // If the last refresh date stored in the DB is not today, the count is effectively 0 for today.
            if (data.dailyBriefStatus?.lastRefreshDate !== todayStr) {
                return { count: 0, lastRefreshDate: todayStr };
            }
            return data.dailyBriefStatus || { count: 0, lastRefreshDate: '' };
        }
        // If no document or status exists, return a fresh start.
        return { count: 0, lastRefreshDate: '' };
    } catch (error) {
        console.error("Error fetching daily brief status:", error);
        // Return a default, non-blocking value on error to avoid breaking the UI.
        return { count: 0, lastRefreshDate: '' };
    }
}

/**
 * Updates the user's daily brief refresh count in Firestore for the current day.
 */
export async function updateDailyBriefRefreshStatus(userId: string, newCount: number): Promise<void> {
    if (!userId) return;
    try {
        const userRef = doc(db, "users", userId);
        const todayStr = new Date().toISOString().split('T')[0];
        // Use setDoc with merge to create or update the dailyBriefStatus object safely.
        await setDoc(userRef, {
            dailyBriefStatus: {
                count: newCount,
                lastRefreshDate: todayStr
            }
        }, { merge: true });
    } catch (error) {
        console.error("Could not update daily brief status in Firestore:", error);
    }
}

// --- END OF NEWLY ADDED CODE ---

export async function getUserData(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
}

export const updateDashboardLastSeen = async (userId: string) => {
    if (!userId) return;
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const userRef = doc(db, "users", userId);
            
            // Always use setDoc with merge to avoid race conditions
            await setDoc(userRef, {
                dashboardLastSeen: Timestamp.now(),
                updatedAt: serverTimestamp()
            }, { merge: true });
            
            // If we get here, the operation succeeded
            break;
            
        } catch (error: any) {
            retryCount++;
            console.warn(`Dashboard last seen update attempt ${retryCount} failed:`, error);
            
            if (retryCount >= maxRetries) {
                console.warn("Max retries reached for dashboardLastSeen update:", error);
                break;
            }
            
            // Wait a bit before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
    }
};

export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user)
  })
}

export async function signUp(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  const user = userCredential.user
  const initialData = prepareInitialProfileData(user.uid, user.email, user.displayName, user.photoURL);
  
  await setDoc(doc(db, "users", user.uid), {
    ...initialData,
    splashScreenShown: false,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserDisplayName(newDisplayName: string) {
  if (!auth.currentUser) return
  await updateProfile(auth.currentUser, { displayName: newDisplayName })
  // Use setDoc with merge to handle race conditions gracefully
  await setDoc(doc(db, "users", auth.currentUser.uid), {
    displayName: newDisplayName,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function setUserOnline(userId: string) {
  await setDoc(
    doc(db, "users", userId),
    {
      online: true,
      lastSeen: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function handleVisibilityChange(userId: string, excludedPages: string[] = []) {
  if (document.visibilityState === "visible") {
    await setUserOnline(userId)
  }
}

export async function addCustomTimer(name: string, timeInSeconds: number, userId: string, ambientSoundId?: string) {
  // Validate inputs
  if (!name || !name.trim()) {
    throw new Error('Timer name is required');
  }
  if (typeof timeInSeconds !== 'number' || timeInSeconds <= 0 || isNaN(timeInSeconds)) {
    throw new Error('Time must be a positive number');
  }
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const docRef = await addDoc(collection(db, "customTimers"), {
    name: name.trim(),
    time: timeInSeconds,
    userId,
    ambientSoundId: ambientSoundId || 'none',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export async function updateCustomTimer(timerId: string, newName?: string, newTimeInSeconds?: number, newAmbientSoundId?: string) {
  if (!timerId) {
    throw new Error('Timer ID is required');
  }
  
  const updates: any = { updatedAt: serverTimestamp() }
  if (newName !== undefined) {
    if (!newName || !newName.trim()) {
      throw new Error('Timer name cannot be empty');
    }
    updates.name = newName.trim()
  }
  if (newTimeInSeconds !== undefined) {
    if (typeof newTimeInSeconds !== 'number' || newTimeInSeconds <= 0 || isNaN(newTimeInSeconds)) {
      throw new Error('Time must be a positive number');
    }
    updates.time = newTimeInSeconds
  }
  if (newAmbientSoundId !== undefined) {
    updates.ambientSoundId = newAmbientSoundId
  }
  await updateDoc(doc(db, "customTimers", timerId), updates)
}

export async function deleteCustomTimer(timerId: string) {
  await deleteDoc(doc(db, "customTimers", timerId))
}

export function onCustomTimersSnapshot(
  userId: string,
  callback: (timers: Array<{ id: string; data: DocumentData }>) => void,
): () => void {
  if (!userId) {
      console.warn(`No user ID provided for customTimers listener.`);
      return () => {};
  }
  const q = query(collection(db, "customTimers"), where("userId", "==", userId), orderBy("createdAt", "asc"));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const results: Array<{ id: string; data: DocumentData }> = []
      snapshot.forEach((docSnap) => {
        results.push({ id: docSnap.id, data: docSnap.data() })
      })
      callback(results)
    },
    (error) => {
      console.error("Error listening to custom timers:", error)
      callback([]);
    },
  );
  return unsubscribe;
}

export async function createTask(userId: string, taskText: string, dueDate?: Date | null, priority: 'high' | 'medium' | 'low' = 'medium', sectionId?: string | null) {
  if (!userId || !taskText) throw new Error("User ID and task text are required.");
  await addDoc(collection(db, "tasks"), {
    task: taskText.trim(),
    userId,
    dueDate: dueDate instanceof Date ? Timestamp.fromDate(dueDate) : null,
    priority,
    createdAt: serverTimestamp(),
    sectionId: sectionId || null,
    completed: false,
  })
}

export async function createGoal(userId: string, goalText: string, targetDate?: Date | null, priority: 'high' | 'medium' | 'low' = 'medium') {
   if (!userId || !goalText) throw new Error("User ID and goal text are required.");
  await addDoc(collection(db, "goals"), {
    goal: goalText.trim(),
    userId,
    targetDate: targetDate instanceof Date ? Timestamp.fromDate(targetDate) : null, // Use targetDate field
    priority,
    createdAt: serverTimestamp(),
    completed: false,
  })
}

export async function createEvent(userId: string, eventDetails: { name: string; startDate: Date; endDate: Date; description?: string; color?: string; linkedTaskIds?: string[]; linkedGoalIds?: string[] }) {
  if (!userId || !eventDetails.name || !eventDetails.startDate || !eventDetails.endDate) {
    throw new Error("User ID, event name, start date, and end date are required.");
  }
  if (eventDetails.startDate >= eventDetails.endDate) {
    throw new Error("End date must be after start date.");
  }
  await addDoc(collection(db, "events"), {
    userId,
    name: eventDetails.name.trim(),
    startDate: Timestamp.fromDate(eventDetails.startDate),
    endDate: Timestamp.fromDate(eventDetails.endDate),
    description: eventDetails.description?.trim() || "",
    color: eventDetails.color || '#3B82F6', // Default blue e.g.
    linkedTaskIds: eventDetails.linkedTaskIds || [],
    linkedGoalIds: eventDetails.linkedGoalIds || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}


export async function markItemComplete(collectionName: 'tasks' | 'goals', docId: string) {
    if (!docId || !collectionName) throw new Error("Collection name and item ID required.");
    const itemRef = doc(db, collectionName, docId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error("Item not found.");
    const currentStatus = itemSnap.data().completed || false;
    await updateItem(collectionName, docId, { completed: !currentStatus });
}

export async function updateItem(collectionName: 'tasks' | 'goals' | 'customTimers' | 'events', itemId: string, updates: any) {
    if (!itemId || !collectionName) throw new Error("Collection name and item ID required.");
    if ('userId' in updates || 'createdAt' in updates) { throw new Error("Cannot update userId or createdAt fields."); }
    
    const itemRef = doc(db, collectionName, itemId);

    // Convert Date objects to Timestamps for specified fields
    const dateFieldsToConvert = ['dueDate', 'targetDate', 'startDate', 'endDate', 'recurrenceEndDate'];
    dateFieldsToConvert.forEach(field => {
        if (field in updates) {
            if (updates[field] instanceof Date && !isNaN(updates[field].getTime())) {
                updates[field] = Timestamp.fromDate(updates[field]);
            } else if (updates[field] === null || updates[field] === undefined || (typeof updates[field] === 'string' && updates[field].trim() === '')) {
                // If the UI sends null, undefined, or an empty string for a date, store it as null in Firestore
                updates[field] = null;
            } else if (!(updates[field] instanceof Timestamp)) {
                // If it's not a Date, not null/undefined/empty, and not already a Timestamp, it's an invalid date format for update.
                // It's safer to remove it or handle it as an error, rather than letting Firestore potentially fail.
                console.warn(`Invalid date value provided for ${field} in update for item ${itemId}. Value: `, updates[field], `Type: ${typeof updates[field]}. Field removed from update.`);
                delete updates[field];
            }
        }
    });
    
    updates.updatedAt = serverTimestamp();
    await updateDoc(itemRef, updates);
}

export async function deleteItem(collectionName: 'tasks' | 'goals' | 'customTimers' | 'events', itemId: string) {
     if (!itemId || !collectionName) throw new Error("Collection name and item ID required.");
    await deleteDoc(doc(db, collectionName, itemId));
}

export function onCollectionSnapshot(
  collectionName: 'tasks' | 'goals' | 'events',
  userId: string,
  callback: (items: Array<{ id: string; data: DocumentData }>) => void,
): (() => void) {
   if (!userId) return () => {};
  const q = query(
    collection(db, collectionName),
    where("userId", "==", userId),
    orderBy(collectionName === 'events' ? 'startDate' : "createdAt", collectionName === 'events' ? 'asc' : "desc"),
  )
  return onSnapshot(q, (snapshot) => {
    const results: Array<{ id: string; data: DocumentData }> = []
    snapshot.forEach((docSnap) => {
      results.push({ id: docSnap.id, data: docSnap.data() })
    })
    callback(results)
  }, (error) => {
      console.error(`Error listening to ${collectionName}:`, error);
      callback([]);
  })
}

export async function findItemByName(
    collectionName: 'tasks' | 'goals' | 'events',
    userId: string,
    itemName: string,
    fieldName: 'task' | 'goal' | 'name'
): Promise<string | null> {
    if (!userId || !itemName) return null;
    try {
        const q = query(
            collection(db, collectionName),
            where("userId", "==", userId),
            where(fieldName, "==", itemName)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            // Return the first match. You might want to handle multiple matches if they can exist.
            return querySnapshot.docs[0].id;
        }
        return null;
    } catch (error) {
        console.error(`Error finding ${fieldName} by name:`, error);
        return null;
    }
}

// Cache for user preferences
const preferencesCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// User Preferences Functions
export async function saveUserPreferences(preferences: { hideBrief?: boolean; hideQuickSuggestions?: boolean }) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("User not authenticated");
        
        const userDocRef = doc(db, 'users', user.uid);
        
        // Use setDoc with merge to create document if it doesn't exist
        await setDoc(userDocRef, {
            ...preferences,
            updatedAt: serverTimestamp()
        }, { merge: true });
        
        // Update cache immediately
        const cached = preferencesCache.get(user.uid);
        if (cached) {
            preferencesCache.set(user.uid, {
                data: { ...cached.data, ...preferences },
                timestamp: Date.now()
            });
        }
        

    } catch (error) {
        console.error("Error saving user preferences:", error);
        throw error;
    }
}

export async function getUserPreferences() {
    try {
        const user = auth.currentUser;
        if (!user) {

            return { hideBrief: false, hideQuickSuggestions: false };
        }
        
        // Check cache first
        const cached = preferencesCache.get(user.uid);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {

            return {
                hideBrief: cached.data.hideBrief || false,
                hideQuickSuggestions: cached.data.hideQuickSuggestions || false
            };
        }
        

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        let preferences = { hideBrief: false, hideQuickSuggestions: false };
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            preferences = {
                hideBrief: data.hideBrief || false,
                hideQuickSuggestions: data.hideQuickSuggestions || false
            };

        } else {

        }
        
        // Cache the result
        preferencesCache.set(user.uid, {
            data: { hideBrief: preferences.hideBrief, hideQuickSuggestions: preferences.hideQuickSuggestions },
            timestamp: Date.now()
        });
        
        return preferences;
    } catch (error) {
        console.error("Error getting user preferences:", error);
        return { hideBrief: false, hideQuickSuggestions: false };
    }
}

// Real-time listener for user preferences
export function subscribeToUserPreferences(
    callback: (preferences: { hideBrief: boolean; hideQuickSuggestions: boolean }) => void
): Unsubscribe | null {
    try {
        const user = auth.currentUser;
        if (!user) {

            return null;
        }
        
        const userDocRef = doc(db, 'users', user.uid);
        
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const preferences = {
                    hideBrief: data.hideBrief || false,
                    hideQuickSuggestions: data.hideQuickSuggestions || false
                };
                
                // Update cache immediately
                preferencesCache.set(user.uid, {
                    data: preferences,
                    timestamp: Date.now()
                });
                

                callback(preferences);
            } else {

                const defaultPreferences = { hideBrief: false, hideQuickSuggestions: false };
                callback(defaultPreferences);
            }
        }, (error) => {
            console.error("Error in preferences subscription:", error);
        });
        
        return unsubscribe;
    } catch (error) {
        console.error("Error setting up preferences subscription:", error);
        return null;
    }
}
