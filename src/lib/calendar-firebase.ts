import {
  addDoc,
  collection,
  Timestamp,
  updateDoc,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp // Added for consistency
} from 'firebase/firestore';
import { db } from './firebase';

// Interface specific to the 'events' collection structure
export interface CalendarEventData {
  title: string;
  description?: string;
  startDate: Date; // Use Date type for input
  endDate: Date;   // Use Date type for input
  isAllDay?: boolean;
  color?: string;
  userId: string;
  // Optional fields that might be set, but type defaults to 'event' usually
  type?: 'event' | 'task' | 'goal' | 'project' | 'plan';
  status?: 'pending' | 'completed';
  // Timestamps managed internally
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Explicitly define the data structure for Firestore, converting Dates to Timestamps
interface FirestoreEventData extends Omit<CalendarEventData, 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'> {
    startDate: Timestamp;
    endDate: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    type: 'event'; // Explicitly set type for this collection
}

// Function to create an item specifically in the 'events' collection
export async function createEvent(eventData: Omit<CalendarEventData, 'createdAt' | 'updatedAt'>): Promise<string> {
  if (!eventData.userId || !eventData.title || !eventData.startDate || !eventData.endDate) {
      throw new Error("Missing required fields for creating event (userId, title, startDate, endDate)");
  }
  try {
    const dataToSave: FirestoreEventData = {
      ...eventData,
      startDate: Timestamp.fromDate(eventData.startDate),
      endDate: Timestamp.fromDate(eventData.endDate),
      isAllDay: eventData.isAllDay ?? false, // Default isAllDay if not provided
      color: eventData.color ?? '#3B82F6', // Default color
      type: 'event', // Ensure type is always 'event' for this collection
      userId: eventData.userId,
      title: eventData.title,
      // Add other fields with defaults if necessary
      description: eventData.description ?? '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'events'), dataToSave);
    console.log("Event created with ID: ", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

// Function to update an item specifically in the 'events' collection
// Note: 'updates' should only contain fields relevant to the 'events' collection schema
export async function updateEvent(eventId: string, updates: Partial<CalendarEventData>): Promise<void> {
  if (!eventId) {
      throw new Error("Event ID is required for updating.");
  }
  try {
    const eventRef = doc(db, 'events', eventId);

    // Prepare updates, converting dates if present
    const dataToUpdate: Partial<FirestoreEventData & { updatedAt: Timestamp }> = {
        ...updates, // Spread existing valid updates
        // Conditionally convert dates to Timestamps
        ...(updates.startDate && { startDate: Timestamp.fromDate(updates.startDate) }),
        ...(updates.endDate && { endDate: Timestamp.fromDate(updates.endDate) }),
        // Ensure internal fields are not directly overwritten unless intended
        userId: undefined, // Prevent changing userId via this function
        createdAt: undefined, // Prevent changing createdAt
        updatedAt: serverTimestamp() // Always update the timestamp
    };

    // Remove undefined keys to avoid errors during update
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[key as keyof typeof dataToUpdate]);

    if (Object.keys(dataToUpdate).length > 1) { // Check if there's anything to update besides timestamp
        await updateDoc(eventRef, dataToUpdate);
        console.log("Event updated: ", eventId);
    } else {
        console.log("No valid fields to update for event: ", eventId);
    }

  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
}

// Function to delete an item specifically from the 'events' collection
export async function deleteEvent(eventId: string): Promise<void> {
   if (!eventId) {
        throw new Error("Event ID is required for deletion.");
    }
  try {
    await deleteDoc(doc(db, 'events', eventId));
    console.log("Event deleted: ", eventId);
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
}

// Listener specifically for the 'events' collection
// Returns data matching the CalendarEvent structure used in the UI
export function onCollectionSnapshot(
  // collectionName: string, // Keep collectionName fixed to 'events' for this specific listener
  userId: string,
  callback: (items: Array<{ id: string; data: CalendarEventData }>) => void,
  onError: (error: Error) => void // Add error handler
): () => void { // Return unsubscribe function
  if (!userId) {
      console.warn("onCollectionSnapshot (calendar-firebase) called without userId.");
      onError(new Error("User ID is required for snapshot listener."));
      return () => {}; // Return a no-op unsubscribe function
  }

  const collectionName = 'events'; // Hardcode for this specific listener
  const q = query(
    collection(db, collectionName),
    where('userId', '==', userId),
    orderBy('startDate', 'asc') // Order events by start date
    // Consider adding more specific filtering if needed (e.g., date range)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items: Array<{ id: string; data: CalendarEventData }> = [];
    snapshot.forEach((doc) => {
        const firestoreData = doc.data();
        // Convert Timestamps back to Dates for UI consistency
        const eventData: CalendarEventData = {
            title: firestoreData.title || "Untitled Event",
            description: firestoreData.description || "",
            startDate: firestoreData.startDate?.toDate() ?? new Date(),
            endDate: firestoreData.endDate?.toDate() ?? new Date(),
            isAllDay: firestoreData.isAllDay ?? false,
            color: firestoreData.color,
            userId: firestoreData.userId,
            type: 'event', // Explicitly set type
            status: firestoreData.status, // Include status if present
            // Include other fields if necessary
        };
        items.push({
            id: doc.id,
            data: eventData
        });
    });
    callback(items);
  },
  (error) => { // Firestore error handling
      console.error(`Error listening to ${collectionName} collection:`, error);
      onError(error);
  });

  return unsubscribe; // Return the unsubscribe function
}
