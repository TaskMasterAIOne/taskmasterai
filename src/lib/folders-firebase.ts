// src/lib/folders-firebase.ts
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  getDoc,
  orderBy,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp,
  limit,
  runTransaction,
  increment
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadString } from "firebase/storage";
import { db, storage } from "./firebase";
import { calculateLevel as calculateUserLevel } from "./current-paying-user"; // Renamed to avoid conflict

const defaultFolderColors = [ "#718096", "#F56565", "#ED8936", "#ECC94B", "#48BB78", "#38B2AC", "#4299E1", "#667EEA", "#9F7AEA", "#ED64A6"];

export interface FolderItemBase {
  id: string;
  type: "flashcard" | "question";
  createdAt?: Date | null; // Changed to Date | null
  updatedAt?: Date | null; // Changed to Date | null
  lastReviewed?: Date | null; // Changed to Date | null
  nextReviewDate?: Date | null; // Changed to Date | null
  intervalDays?: number;
  easeFactor?: number;
  repetitions?: number;
  masteryLevel?: 'new' | 'learning' | 'familiar' | 'mastered';
}

export interface Flashcard extends FolderItemBase {
  type: "flashcard";
  term: string;
  definition: string;
  topic?: string;
}

export interface Question extends FolderItemBase {
  type: "question";
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export type FolderItem = Flashcard | Question;

export interface StudyGoal {
  id: string;
  description: string;
  target: number;
  currentProgress: number;
  type: 'flashcards_mastered' | 'time_spent_minutes' | 'items_reviewed';
  createdAt: Date | null; // Changed to Date | null
  isCompleted: boolean;
}

export interface FolderData {
  id: string;
  name: string;
  description?: string;
  type: "flashcard" | "question" | "mixed";
  createdAt: Date | null; // Changed to Date | null
  updatedAt: Date | null; // Changed to Date | null
  itemCount: number;
  color?: string;
  isStarred?: boolean;
  tags?: string[];
  parentId?: string | null;
  path?: string[];
  subfolderCount?: number;
  lastStudiedAt?: Date | null; // Changed to Date | null
  points: number;
  level: number;
  dailyStreakCount: number;
  lastStreakUpdate?: Date | null; // Changed to Date | null
  memoryScore: number;
  studyGoals: StudyGoal[];
  avgMasteryLevel?: number;
}


export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date | null; // Changed to Date | null
  error?: boolean;
  actionDetails?: { status: 'success' | 'error'; message?: string };
  imageUrl?: string;
  imageMeta?: { name: string; type: string; storagePath: string };
  wasImageGenerated?: boolean;
  attachedFilesMeta?: Array<{ name: string; type: string; size: number; url?: string; storagePath?: string; base64Data?: string }>;
  flashcard?: { type: 'flashcard'; data: Array<{ id: string; term: string; definition: string; topic: string }> };
  question?: { type: 'question'; data: Array<{ id: string; question: string; options: string[]; correctAnswer: number; explanation: string }> };
  localPlaceholderId?: string;
  isLoading?: boolean;
  sources?: Array<{ number: number; url: string; title: string }>; // Web search sources
}

export interface ChatConversation {
  id: string;
  userId: string;
  folderId: string | null;
  chatName: string;
  createdAt: Date | null; // Changed to Date | null
  updatedAt: Date | null; // Changed to Date | null
  lastMessage?: string;
  lastMessageAt?: Date | null; // Changed to Date | null
}

export interface ImageMeta {
  name: string;
  type: string;
  storagePath: string;
  url?: string;
  size?: number;
}

export interface AttachedFileMeta {
  name: string;
  type: string;
  size: number;
  url?: string;
  storagePath?: string;
}

// Centralized and robust toDateSafe function for Firestore data conversion
const toDateSafeInternal = (timestampField: any): Date | null => {
    if (!timestampField) return null;
    if (timestampField instanceof Timestamp) return timestampField.toDate();
    if (timestampField instanceof Date) return timestampField; // Already a Date
    if (typeof timestampField === 'string' || typeof timestampField === 'number') {
        const d = new Date(timestampField);
        return isNaN(d.getTime()) ? null : d;
    }
    // Handle plain objects that mimic Firestore Timestamps
    if (typeof timestampField === 'object' && timestampField !== null &&
        typeof (timestampField as any).seconds === 'number' && typeof (timestampField as any).nanoseconds === 'number') {
        try {
            return new Timestamp((timestampField as any).seconds, (timestampField as any).nanoseconds).toDate();
        } catch (e) {
            console.warn("toDateSafeInternal (fb): Error converting plain object to Date:", timestampField, e);
            return null;
        }
    }
    console.warn("toDateSafeInternal (fb): Unhandled timestamp type, returning null.", typeof timestampField, timestampField);
    return null;
};


