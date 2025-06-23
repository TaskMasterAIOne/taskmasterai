import { db } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

export interface Memory {
  id: string;
  userId: string;
  content: string;
  createdAt: Timestamp;
}

export const saveMemory = async (userId: string, content: string): Promise<string> => {
  if (!userId || !content.trim()) {
    throw new Error('User ID and memory content are required.');
  }
  const memoriesCollectionRef = collection(db, 'users', userId, 'memories');
  const docRef = await addDoc(memoriesCollectionRef, {
    content: content.trim(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getMemories = async (userId: string, count: number = 15): Promise<Memory[]> => {
  if (!userId) {
    return [];
  }
  const memoriesCollectionRef = collection(db, 'users', userId, 'memories');
  const q = query(memoriesCollectionRef, orderBy('createdAt', 'desc'), limit(count));
  const querySnapshot = await getDocs(q);

  const memories: Memory[] = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    memories.push({
      id: doc.id,
      userId,
      content: data.content,
      createdAt: data.createdAt as Timestamp,
    });
  });

  return memories;
};

export const updateMemory = async (userId: string, memoryId: string, newContent: string): Promise<void> => {
  if (!userId || !memoryId || !newContent.trim()) {
    throw new Error('User ID, Memory ID, and new content are required to update.');
  }
  const memoryDocRef = doc(db, 'users', userId, 'memories', memoryId);
  await updateDoc(memoryDocRef, {
    content: newContent.trim(),
  });
};

export const deleteMemory = async (userId: string, memoryId: string): Promise<void> => {
  if (!userId || !memoryId) {
    throw new Error('User ID and Memory ID are required for deletion.');
  }
  const memoryDocRef = doc(db, 'users', userId, 'memories', memoryId);
  await deleteDoc(memoryDocRef);
};
