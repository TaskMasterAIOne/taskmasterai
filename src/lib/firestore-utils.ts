// src/lib/firestore-utils.ts
// Utility functions for handling Firestore operations with proper error handling and race condition prevention

import { doc, setDoc, serverTimestamp, DocumentReference } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Safely updates a user document with retry logic and merge operations to handle race conditions.
 * This function helps prevent the failed-precondition errors that occur when multiple operations
 * try to update the same document simultaneously.
 * 
 * @param userId - The user ID
 * @param updateData - The data to update
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<void>
 */
export async function safeUpdateUserDocument(
  userId: string, 
  updateData: Record<string, any>, 
  maxRetries: number = 3
): Promise<void> {
  const userDocRef = doc(db, 'users', userId);
  let retryCount = 0;
  
  // Always add updatedAt timestamp
  const dataWithTimestamp = {
    ...updateData,
    updatedAt: serverTimestamp()
  };
  
  while (retryCount < maxRetries) {
    try {
      // Use setDoc with merge to handle race conditions gracefully
      await setDoc(userDocRef, dataWithTimestamp, { merge: true });
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      console.error(`Error updating user document (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff + jitter
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, log and throw
      console.error("Failed to update user document after retries:", error);
      throw error;
    }
  }
}

/**
 * Safely updates any Firestore document with retry logic and merge operations.
 * 
 * @param docRef - The document reference
 * @param updateData - The data to update
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<void>
 */
export async function safeUpdateDocument(
  docRef: DocumentReference, 
  updateData: Record<string, any>, 
  maxRetries: number = 3
): Promise<void> {
  let retryCount = 0;
  
  // Always add updatedAt timestamp
  const dataWithTimestamp = {
    ...updateData,
    updatedAt: serverTimestamp()
  };
  
  while (retryCount < maxRetries) {
    try {
      // Use setDoc with merge to handle race conditions gracefully
      await setDoc(docRef, dataWithTimestamp, { merge: true });
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      console.error(`Error updating document (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff + jitter
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, log and throw
      console.error("Failed to update document after retries:", error);
      throw error;
    }
  }
}

/**
 * Safely creates or updates a user document, handling race conditions that can occur
 * during user registration or login processes.
 * 
 * @param userId - The user ID
 * @param userData - The user data to set
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<void>
 */
export async function safeCreateOrUpdateUserDocument(
  userId: string, 
  userData: Record<string, any>, 
  maxRetries: number = 3
): Promise<void> {
  const userDocRef = doc(db, 'users', userId);
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Use setDoc with merge to safely create or update
      await setDoc(userDocRef, {
        ...userData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      console.error(`Error creating/updating user document (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff + jitter
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, log and throw
      console.error("Failed to create/update user document after retries:", error);
      throw error;
    }
  }
}