const convertDocToFolderData = (docSnap: any): FolderData => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || "Unnamed Folder",
    description: data.description || "",
    type: data.type || "mixed",
    createdAt: toDateSafeInternal(data.createdAt),
    updatedAt: toDateSafeInternal(data.updatedAt),
    itemCount: data.itemCount || 0,
    color: data.color || defaultFolderColors[0],
    isStarred: data.isStarred || false,
    tags: data.tags || [],
    parentId: data.parentId || null,
    path: data.path || [docSnap.id],
    subfolderCount: data.subfolderCount || 0,
    lastStudiedAt: toDateSafeInternal(data.lastStudiedAt),
    points: data.points || 0,
    level: data.level || calculateUserLevel(data.points || 0), // Use renamed import
    dailyStreakCount: data.dailyStreakCount || 0,
    lastStreakUpdate: toDateSafeInternal(data.lastStreakUpdate),
    memoryScore: data.memoryScore || 0,
    studyGoals: (data.studyGoals || []).map((g: any) => ({...g, createdAt: toDateSafeInternal(g.createdAt), isCompleted: g.isCompleted || false })),
    avgMasteryLevel: data.avgMasteryLevel || 0,
  };
};

const convertDocToFolderItem = (docSnap: any): FolderItem => {
  const data = docSnap.data();
  const baseItem: FolderItemBase = {
    id: docSnap.id,
    type: data.type,
    createdAt: toDateSafeInternal(data.createdAt),
    updatedAt: toDateSafeInternal(data.updatedAt),
    lastReviewed: toDateSafeInternal(data.lastReviewed),
    nextReviewDate: toDateSafeInternal(data.nextReviewDate),
    intervalDays: data.intervalDays || 0,
    easeFactor: data.easeFactor || 2.5,
    repetitions: data.repetitions || 0,
    masteryLevel: data.masteryLevel || 'new',
  };
  if (data.type === "flashcard") {
    return {
      ...baseItem,
      type: "flashcard",
      term: data.term || "",
      definition: data.definition || "",
      topic: data.topic || "",
    } as Flashcard;
  } else {
    return {
      ...baseItem,
      type: "question",
      question: data.question || "",
      options: data.options || [],
      correctAnswer: typeof data.correctAnswer === 'number' ? data.correctAnswer : 0,
      explanation: data.explanation || "",
    } as Question;
  }
};

export const createFolder = async (
  userId: string,
  name: string,
  type: "flashcard" | "question" | "mixed",
  description?: string,
  color?: string,
  parentId?: string | null
): Promise<string> => {
  const foldersCollRef = collection(db, "users", userId, "folders");
  let parentPath: string[] = [];
  let parentDocRef = null;

  if (parentId) {
    parentDocRef = doc(foldersCollRef, parentId);
    const parentDocSnap = await getDoc(parentDocRef);
    if (parentDocSnap.exists()) {
      parentPath = parentDocSnap.data()?.path || [parentId];
    } else {
      console.warn("Parent folder not found during subfolder creation, creating as root.");
      parentId = null;
    }
  }

  const newFolderRef = doc(foldersCollRef);
  // Firestore expects Timestamps for serverTimestamp(), not Date types in definition initially for server values
  const newFolderDataServerValues: Omit<FolderData, "id" | "createdAt" | "updatedAt" | "lastStudiedAt" | "lastStreakUpdate" | "studyGoals" | "level"> & { createdAt: any; updatedAt: any; lastStudiedAt: null, lastStreakUpdate: null, studyGoals: [], level: number } = {
    name: name.trim() || "Untitled Folder",
    description: description?.trim() || "",
    type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    itemCount: 0,
    color: color || defaultFolderColors[Math.floor(Math.random() * defaultFolderColors.length)],
    isStarred: false,
    tags: [],
    parentId: parentId || null,
    path: parentId ? [...parentPath, newFolderRef.id] : [newFolderRef.id],
    subfolderCount: 0,
    lastStudiedAt: null,
    points: 0,
    level: 1, // Initial level
    dailyStreakCount: 0,
    lastStreakUpdate: null,
    memoryScore: 0,
    studyGoals: [],
    avgMasteryLevel: 0,
  };

  await setDoc(newFolderRef, newFolderDataServerValues);

  if (parentId && parentDocRef) {
     try {
        await updateDoc(parentDocRef, {
            subfolderCount: increment(1),
            updatedAt: serverTimestamp(),
        });
    } catch (e) {
        console.error("Failed to update parent subfolder count:", e);
    }
  }
  return newFolderRef.id;
};

