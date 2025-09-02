// src/lib/login-firebase.ts

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail, // Renamed to avoid conflict
  UserCredential, // Type for result of signIn methods
  User // Type for the user object
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, Timestamp, updateDoc } from 'firebase/firestore'; // Added getDoc, Timestamp, updateDoc

// Import the correctly initialized auth and db from your central firebase.ts
// This assumes firebase.ts is in the same src/lib/ directory.
import { auth as firebaseAuth, db } from './firebase';
import { prepareInitialProfileData } from './current-paying-user';

// Re-export auth for use in other files
export const auth = firebaseAuth;

// DO NOT INITIALIZE APP OR CONFIG HERE
// const app = initializeApp(firebaseConfig); <--- REMOVED
// export const auth = getAuth(app); <--- REMOVED (using imported auth)
// export const db = getFirestore(app); <--- REMOVED (using imported db)

/**
 * Ensures a user document exists in Firestore with essential details.
 * Creates the document if it doesn't exist, or updates last login time.
 * @param user The Firebase Auth User object.
 */
export async function ensureUserDocument(user: User): Promise<void> {
  const userDocRef = doc(db, 'users', user.uid);
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) {
        // Document doesn't exist, create it
        const [firstName, ...lastNameParts] = (user.displayName || user.email?.split('@')[0] || "New User").split(' ');
        const lastName = lastNameParts.join(' ');
        const initialData = prepareInitialProfileData(
          user.uid, 
          user.email, 
          user.displayName, 
          user.photoURL, 
          firstName, 
          lastName
        );
        
        // Use setDoc with merge to avoid conflicts if document was created elsewhere
        await setDoc(userDocRef, {
          ...initialData,
          createdAt: Timestamp.fromDate(new Date()),
          lastLoginAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        }, { merge: true });
      } else {
        // Document exists, update last login time and potentially name, but respect profile picture preferences
        const existingData = docSnap.data();
        const updateData = {
          lastLoginAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
          ...(user.displayName && user.displayName !== existingData?.name && { name: user.displayName }),
        };
        
        // Only update photoURL if:
        // 1. User has a photoURL from Google AND
        // 2. Current stored photoURL is not explicitly null (user didn't remove it) AND  
        // 3. The photoURL is actually different
        if (user.photoURL && 
            existingData?.photoURL !== null && 
            user.photoURL !== existingData?.photoURL) {
          updateData.photoURL = user.photoURL;
        }
        
        // Use setDoc with merge to handle race conditions gracefully
        await setDoc(userDocRef, updateData, { merge: true });
      }
      
      // Success - break out of retry loop
      break;
      
    } catch (error: any) {
      console.error(`Error ensuring user document (attempt ${retryCount + 1}):`, error);
      
      if (error?.code === 'failed-precondition' && retryCount < maxRetries - 1) {
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        continue;
      }
      
      // If it's not a retryable error or we've exhausted retries, log and continue
      // Don't throw to avoid breaking the login flow
      console.error("Failed to ensure user document after retries:", error);
      break;
    }
  }
}


// Your existing saveUserData (can be kept if used elsewhere, but ensureUserDocument is more comprehensive for login)
// Note: ensureUserDocument provides more fields. You might want to consolidate.
export const saveUserData = async (user: User) => { // Use User type
  try {
    await setDoc(doc(db, "users", user.uid), { // Use imported db
      uid: user.uid,
      email: user.email,
      name: user.displayName || "Anonymous", // Consider consistency with ensureUserDocument
      displayName: user.displayName || "Anonymous",
      photoURL: user.photoURL || ""
    });
  } catch (error) {
    console.error("Error saving user data (via saveUserData):", error);
  }
};

// Google Sign-In Function
export const googleSignIn = async (): Promise<User | null> => {
  const provider = new GoogleAuthProvider();
  try {
    const result: UserCredential = await signInWithPopup(auth, provider); // Use imported auth
    const user = result.user;
    if (user) {
      await ensureUserDocument(user); // Ensure Firestore document is up-to-date
    }
    return user;
  } catch (error) {
    console.error("Error with Google Sign-In:", error);
    // Handle specific errors like 'auth/popup-closed-by-user' if desired
    // For example:
    // if ((error as any).code === 'auth/popup-closed-by-user') {
    //   // popup closed by user
    //   return null; // Or handle as you see fit
    // }
    throw error; // Re-throw for the calling component to handle
  }
};

// Email/Password Sign-In Function
export const emailSignIn = async (email: string, password: string): Promise<User | null> => {
  try {
    const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password); // Use imported auth
    const user = userCredential.user;
    if (user) {
      await ensureUserDocument(user); // Ensure Firestore document is up-to-date
    }
    return user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error; // Re-throw for the calling component to handle
  }
};

// Password Reset Function
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  try {
    await firebaseSendPasswordResetEmail(auth, email, { // Use imported auth
      // Customize the redirect URL as needed, typically back to your login page
      // or a dedicated password reset confirmation page.
      url: `${window.location.origin}/login?resetPasswordSuccess=true`, // Example
      handleCodeInApp: false // If true, you'd handle the oobCode yourself in the app
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error; // Re-throw for the calling component to handle
  }
};
