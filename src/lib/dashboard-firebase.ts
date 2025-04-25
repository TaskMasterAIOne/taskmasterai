/* ------------------------------------------------------------------
   dashboard-firebase.ts
   - Handles Firestore interactions for dashboard items (tasks, goals, etc.),
     custom timers, sections, and user metadata like last seen.
   - Tier/Usage logic is primarily handled in 'current-paying-user.ts',
     but some related types/constants might remain here for broader use.
   ------------------------------------------------------------------ */

// 1. IMPORT YOUR ALREADY-INITIALIZED APP & SERVICES FROM `firebase.ts`
import { auth, db } from "./firebase"

// --- API Keys (Keep as they might be used elsewhere) ---
export const weatherApiKey = "e3f77d4d29e24862b4f190231241611"
export const hfApiKey = "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"
export const geminiApiKey = "AIzaSyAfWn25V7MGf1OmtlWyGRNbpczsIYe-XxQ" // Replace with your actual key if needed

import { type User, onAuthStateChanged, createUserWithEmailAndPassword, updateProfile } from "firebase/auth"

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp, // Keep Timestamp import
  query,
  where,
  orderBy,
  onSnapshot,
  type DocumentData,
  getDocs,
} from "firebase/firestore"

// --- Tier Definitions & Limits (Kept here for now, ideally move completely to current-paying-user.ts) ---
const PREMIUM_EMAILS = [
    "robinmyh@gmail.com",
    "oliverbeckett069420@gmail.com",
    "bajinsrinivasr@lexington1.net"
];
export const PRO_EMAILS = ["srinibaj10@gmail.com"];
export type UserTier = 'basic' | 'pro' | 'premium' | 'loading';

export const BASIC_CHAT_LIMIT = 10;
export const PRO_CHAT_LIMIT = 200;

// Define item types/collection names used
export type ItemType = 'tasks' | 'goals' | 'projects' | 'plans';
export type CollectionName = ItemType | 'customTimers' | 'sections' | 'users';


/* ------------------------------------------------------------------
   2. USER DATA & AUTH
   ------------------------------------------------------------------ */

// --- REMOVED getUserTier - Moved to current-paying-user.ts ---

// --- REMOVED getUserUsageData - Moved to current-paying-user.ts ---

// --- REMOVED updateUserChatUsage - Moved to current-paying-user.ts ---


/** Fetches general user data (like name preference) from Firestore. */
export async function getUserData(userId: string): Promise<any | null> {
    if (!userId) return null;
    try {
        const userRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching user data:", error);
        return null; // Return null on error to avoid breaking UI
    }
}

/** Updates the user's last seen timestamp for the dashboard. */
export const updateDashboardLastSeen = async (userId: string) => {
    if (!userId) return;
    try {
        const userRef = doc(db, "users", userId);
        // Use setDoc with merge:true to ensure it works even if doc doesn't exist yet
        await setDoc(userRef, {
            dashboardLastSeen: Timestamp.now() // Use Firestore Timestamp
        }, { merge: true });
    } catch (error) {
        console.warn("Could not update dashboardLastSeen:", error);
    }
};

/** Sets up a listener for Firebase Auth state changes. */
export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    callback(user)
  })
}

/** Signs up a new user and creates initial user document. */
export async function signUp(email: string, password: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  const user = userCredential.user
  // Create basic user doc, can be expanded later
  await setDoc(doc(db, "users", user.uid), {
    email: user.email, // Store email
    createdAt: serverTimestamp(),
    // Add other initial fields if needed, e.g., name: user.email?.split('@')[0]
  })
}

/** Updates the user's display name in Auth and Firestore user doc. */
export async function updateUserDisplayName(newDisplayName: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User not authenticated.");
  try {
    // Update Auth profile
    await updateProfile(currentUser, { displayName: newDisplayName });
    // Update Firestore user document
    await setDoc(doc(db, "users", currentUser.uid), {
      name: newDisplayName, // Store preferred name in 'name' field
      displayName: newDisplayName // Can also store 'displayName' if used elsewhere
    }, { merge: true });
  } catch (error) {
    console.error("Error updating display name:", error);
    throw error; // Re-throw for handling in UI
  }
}

/* ------------------------------------------------------------------
   3. USER STATUS (ONLINE/OFFLINE) + LAST SEEN (If needed elsewhere)
   - Note: updateDashboardLastSeen handles the specific dashboard timestamp.
   ------------------------------------------------------------------ */