export const updateFolder = async (
  userId: string,
  folderId: string,
  updates: Partial<Omit<FolderData, "id" | "createdAt" | "path">> // Removed level from Omit as it's calculated
): Promise<void> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const updatePayload: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.points !== undefined && updates.points !== null) { // Check for null too
      updatePayload.level = calculateUserLevel(updates.points); // Use renamed import
  }
  // Convert Date objects back to Timestamps if they are being updated
  if (updates.lastStudiedAt instanceof Date) updatePayload.lastStudiedAt = Timestamp.fromDate(updates.lastStudiedAt);
  if (updates.lastStreakUpdate instanceof Date) updatePayload.lastStreakUpdate = Timestamp.fromDate(updates.lastStreakUpdate);
  if (updates.studyGoals) {
      updatePayload.studyGoals = updates.studyGoals.map(goal => ({
          ...goal,
          createdAt: goal.createdAt instanceof Date ? Timestamp.fromDate(goal.createdAt) : goal.createdAt
      }));
  }

  await updateDoc(folderRef, updatePayload);
};

export const deleteFolderRecursive = async (userId: string, folderId: string): Promise<void> => {
  const batch = writeBatch(db);
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) return;
  const folderData = folderSnap.data() as FolderData; // Assuming it's converted if needed, or raw data

  const itemsQuery = query(collection(folderRef, "items"));
  const itemsSnap = await getDocs(itemsQuery);
  itemsSnap.forEach(itemDoc => batch.delete(itemDoc.ref));

  const subfoldersQuery = query(collection(db, "users", userId, "folders"), where("parentId", "==", folderId));
  const subfoldersSnap = await getDocs(subfoldersQuery);
  const subfolderDeletePromises = subfoldersSnap.docs.map(subfolderDoc => deleteFolderRecursive(userId, subfolderDoc.id));
  await Promise.all(subfolderDeletePromises);

  const chatConversationsQuery = query(collection(db, "users", userId, "folderChats"), where("folderId", "==", folderId));
  const chatConversationsSnap = await getDocs(chatConversationsQuery);
  for (const convDoc of chatConversationsSnap.docs) {
      const messagesQuery = query(collection(convDoc.ref, "messages"));
      const messagesSnap = await getDocs(messagesQuery);
      messagesSnap.forEach(msgDoc => {
          const msgData = msgDoc.data();
           if (msgData.imageMeta?.storagePath) { deleteObject(ref(storage, msgData.imageMeta.storagePath)).catch(e => console.warn("Non-critical: Failed to delete chat image from storage:", e)); }
            if (msgData.attachedFilesMeta) {
                (msgData.attachedFilesMeta as AttachedFileMeta[]).forEach((file) => {
                    if (file.storagePath) { deleteObject(ref(storage, file.storagePath)).catch(e => console.warn("Non-critical: Failed to delete chat file from storage:", e)); }
                });
            }
          batch.delete(msgDoc.ref);
      });
      batch.delete(convDoc.ref);
  }

  batch.delete(folderRef);
  await batch.commit();

  if (folderData?.parentId) {
    const parentRef = doc(db, "users", userId, "folders", folderData.parentId);
    try {
        await updateDoc(parentRef, {
            subfolderCount: increment(-1),
            updatedAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn("Failed to decrement parent subfolder count, parent may have been deleted:", e);
    }
  }
};


export const toggleFolderStar = async (userId: string, folderId: string): Promise<void> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const folderSnap = await getDoc(folderRef);
  if (folderSnap.exists()) {
    await updateDoc(folderRef, {
      isStarred: !folderSnap.data().isStarred,
      updatedAt: serverTimestamp(),
    });
  }
};

export const onFoldersSnapshot = (
  userId: string,
  parentId: string | null,
  callback: (folders: FolderData[]) => void
): (() => void) => {
  const foldersCollRef = collection(db, "users", userId, "folders");
  const q = query(
    foldersCollRef,
    where("parentId", "==", parentId),
    orderBy("isStarred", "desc"),
    orderBy("name", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(convertDocToFolderData));
  }, (error) => {
    console.error(`Error fetching folders (parentId: ${parentId}): `, error);
    callback([]);
  });
};

