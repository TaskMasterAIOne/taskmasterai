import { 
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  signOut,
  User,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';
import { UserProfileData } from './current-paying-user';

interface UpdateProfileData {
  name?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  photoFile?: File;
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
    const possibleExtensions = ['jpg', 'jpeg', 'png'];
    for (const ext of possibleExtensions) {
      const profilePicRef = ref(storage, `profile_pictures/${userId}.${ext}`);
      try {
          await deleteObject(profilePicRef);
      } catch (error: any) {
          if (error.code !== 'storage/object-not-found') {
              throw error;
          }
      }
    }
    await updateProfile(user, { photoURL: null });
    await updateDoc(doc(db, 'users', userId), {
      photoURL: null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    throw new AuthError('Failed to delete profile picture');
  }
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
      await updateDoc(doc(db, 'users', user.uid), firestoreUpdates);
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
    await signOut(auth);
  } catch (error) {
    throw new AuthError('Failed to sign out');
  }
};

export const deleteUserAccount = async (currentPassword?: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new AuthError('No user logged in');

  try {
    const isGoogle = user.providerData?.some((p) => p.providerId === 'google.com');
    if (!isGoogle) {
      if (!currentPassword) {
        throw new AuthError('Current password is required to delete your account');
      }
      await reauthenticateUser(currentPassword);
    }
    await deleteProfilePicture(user.uid).catch(() => {});
    await deleteDoc(doc(db, 'users', user.uid));
    await deleteUser(user);
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