/** Sets user online status and updates last seen timestamp in Firestore. */
export async function setUserOnline(userId: string) {
  if (!userId) return;
  try {
    await setDoc(
      doc(db, "users", userId),
      {
        online: true,
        lastSeen: serverTimestamp(), // General last seen timestamp
      },
      { merge: true },
    )
  } catch (error) {
      console.warn("Could not set user online status:", error);
  }
}

/** Handles browser visibility changes to update online status. */
export async function handleVisibilityChange(userId: string) {
  if (!userId) return;
  if (document.visibilityState === "visible") {
    await setUserOnline(userId);
  }
  // Optionally handle 'hidden' state to set online: false
}

/* ------------------------------------------------------------------
   4. CUSTOM TIMERS (CRUD + Listener)
   ------------------------------------------------------------------ */

/** Adds a new custom timer to Firestore. */
export async function addCustomTimer(name: string, timeInSeconds: number, userId: string): Promise<string> {
    if (!userId || !name || timeInSeconds <= 0) throw new Error("User ID, name, and positive duration required.");
    try {
        const docRef = await addDoc(collection(db, "customTimers"), {
            name: name.trim(),
            time: timeInSeconds,
            userId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding custom timer:", error);
        throw error;
    }
}

/** Updates an existing custom timer in Firestore. */
export async function updateCustomTimer(timerId: string, newName?: string, newTimeInSeconds?: number): Promise<void> {
    if (!timerId) throw new Error("Timer ID required.");
    const updates: any = { updatedAt: serverTimestamp() };
    if (newName !== undefined && newName.trim()) {
        updates.name = newName.trim();
    }
    if (newTimeInSeconds !== undefined && newTimeInSeconds > 0) {
        updates.time = newTimeInSeconds;
    }
    // Only update if there are actual changes besides the timestamp
    if (Object.keys(updates).length > 1) {
        try {
            await updateDoc(doc(db, "customTimers", timerId), updates);
        } catch (error) {
            console.error("Error updating custom timer:", error);
            throw error;
        }
    }
}

/** Deletes a custom timer from Firestore. */
export async function deleteCustomTimer(timerId: string): Promise<void> {
    if (!timerId) throw new Error("Timer ID required.");
    try {
        await deleteDoc(doc(db, "customTimers", timerId));
    } catch (error) {
        console.error("Error deleting custom timer:", error);
        throw error;
    }
}

/** Sets up a real-time listener for a user's custom timers. */
export function onCustomTimersSnapshot(
    userId: string,
    callback: (timers: Array<{ id: string; data: DocumentData }>) => void,
): () => void { // Return unsubscribe function
    if (!userId) {
        console.warn(`No user ID provided for customTimers listener.`);
        return () => {}; // Return a no-op unsubscribe function
    }
    const q = query(
        collection(db, "customTimers"),
        where("userId", "==", userId),
        orderBy("createdAt", "asc") // Order chronologically
    );
    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const results = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                data: docSnap.data()
            }));
            callback(results);
        },
        (error) => {
            console.error("Error listening to custom timers:", error);
            callback([]); // Send empty array on error
        },
    );
    return unsubscribe;
}

/* ------------------------------------------------------------------
   5. TASKS / GOALS / PROJECTS / PLANS (CRUD + LISTENERS)
   ------------------------------------------------------------------ */

/**
 * Creates a new item (Task, Goal, Project, Plan) in the appropriate collection.
 * @param userId The user's ID.
 * @param itemType The type of item ('tasks', 'goals', 'projects', 'plans').
 * @param itemData Object containing item details like text, dueDate, priority, sectionId.
 */
export async function createItem(
    userId: string,
    itemType: ItemType,
    itemData: { text: string, dueDate?: Date | null, priority?: 'high' | 'medium' | 'low', sectionId?: string | null }
): Promise<string> { // Return the new document ID
    if (!userId || !itemType || !itemData || !itemData.text.trim()) {
        throw new Error("User ID, item type, and text are required.");
    }

    // Determine the primary text field name based on item type
    const textField = itemType.slice(0, -1); // 'task', 'goal', 'project', 'plan'

    const dataToSave: any = {
        [textField]: itemData.text.trim(),
        userId: userId,
        dueDate: itemData.dueDate instanceof Date ? Timestamp.fromDate(itemData.dueDate) : null,
        priority: itemData.priority || 'medium', // Default priority
        sectionId: itemData.sectionId || null,   // Include sectionId if provided
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp() // Add updatedAt on create
    };

    try {
        const docRef = await addDoc(collection(db, itemType), dataToSave);
        return docRef.id;
    } catch (error) {
        console.error(`Error creating ${itemType}:`, error);
        throw error;
    }
}