export const getFolder = async (userId: string, folderId: string): Promise<FolderData | null> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const folderSnap = await getDoc(folderRef);
  return folderSnap.exists() ? convertDocToFolderData(folderSnap) : null;
};

export const addFolderItem = async (
  userId: string,
  folderId: string,
  itemData: Omit<Flashcard, "id" | "createdAt" | "updatedAt" | "lastReviewed" | "type" | keyof FolderItemBase> | Omit<Question, "id" | "createdAt" | "updatedAt" | "lastReviewed" | "type" | keyof FolderItemBase>,
  type: "flashcard" | "question"
): Promise<string> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const folderSnap = await getDoc(folderRef);
  if (!folderSnap.exists()) throw new Error("Folder not found.");
  const currentFolderData = folderSnap.data() as FolderData; // Raw data or converted FolderData
  if (currentFolderData.type !== "mixed" && currentFolderData.type !== type) {
    throw new Error(`Cannot add ${type} to a ${currentFolderData.type}-only folder.`);
  }

  const itemsRef = collection(folderRef, "items");
  const newItemRef = doc(itemsRef);

  const fullItemDataServerValues: Omit<FolderItem, "id" | "createdAt" | "updatedAt" | "lastReviewed" | "nextReviewDate" > & { id: string, createdAt: any, updatedAt: any, lastReviewed: null, nextReviewDate: any } = {
    id: newItemRef.id,
    type,
    ...itemData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastReviewed: null,
    nextReviewDate: Timestamp.fromDate(new Date()),
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    masteryLevel: 'new',
  } as any;

  await setDoc(newItemRef, fullItemDataServerValues);
  await updateDoc(folderRef, {
    itemCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  return newItemRef.id;
};

export const updateFolderItem = async (
  userId: string,
  folderId: string,
  itemId: string,
  updates: Partial<Omit<FolderItem, "id" | "type" | "createdAt">>
): Promise<void> => {
  const itemRef = doc(db, "users", userId, "folders", folderId, "items", itemId);
  const updatePayload: any = { ...updates, updatedAt: serverTimestamp() };
  // Convert Date objects back to Timestamps if they are being updated
  if (updates.lastReviewed instanceof Date) updatePayload.lastReviewed = Timestamp.fromDate(updates.lastReviewed);
  else if (updates.lastReviewed === null) updatePayload.lastReviewed = null;

  if (updates.nextReviewDate instanceof Date) updatePayload.nextReviewDate = Timestamp.fromDate(updates.nextReviewDate);
  else if (updates.nextReviewDate === null) updatePayload.nextReviewDate = null;

  await updateDoc(itemRef, updatePayload);
};

export const deleteFolderItem = async (userId: string, folderId: string, itemId: string): Promise<void> => {
  const itemRef = doc(db, "users", userId, "folders", folderId, "items", itemId);
  await deleteDoc(itemRef);
  const folderRef = doc(db, "users", userId, "folders", folderId);
  await updateDoc(folderRef, {
    itemCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
};

export const onFolderItemsSnapshot = (
  userId: string,
  folderId: string,
  callback: (items: FolderItem[]) => void
): (() => void) => {
  const itemsRef = collection(db, "users", userId, "folders", folderId, "items");
  const q = query(itemsRef, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(convertDocToFolderItem));
  }, (error) => {
    console.error(`Error fetching folder items for ${folderId}: `, error);
    callback([]);
  });
};

export const updateLastReviewed = async (userId: string, folderId: string, itemId: string): Promise<void> => {
  const itemRef = doc(db, "users", userId, "folders", folderId, "items", itemId);
  await updateDoc(itemRef, { lastReviewed: serverTimestamp(), updatedAt: serverTimestamp() });
};

export const getReviewQueueForFolder = async (userId: string, folderId: string, maxItems = 20): Promise<FolderItem[]> => {
    const itemsRef = collection(db, "users", userId, "folders", folderId, "items");
    const now = Timestamp.now();
    const qDue = query(
        itemsRef,
        where("nextReviewDate", "<=", now),
        orderBy("nextReviewDate", "asc"),
        limit(maxItems)
    );
    const dueSnapshot = await getDocs(qDue);
    let dueItems = dueSnapshot.docs.map(convertDocToFolderItem);

    if (dueItems.length < maxItems) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        const newAndLearningQuery = query(
            itemsRef,
            where("masteryLevel", "in", ["new", "learning"]),
            orderBy("createdAt", "asc"),
            limit(maxItems - dueItems.length)
        );
        const newAndLearningSnapshot = await getDocs(newAndLearningQuery);
        const additionalItems = newAndLearningSnapshot.docs
            .map(convertDocToFolderItem)
            .filter(item => !dueItems.find(di => di.id === item.id))
            .filter(item => !item.lastReviewed || item.lastReviewed < thirtyDaysAgo); // Compare Date objects

        dueItems = [...dueItems, ...additionalItems].slice(0, maxItems);
    }
    // Sort final list by nextReviewDate, putting nulls (new items essentially) first or last as desired.
    // Here, nulls/earlier dates come first.
    return dueItems.sort((a, b) => {
        const dateA = a.nextReviewDate ? a.nextReviewDate.getTime() : 0; // Treat null as very old
        const dateB = b.nextReviewDate ? b.nextReviewDate.getTime() : 0;
        return dateA - dateB;
    });
};

