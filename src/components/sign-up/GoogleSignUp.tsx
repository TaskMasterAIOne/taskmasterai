import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface GoogleSignUpProps {
  isDarkMode: boolean;
}

export function GoogleSignUp({ isDarkMode }: GoogleSignUpProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const saveOrUpdateUserData = async (user: any) => {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      const name = user.displayName || user.providerData[0]?.displayName || "Anonymous User";
      const photoURL = user.photoURL || user.providerData[0]?.photoURL || null;

      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid, email: user.email, name: name, displayName: name, photoURL: photoURL,
          createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), tokens: 500,
          uploadBonusCount: 0, abuseWarningCount: 0,
        });
      } else {
        await updateDoc(userDocRef, {
          name: name, displayName: name, email: user.email, photoURL: photoURL,
          lastLoginAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error saving or updating user data:", error);
      throw error;
    }
  };

  const handleGoogleSignUp = async () => {
    setError(''); setLoading(true);
    try { const provider = new GoogleAuthProvider(); const result = await signInWithPopup(auth, provider); await saveOrUpdateUserData(result.user); navigate('/splashscreen'); }
    catch (error: any) { if (error.code === 'auth/popup-closed-by-user') { console.log('Google Sign-In popup closed by user.'); } else if (error.code === 'auth/account-exists-with-different-credential') setError('An account already exists with this email using a different sign-in method.'); else { setError("Google sign-up failed. Please try again."); console.error("Google sign up failed", error); } }
    finally { setLoading(false); }
  };

  const buttonBgClass = isDarkMode ? 'bg-[#2A2F3B] hover:bg-gray-700/70' : 'bg-white hover:bg-gray-50';
  const buttonBorderClass = isDarkMode ? 'border-gray-700/60' : 'border-gray-300';
  const buttonTextColorClass = isDarkMode ? 'text-gray-200' : 'text-gray-700';
  const focusOffsetClass = isDarkMode ? 'focus:ring-offset-[#16181D]' : 'focus:ring-offset-white';
  const focusRingClass = isDarkMode ? 'focus:ring-purple-500' : 'focus:ring-indigo-500';
  const errorTextClass = isDarkMode ? "text-red-400" : "text-red-600";
  const loaderColorClass = isDarkMode ? "text-purple-400" : "text-indigo-500";

  return (
    <>
      <button
        onClick={handleGoogleSignUp}
        disabled={loading}
        className={`w-full py-3.5 mb-4 border ${buttonBorderClass} ${buttonTextColorClass} ${buttonBgClass} font-medium rounded-full flex items-center justify-center gap-3 
                   transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed 
                   focus:outline-none focus:ring-2 ${focusOffsetClass} ${focusRingClass} text-sm`}
      >
        {loading ? (
             <Loader2 className={`animate-spin h-5 w-5 ${loaderColorClass}`} />
        ) : (
         <>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            Continue with Google
         </>
        )}
      </button>
      {error && <p className={`text-sm text-center -mt-2 mb-4 ${errorTextClass}`}>{error}</p>}
    </>
  );
}