// --- REMOVED createTask ---
// --- REMOVED createGoal ---
// --- REMOVED createProject ---
// --- REMOVED createPlan ---

/**
 * Marks an item as complete or incomplete in Firestore.
 * @param collectionName The Firestore collection name ('tasks', 'goals', etc.).
 * @param docId The ID of the document to update.
 */
export async function markItemComplete(collectionName: ItemType, docId: string): Promise<void> {
    if (!docId || !collectionName) throw new Error("Collection name and item ID required.");
    try {
        const itemRef = doc(db, collectionName, docId);
        const itemSnap = await getDoc(itemRef);
        if (!itemSnap.exists()) throw new Error("Item not found.");
        const currentStatus = itemSnap.data()?.completed || false;
        // Use updateItem to handle timestamp update
        await updateItem(collectionName, docId, { completed: !currentStatus });
    } catch (error) {
        console.error(`Error marking item ${docId} in ${collectionName} complete:`, error);
        throw error;
    }
}

/**
 * Updates specific fields of an item in Firestore.
 * Handles dueDate conversion to Timestamp and adds an updatedAt timestamp.
 * @param collectionName The Firestore collection name ('tasks', 'goals', etc.).
 * @param itemId The ID of the document to update.
 * @param updates An object containing the fields to update.
 */
export async function updateItem(
    collectionName: ItemType | 'customTimers' | 'sections', // Allow sections here too
    itemId: string,
    updates: any
): Promise<void> {
    if (!itemId || !collectionName) throw new Error("Collection name and item ID required.");
    if ('userId' in updates || 'createdAt' in updates) {
        console.warn("Attempted to update immutable fields (userId or createdAt). These updates will be ignored.");
        delete updates.userId;
        delete updates.createdAt;
    }
    if (Object.keys(updates).length === 0) {
        console.warn("updateItem called with no fields to update for item:", itemId);
        return; // No need to proceed if no valid fields are being updated
    }

    const itemRef = doc(db, collectionName, itemId);

    // Prepare a copy of updates to modify safely
    const updatesToSave = { ...updates };

    // Ensure dueDate is a Timestamp if present and valid, or null
    if ('dueDate' in updatesToSave) {
        const potentialDate = updatesToSave.dueDate;
        if (potentialDate instanceof Date && !isNaN(potentialDate.getTime())) {
            updatesToSave.dueDate = Timestamp.fromDate(potentialDate);
        } else if (potentialDate === null || potentialDate === undefined || potentialDate === '') {
             // Allow explicitly setting dueDate to null
            updatesToSave.dueDate = null;
        } else {
            // Handle cases where it might be a Firestore Timestamp already (e.g., from reading data)
            if (!(potentialDate instanceof Timestamp)) {
                // If it's not a valid Date, not null/undefined, and not already a Timestamp, remove it.
                console.warn(`Invalid date value provided for dueDate update on item ${itemId}. Removing dueDate from update.`);
                delete updatesToSave.dueDate;
            }
            // If it's already a Timestamp, keep it as is.
        }
    }

    // Add updatedAt timestamp
    updatesToSave.updatedAt = serverTimestamp();

    try {
        await updateDoc(itemRef, updatesToSave);
    } catch (error) {
        console.error(`Error updating item ${itemId} in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Deletes an item from the specified Firestore collection.
 * @param collectionName The Firestore collection name ('tasks', 'goals', etc.).
 * @param itemId The ID of the document to delete.
 */
export async function deleteItem(
    collectionName: ItemType | 'customTimers' | 'sections', // Allow sections here too
    itemId: string
): Promise<void> {
    if (!itemId || !collectionName) throw new Error("Collection name and item ID required.");
    try {
        await deleteDoc(doc(db, collectionName, itemId));
    } catch (error) {
        console.error(`Error deleting item ${itemId} from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Sets up a real-time listener for items in a specific collection for a given user.
 * @param collectionName The Firestore collection name ('tasks', 'goals', etc.).
 * @param userId The user's ID to filter by.
 * @param callback Function to call with the updated item list.
 * @returns An unsubscribe function to stop the listener.
 */
export function onCollectionSnapshot(
    collectionName: ItemType,
    userId: string,
    callback: (items: Array<{ id: string; data: DocumentData }>) => void,
): () => void { // Ensure it returns unsubscribe
    if (!userId) {
        console.warn(`No user ID provided for ${collectionName} listener.`);
        return () => {}; // Handle no user case
    }
    const q = query(
        collection(db, collectionName),
        where("userId", "==", userId),
        orderBy("createdAt", "desc") // Default order, can be adjusted if needed
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            data: docSnap.data()
        }));
        callback(results);
    }, (error) => {
        console.error(`Error listening to ${collectionName}:`, error);
        callback([]); // Send empty array on error
    });
    return unsubscribe;
}