export const updateItemSpacedRepetitionData = async (
  userId: string,
  folderId: string,
  itemId: string,
  srData: {
    nextReviewDate: Date | null; // Expect Date or null
    intervalDays: number;
    easeFactor: number;
    repetitions: number;
    masteryLevel: 'new' | 'learning' | 'familiar' | 'mastered';
  }
): Promise<void> => {
  const itemRef = doc(db, "users", userId, "folders", folderId, "items", itemId);
  const updatePayload: any = { ...srData, lastReviewed: serverTimestamp(), updatedAt: serverTimestamp() };

  if(srData.nextReviewDate === null) {
    updatePayload.nextReviewDate = null;
  } else { // It's a Date object
    updatePayload.nextReviewDate = Timestamp.fromDate(srData.nextReviewDate);
  }
  await updateDoc(itemRef, updatePayload);
};


export const addTagToFolder = async (userId: string, folderId: string, tag: string): Promise<void> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const cleanedTag = tag.trim().toLowerCase();
  if (!cleanedTag) return;
  await updateDoc(folderRef, { tags: arrayUnion(cleanedTag), updatedAt: serverTimestamp() });
  const userMetaRef = doc(db, "users", userId, "metadata", "allUserTags");
  await setDoc(userMetaRef, { tags: arrayUnion(cleanedTag) }, { merge: true });
};

export const removeTagFromFolder = async (userId: string, folderId: string, tag: string): Promise<void> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  const cleanedTag = tag.trim().toLowerCase();
  await updateDoc(folderRef, { tags: arrayRemove(cleanedTag), updatedAt: serverTimestamp() });
};

export const updateTagInFolder = async (userId: string, folderId: string, oldTag: string, newTag: string): Promise<void> => {
    const folderRef = doc(db, "users", userId, "folders", folderId);
    const cleanedOldTag = oldTag.trim().toLowerCase();
    const cleanedNewTag = newTag.trim().toLowerCase();
    if (!cleanedNewTag || cleanedOldTag === cleanedNewTag) return;

    const folderSnap = await getDoc(folderRef);
    if (folderSnap.exists()) {
        const currentTags = (folderSnap.data()?.tags || []) as string[];
        const updatedTags = currentTags.map(t => t.toLowerCase() === cleanedOldTag ? cleanedNewTag : t);
        const finalTags = Array.from(new Set(updatedTags));

        await updateDoc(folderRef, { tags: finalTags, updatedAt: serverTimestamp() });

        const userMetaRef = doc(db, "users", userId, "metadata", "allUserTags");
        await runTransaction(db, async (transaction) => {
            const userMetaSnap = await transaction.get(userMetaRef);
            let allUserTags = ((userMetaSnap.data()?.tags || []) as string[]).map(t => t.toLowerCase());

            allUserTags = allUserTags.filter(t => t !== cleanedOldTag);
            if (!allUserTags.includes(cleanedNewTag)) {
                allUserTags.push(cleanedNewTag);
            }
            transaction.set(userMetaRef, { tags: Array.from(new Set(allUserTags)).sort() }, { merge: true });

            // Check if oldTag should be removed globally (if no other folder uses it)
            const foldersWithOldTagQuery = query(
                collection(db, "users", userId, "folders"),
                where("tags", "array-contains", cleanedOldTag)
            );
            const foldersWithOldTagSnap = await getDocs(foldersWithOldTagQuery); // Execute query outside transaction if possible, or ensure it's small
            if (foldersWithOldTagSnap.empty) { // No other folder has this old tag
                 let currentGlobalTags = (await transaction.get(userMetaRef)).data()?.tags || [];
                 currentGlobalTags = currentGlobalTags.filter((t:string) => t.toLowerCase() !== cleanedOldTag);
                 transaction.set(userMetaRef, { tags: Array.from(new Set(currentGlobalTags)).sort() }, { merge: true });
            }
        });
    }
};


