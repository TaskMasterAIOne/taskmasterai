import { 
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  signOut,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, updateDoc, deleteDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { UserProfileData } from './current-paying-user';

interface UpdateProfileData {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  photoFile?: File;
  defaultChatStyle?: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const reauthenticateUser = async (currentPassword: string) => {
  const user = auth.currentUser;
  if (!user?.email) throw new AuthError('No user email found');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (error: any) {
    throw new AuthError('Current password is incorrect');
  }
};

export const getUserData = async (userId: string): Promise<UserProfileData | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data() as UserProfileData;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
};

const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const profilePicRef = ref(storage, `profile_pictures/${userId}.${fileExtension}`);
  try {
    const snapshot = await uploadBytes(profilePicRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    throw new AuthError('Failed to upload profile picture');
  }
};

export const deleteProfilePicture = async (userId: string) => {
  const user = auth.currentUser;
  if (!user) throw new AuthError('No user logged in');

  try {
    // Delete from storage - only try to delete the actual file that exists
    const possibleExtensions = ['jpg', 'jpeg', 'png'];
    let deletedCount = 0;
    
    for (const ext of possibleExtensions) {
      const profilePicRef = ref(storage, `profile_pictures/${userId}.${ext}`);
      try {
          await deleteObject(profilePicRef);
          deletedCount++;
          break; // Exit loop once we successfully delete one file
      } catch (error: any) {
          if (error.code !== 'storage/object-not-found') {
              throw error;
          }
          // Silently continue if file doesn't exist
      }
    }
    
    // Update Firebase Auth profile
    await updateProfile(user, { photoURL: null });
    
    // Update Firestore document using setDoc with merge to handle race conditions
    await setDoc(doc(db, 'users', userId), {
      photoURL: null,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Reload user to ensure auth state is updated
    await user.reload();
    
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw new AuthError('Failed to delete profile picture');
  }
};

export const getDefaultChatStyle = async (userId: string): Promise<string | null> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.defaultChatStyle || null;
    }
    return null;
  } catch (error) {
    console.error('Error fetching default chat style:', error);
    return null;
  }
};

export const setDefaultChatStyle = async (userId: string, styleName: string): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      defaultChatStyle: styleName,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error setting default chat style:', error);
    throw new AuthError('Failed to set default chat style');
  }
};

export const getThinkHarderEnabled = async (userId: string): Promise<boolean> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.thinkHarderEnabled || false;
    }
    return false;
  } catch (error) {
    console.error('Error fetching Reasoning setting:', error);
    return false;
  }
};

export const setThinkHarderEnabled = async (userId: string, enabled: boolean): Promise<void> => {
  const maxRetries = 5;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const userDocRef = doc(db, 'users', userId);
      
      // Use setDoc with merge to avoid conflicts with other concurrent updates
      await setDoc(userDocRef, {
        thinkHarderEnabled: enabled,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      return; // Success, exit the function
    } catch (error: any) {
      retryCount++;
      
      // If it's a failed-precondition error and we haven't exceeded retries, wait and try again
      if ((error.code === 'failed-precondition' || error.code === 'aborted') && retryCount < maxRetries) {
        console.warn(`Firestore conflict on reasoning setting update, retry ${retryCount}/${maxRetries}`);
        // Exponential backoff delay with jitter
        const delay = Math.pow(2, retryCount) * 100 + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error('Error setting Reasoning setting:', error);
      throw new AuthError('Failed to set Reasoning setting');
    }
  }
  
  throw new AuthError('Failed to set Reasoning setting after multiple retries');
};

export const updateUserProfile = async (
  userId: string,
  updateData: UpdateProfileData
): Promise<User | null> => {
  const user = auth.currentUser;
  if (!user || user.uid !== userId) throw new AuthError('User not authenticated correctly.');

  try {
    if ((updateData.email || updateData.newPassword) && updateData.currentPassword) {
      await reauthenticateUser(updateData.currentPassword);
    }

    const authUpdates: { displayName?: string; photoURL?: string } = {};
    const firestoreUpdates: Record<string, any> = { updatedAt: serverTimestamp() };

    if (updateData.photoFile) {
      const photoURL = await uploadProfilePicture(user.uid, updateData.photoFile);
      authUpdates.photoURL = photoURL;
      firestoreUpdates.photoURL = photoURL;
    }

    if (updateData.name && updateData.name !== user.displayName) {
      authUpdates.displayName = updateData.name;
      firestoreUpdates.name = updateData.name;
      firestoreUpdates.displayName = updateData.name;
    }
    
    if (Object.keys(authUpdates).length > 0) {
        await updateProfile(user, authUpdates);
    }
    
    if (updateData.email && updateData.email !== user.email) {
      await updateEmail(user, updateData.email);
      firestoreUpdates.email = updateData.email;
    }

    if (updateData.newPassword) {
      await updatePassword(user, updateData.newPassword);
    }

    if (Object.keys(firestoreUpdates).length > 1) {
      // Use setDoc with merge to handle race conditions gracefully
      await setDoc(doc(db, 'users', user.uid), firestoreUpdates, { merge: true });
    }
    
    await user.reload();
    return auth.currentUser;

  } catch (error: any) {
    if (error instanceof AuthError) throw error;
    switch (error.code) {
      case 'auth/requires-recent-login':
        throw new AuthError('Please sign in again to perform this action.');
      case 'auth/email-already-in-use':
        throw new AuthError('This email address is already in use.');
      case 'auth/invalid-email':
        throw new AuthError('The email address is not valid.');
      case 'auth/weak-password':
        throw new AuthError('Password must be at least 6 characters long.');
      default:
        console.error('Update profile error:', error);
        throw new AuthError('An unexpected error occurred while updating the profile.');
    }
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    // Set a flag in localStorage to signal other tabs
    localStorage.setItem('auth_signout_event', Date.now().toString());
    await signOut(auth);
    // Clean up the event flag after a short delay
    setTimeout(() => {
      localStorage.removeItem('auth_signout_event');
    }, 1000);
  } catch (error) {
    throw new AuthError('Failed to sign out');
  }
};

export const deleteUserAccount = async (currentPassword?: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new AuthError('No user logged in');

  try {
    const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
    
    if (isGoogle) {
      // For Google users, require re-authentication via Google popup
      const provider = new GoogleAuthProvider();
      try {
        await reauthenticateWithPopup(user, provider);
      } catch (reauthError: any) {
        if (reauthError.code === 'auth/popup-closed-by-user') {
          throw new AuthError('Please complete the Google sign-in to delete your account');
        }
        throw new AuthError('Failed to verify your Google account. Please try again.');
      }
    } else {
      if (!currentPassword) {
        throw new AuthError('Current password is required to delete your account');
      }
      await reauthenticateUser(currentPassword);
    }
    
    // Set a flag in localStorage to signal other tabs before deleting account
    localStorage.setItem('auth_signout_event', Date.now().toString());
    
    await deleteProfilePicture(user.uid).catch(() => {});
    await deleteDoc(doc(db, 'users', user.uid));
    await deleteUser(user);
    
    // Clean up the event flag after a short delay
    setTimeout(() => {
      localStorage.removeItem('auth_signout_event');
    }, 1000);
  } catch (error: any) {
    if (error instanceof AuthError) throw error;
    if (error.code === 'auth/requires-recent-login') {
      throw new AuthError('Please sign in again to delete your account');
    }
    throw new AuthError('Failed to delete account');
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};