/* ------------------------------------------------------------------
   6. SECTIONS (for Custom Tabs)
   ------------------------------------------------------------------ */

/** Creates a new section (custom tab) document in Firestore. */
export async function createSection(userId: string, name: string, order: number, hidden: boolean = false): Promise<string> {
    if (!userId || !name.trim()) throw new Error("User ID and section name are required.");
    try {
        const sectionData = {
            name: name.trim(),
            userId,
            order,
            hidden, // Store hidden state
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, "sections"), sectionData);
        return docRef.id;
    } catch (error) {
        console.error("Error creating section:", error);
        throw error;
    }
}

/** Retrieves all sections for a specific user, ordered. */
export async function getSections(userId: string): Promise<Array<{ id: string; data: DocumentData }>> {
    if (!userId) throw new Error("User ID required.");
    try {
        const q = query(collection(db, "sections"), where("userId", "==", userId), orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    } catch (error) {
        console.error("Error getting sections:", error);
        throw error;
    }
}

/** Updates a section document (name, order, hidden state). */
export async function updateSection(userId: string, sectionId: string, updates: { name?: string; order?: number; hidden?: boolean }): Promise<void> {
    if (!userId || !sectionId) throw new Error("User ID and Section ID are required.");
    // Prepare updates, ensuring name is trimmed if provided
    const dataToUpdate: any = {};
    if (updates.name !== undefined) dataToUpdate.name = updates.name.trim();
    if (updates.order !== undefined) dataToUpdate.order = updates.order;
    if (updates.hidden !== undefined) dataToUpdate.hidden = updates.hidden;

    if (Object.keys(dataToUpdate).length === 0) {
         console.warn("updateSection called with no fields to update for section:", sectionId);
         return; // No actual updates
    }

    dataToUpdate.updatedAt = serverTimestamp(); // Add timestamp

    try {
        const sectionRef = doc(db, "sections", sectionId);
        // Optional: Verify ownership before updating
        // const sectionSnap = await getDoc(sectionRef);
        // if (!sectionSnap.exists() || sectionSnap.data()?.userId !== userId) {
        //   throw new Error("Section not found or user unauthorized.");
        // }
        await updateDoc(sectionRef, dataToUpdate);
    } catch (error) {
        console.error("Error updating section:", error);
        throw error;
    }
}

/** Deletes a section document from Firestore. */
export async function deleteSection(userId: string, sectionId: string): Promise<void> {
     if (!userId || !sectionId) throw new Error("User ID and Section ID are required.");
     try {
        const sectionRef = doc(db, "sections", sectionId);
         // Optional: Verify ownership before deleting
        // const sectionSnap = await getDoc(sectionRef);
        // if (!sectionSnap.exists() || sectionSnap.data()?.userId !== userId) {
        //   throw new Error("Section not found or user unauthorized.");
        // }
        await deleteDoc(sectionRef);
        // Note: Deleting the section does NOT automatically delete items linked via sectionId.
        // This might require a cleanup function or manual reassignment.
     } catch (error) {
        console.error("Error deleting section:", error);
        throw error;
     }
}

/** Sets up a real-time listener for a user's sections. */
export function onSectionsSnapshot(
    userId: string,
    callback: (sections: Array<{ id: string; data: DocumentData }>) => void,
): () => void {
    if (!userId) {
        console.warn("No user ID provided for sections listener.");
        return () => {};
    }
    const q = query(
        collection(db, "sections"),
        where("userId", "==", userId),
        orderBy("order", "asc") // Order sections as intended
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            data: docSnap.data()
        }));
        callback(results);
    }, (error) => {
        console.error("Error listening to sections:", error);
        callback([]);
    });
    return unsubscribe;
}

/* ------------------------------------------------------------------
   7. MISCELLANEOUS (Kept from original if still needed)
   ------------------------------------------------------------------ */

// --- Example: Linked Events (Keep if functionality is used) ---
// export async function createLinkedEvent(...) { ... }
// export function onEventsSnapshot(...) { ... }

// --- Example: Night Mode Preference (Keep if functionality is used) ---
// export async function setNightMode(userId: string, isEnabled: boolean) { ... }

// --- Example: Splash Screen Check (Keep if functionality is used) ---
// export async function checkSplashScreen(userId: string) { ... }