export const getAllUserTags = async (userId: string): Promise<string[]> => {
  const userMetaRef = doc(db, "users", userId, "metadata", "allUserTags");
  const docSnap = await getDoc(userMetaRef);
  if (docSnap.exists() && docSnap.data()?.tags) {
      return (docSnap.data()?.tags || []).sort();
  }
  // Fallback: Recalculate from all folders if metadata is missing
  const foldersRef = collection(db, "users", userId, "folders");
  const snapshot = await getDocs(foldersRef);
  const tagSet = new Set<string>();
  snapshot.forEach(doc => (doc.data().tags || []).forEach((tag: string) => tagSet.add(tag.trim().toLowerCase())));
  const tags = Array.from(tagSet).sort();
  if (tags.length > 0) {
      await setDoc(userMetaRef, { tags }, { merge: true });
  }
  return tags;
};


export const createChatConversation = async (userId: string, folderId: string | null, chatName: string): Promise<string> => {
  const convCollRef = collection(db, "users", userId, "folderChats");
  const newConvDataServerValues: Omit<ChatConversation, "id" | "createdAt" | "updatedAt" | "lastMessageAt"> & { createdAt: any, updatedAt: any, lastMessageAt?: any } = {
    userId,
    folderId: folderId || null,
    chatName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(convCollRef, newConvDataServerValues);
  return docRef.id;
};

export const saveChatMessage = async (userId: string, conversationId: string, message: Partial<Omit<ChatMessage, "createdAt"> & {createdAt?: any}>): Promise<string> => {
  const messagesCollRef = collection(db, "users", userId, "folderChats", conversationId, "messages");
  const createdAt = message.createdAt || serverTimestamp(); // Use existing if it's already a serverTimestamp
  const fullMessage = { ...message, createdAt };

  const docRef = await addDoc(messagesCollRef, fullMessage);

  const convRef = doc(db, "users", userId, "folderChats", conversationId);
  await updateDoc(convRef, {
    lastMessage: message.content?.substring(0, 100) || (message.imageUrl ? "[Image]" : (message.attachedFilesMeta && message.attachedFilesMeta.length > 0 ? `[${message.attachedFilesMeta.length} File(s)]` : "[Message]")),
    lastMessageAt: createdAt, // This will be serverTimestamp() if createdAt was serverTimestamp()
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const onChatMessagesSnapshot = (userId: string, conversationId: string, callback: (messages: ChatMessage[]) => void): (() => void) => {
  const messagesCollRef = collection(db, "users", userId, "folderChats", conversationId, "messages");
  const q = query(messagesCollRef, orderBy("createdAt", "asc"), limit(100));
  return onSnapshot(q, (snapshot) => {
    const messagesData = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: toDateSafeInternal(docSnap.data().createdAt),
    } as ChatMessage));
    callback(messagesData);
  }, (error) => {
    console.error(`Error fetching chat messages for ${conversationId}: `, error);
    callback([]);
  });
};

export const onChatConversationsSnapshot = (userId: string, folderId: string | null, callback: (conversations: ChatConversation[]) => void): (() => void) => {
  const convCollRef = collection(db, "users", userId, "folderChats");
  let q;
  if (folderId === null) {
    q = query(
        convCollRef,
        where("userId", "==", userId),
        where("folderId", "==", null),
        orderBy("updatedAt", "desc")
    );
  } else {
    q = query(
        convCollRef,
        where("userId", "==", userId),
        where("folderId", "==", folderId),
        orderBy("updatedAt", "desc")
    );
  }

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: toDateSafeInternal(docSnap.data().createdAt),
      updatedAt: toDateSafeInternal(docSnap.data().updatedAt),
      lastMessageAt: toDateSafeInternal(docSnap.data().lastMessageAt),
    } as ChatConversation)));
  }, (error) => {
    console.error(`Error fetching chat conversations (folderId: ${folderId}): `, error);
    callback([]);
  });
};

export const updateChatConversationName = async (userId: string, conversationId: string, newName: string): Promise<void> => {
  const convRef = doc(db, "users", userId, "folderChats", conversationId);
  await updateDoc(convRef, { chatName: newName, updatedAt: serverTimestamp() });
};

