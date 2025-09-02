import { FormEvent, useEffect } from 'react';
import { auth, ensureUserDocument } from '../lib/login-firebase';
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';

export function useLoginAuth() {
  const handleUserAuthentication = async (user: any) => {
    try {
      // Use ensureUserDocument which properly handles profile picture preferences
      await ensureUserDocument(user);
    } catch (error) {
      console.error("Error handling user authentication:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        handleUserAuthentication(user);
        window.addEventListener('beforeunload', () => {
          // Note: We can't update online status to false here because ensureUserDocument
          // doesn't handle online status. This is fine as online status tracking
          // should be handled separately from core profile data.
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await handleUserAuthentication(user);
      window.location.href = "/dashboard";
    } catch (error: any) {
      const errorCode = error.code;
      switch (errorCode) {
        case "auth/popup-closed-by-user":
          alert("Google login canceled.");
          break;
        case "auth/cancelled-popup-request":
          alert("Google login canceled.");
          break;
        case "auth/network-request-failed":
          alert("Network error. Please check your internet connection and try again.");
          break;
        default:
          console.error('Error with Google Sign-In:', errorCode, error.message);
          alert(`Unexpected error with Google Sign-In: ${errorCode}. Please try again.`);
      }
    }
  };

  const handleEmailSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await handleUserAuthentication(user);
      window.location.href = "/dashboard";
    } catch (error: any) {
      const errorCode = error.code;
      switch (errorCode) {
        case "auth/wrong-password":
          alert("Incorrect password. Please try again.");
          break;
        case "auth/user-not-found":
          alert("No user found with this email. Please check your email address.");
          break;
        case "auth/invalid-email":
          alert("The email address is not valid. Please check and try again.");
          break;
        case "auth/invalid-credential":
          alert("Invalid credentials. Please try again or reset your password.");
          break;
        default:
          console.error('Error signing in:', errorCode, error.message);
          alert(`Unexpected error signing in: ${errorCode} - ${error.message}`);
      }
    }
  };

  return {
    handleGoogleSignIn,
    handleEmailSignIn
  };
}
