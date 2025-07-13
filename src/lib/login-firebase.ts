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
import { auth, db } from './firebase';

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
  const userDocRef = doc(db, 'users', user.uid); // Use imported db
  try {
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
      // Document doesn't exist, create it
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || "New User",
        photoURL: user.photoURL || '',
        createdAt: Timestamp.fromDate(new Date()),
        lastLoginAt: Timestamp.fromDate(new Date()),
        // Add any other default fields for new users
      });
    } else {
      // Document exists, update last login time and potentially name/photoURL
      await updateDoc(userDocRef, {
        lastLoginAt: Timestamp.fromDate(new Date()),
        ...(user.photoURL && user.photoURL !== docSnap.data()?.photoURL && { photoURL: user.photoURL }),
        ...(user.displayName && user.displayName !== docSnap.data()?.name && { name: user.displayName }),
      });
    }
  } catch (error) {
    console.error("Error ensuring user document:", error);
    // Decide if you want to re-throw or handle silently
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
    //   console.log('Google sign-in popup closed by user.');
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