export const deleteChatConversation = async (userId: string, conversationId: string): Promise<void> => {
  const batch = writeBatch(db);
  const convRef = doc(db, "users", userId, "folderChats", conversationId);

  const messagesQuery = query(collection(convRef, "messages"));
  const messagesSnap = await getDocs(messagesQuery);
  for (const msgDoc of messagesSnap.docs) {
      const msgData = msgDoc.data();
      if (msgData.imageMeta?.storagePath) { deleteObject(ref(storage, msgData.imageMeta.storagePath)).catch(e => console.warn("Non-critical: Failed to delete image from storage:", e)); }
      if (msgData.attachedFilesMeta) {
          (msgData.attachedFilesMeta as AttachedFileMeta[]).forEach((file) => {
              if (file.storagePath) { deleteObject(ref(storage, file.storagePath)).catch(e => console.warn("Non-critical: Failed to delete file from storage:", e)); }
          });
      }
      batch.delete(msgDoc.ref);
  }
  batch.delete(convRef);
  await batch.commit();
};


export const uploadBase64ImageToStorage = async (
    userId: string,
    conversationId: string,
    base64Data: string,
    mimeType: string,
    fileName: string
): Promise<{ downloadURL: string; storagePath: string }> => {
    const extension = mimeType.split('/')[1] || 'png';
    const uniqueFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}.${extension}`;
    const storagePath = `users/${userId}/folderChats/${conversationId}/images/${uniqueFileName}`;
    const imageRef = ref(storage, storagePath);

    await uploadString(imageRef, base64Data, 'base64', { contentType: mimeType });
    const downloadURL = await getDownloadURL(imageRef);
    return { downloadURL, storagePath };
};

export const uploadFileToStorage = async (
    userId: string,
    conversationId: string,
    file: File
): Promise<{ downloadURL: string; storagePath: string; name: string; type: string; size: number }> => {
    const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storagePath = `users/${userId}/folderChats/${conversationId}/attachments/${uniqueFileName}`;
    const fileRef = ref(storage, storagePath);

    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);
    return { downloadURL, storagePath, name: file.name, type: file.type, size: file.size };
};

export const findItemByNameInFolder = async (
    collectionNameIgnored: 'items',
    userId: string,
    folderId: string,
    itemName: string,
    nameField: 'term' | 'question'
): Promise<string | null> => {
    if (!userId || !folderId || !itemName || !nameField) return null;
    try {
        const itemsRef = collection(db, "users", userId, "folders", folderId, "items");
        const q = query(itemsRef, where(nameField, "==", itemName.trim()), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id;
        }
        return null;
    } catch (error) {
        console.error(`Error finding item by name in ${folderId}:`, error);
        return null;
    }
};

export const updateFolderPointsAndLevel = async (userId: string, folderId: string, pointsToAdd: number): Promise<void> => {
    const folderRef = doc(db, "users", userId, "folders", folderId);
    await runTransaction(db, async (transaction) => {
        const folderSnap = await transaction.get(folderRef);
        if (!folderSnap.exists()) throw new Error("Folder not found");
        const currentPoints = folderSnap.data().points || 0;
        const newPoints = currentPoints + pointsToAdd;
        const newLevel = calculateUserLevel(newPoints); // Use renamed import
        transaction.update(folderRef, {
            points: newPoints,
            level: newLevel,
            updatedAt: serverTimestamp()
        });
    });
};

export const updateFolderStreak = async (userId: string, folderId: string): Promise<{ newStreakCount: number; streakBroken: boolean }> => {
  const folderRef = doc(db, "users", userId, "folders", folderId);
  return runTransaction(db, async (transaction) => {
    const folderSnap = await transaction.get(folderRef);
    if (!folderSnap.exists()) throw new Error("Folder not found");
    const currentFolder = folderSnap.data() as FolderData; // Assuming raw data
    let currentStreak = currentFolder.dailyStreakCount || 0;
    const lastUpdate = currentFolder.lastStreakUpdate ? toDateSafeInternal(currentFolder.lastStreakUpdate) : null;
    const now = new Date();
    let streakBroken = false;

    if (lastUpdate) {
      const lastUpdateDateOnly = new Date(lastUpdate.getFullYear(), lastUpdate.getMonth(), lastUpdate.getDate());
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = todayDateOnly.getTime() - lastUpdateDateOnly.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) { currentStreak++; }
      else if (diffDays > 1) { currentStreak = 1; streakBroken = true; }
      // If diffDays is 0 or negative, streak doesn't change
    } else { currentStreak = 1; } // First activity

    transaction.update(folderRef, {
      dailyStreakCount: currentStreak,
      lastStreakUpdate: Timestamp.fromDate(now),
      lastStudiedAt: Timestamp.fromDate(now),
      updatedAt: serverTimestamp()
    });
    return { newStreakCount: currentStreak, streakBroken };
  });
};

export const addOrUpdateStudyGoal = async (userId: string, folderId: string, goal: StudyGoal): Promise<void> => {
    const folderRef = doc(db, "users", userId, "folders", folderId);
    await runTransaction(db, async (transaction) => {
        const folderSnap = await transaction.get(folderRef);
        if (!folderSnap.exists()) throw new Error("Folder not found");
        const currentGoals = (folderSnap.data().studyGoals || []).map((g: any) => ({ ...g, createdAt: toDateSafeInternal(g.createdAt) })) as StudyGoal[];

        const goalToSave = {...goal, createdAt: goal.createdAt instanceof Date ? Timestamp.fromDate(goal.createdAt) : serverTimestamp()}; // Store as Timestamp

        const existingGoalIndex = currentGoals.findIndex(g => g.id === goal.id);

        if (existingGoalIndex > -1) {
            currentGoals[existingGoalIndex] = goalToSave as StudyGoal; // Type assertion after conversion
        } else {
            currentGoals.push(goalToSave as StudyGoal);
        }
        transaction.update(folderRef, { studyGoals: currentGoals, updatedAt: serverTimestamp() });
    });
};

export const updateStudyGoalProgress = async (userId: string, folderId: string, goalIdOrType: string, progressIncrement: number, goalType?: 'flashcards_mastered' | 'items_reviewed' | 'time_spent_minutes'): Promise<void> => {
    const folderRef = doc(db, "users", userId, "folders", folderId);
     await runTransaction(db, async (transaction) => {
        const folderSnap = await transaction.get(folderRef);
        if (!folderSnap.exists()) throw new Error("Folder not found");
        let currentGoals = (folderSnap.data().studyGoals || []).map((g: any) => ({ ...g, createdAt: toDateSafeInternal(g.createdAt) })) as StudyGoal[];
        
        let goalsToUpdate = currentGoals.filter(g => g.id === goalIdOrType || (goalType && g.type === goalType && !g.isCompleted));

        if (goalsToUpdate.length > 0) {
            goalsToUpdate.forEach(goal => {
                const goalIndex = currentGoals.findIndex(g => g.id === goal.id);
                if (goalIndex > -1) {
                    currentGoals[goalIndex].currentProgress = (currentGoals[goalIndex].currentProgress || 0) + progressIncrement;
                    if (currentGoals[goalIndex].currentProgress >= currentGoals[goalIndex].target) {
                        currentGoals[goalIndex].isCompleted = true;
                    }
                }
            });
            // Convert Date objects back to Timestamps for storage
            const goalsForFirestore = currentGoals.map(g => ({...g, createdAt: g.createdAt ? Timestamp.fromDate(g.createdAt) : serverTimestamp() }));
            transaction.update(folderRef, { studyGoals: goalsForFirestore, updatedAt: serverTimestamp() });
        }
    });
};

export const calculateAndUpdateFolderMemoryScore = async (userId: string, folderId: string): Promise<void> => {
    const itemsRef = collection(db, "users", userId, "folders", folderId, "items");
    const itemsSnap = await getDocs(itemsRef);
    if (itemsSnap.empty) {
        await setDoc(doc(db, "users", userId, "folders", folderId), { memoryScore: 0, avgMasteryLevel: 0, updatedAt: serverTimestamp() }, { merge: true });
        return;
    }
    let totalMasteryValue = 0;
    const masteryMap = { 'new': 0, 'learning': 1, 'familiar': 2, 'mastered': 3 };

    itemsSnap.docs.forEach(docSnap => {
        const item = convertDocToFolderItem(docSnap); // This now returns Date objects
        totalMasteryValue += masteryMap[item.masteryLevel || 'new'];
    });

    const avgMastery = itemsSnap.size > 0 ? totalMasteryValue / itemsSnap.size : 0;
    const memoryScore = Math.round((avgMastery / 3) * 100);

    await setDoc(doc(db, "users", userId, "folders", folderId), {
        memoryScore: memoryScore,
        avgMasteryLevel: parseFloat(avgMastery.toFixed(2)),
        updatedAt: serverTimestamp()
    }, { merge: true });
};
