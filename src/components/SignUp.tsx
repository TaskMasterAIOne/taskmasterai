import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { 
    createUserWithEmailAndPassword, 
    updateProfile,
    GoogleAuthProvider, 
    signInWithPopup,
    User
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
} from 'firebase/firestore';
import { prepareInitialProfileData } from '../lib/current-paying-user';

export function SignUpForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); 
    setError(''); 
    setLoading(true);
    try { 
      const result = await createUserWithEmailAndPassword(auth, email, password); 
      const user = result.user; 
      const fullName = `${firstName.trim()} ${lastName.trim()}`; 
      await updateProfile(user, { displayName: fullName }); 
      
      const userDocRef = doc(db, "users", user.uid); 
      const initialData = prepareInitialProfileData(user.uid, user.email, fullName, user.photoURL, firstName, lastName);
      
      await setDoc(userDocRef, {
          ...initialData,
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      }); 
      
      navigate('/onboarding'); 
    }
    catch (err: any) { 
      if (err.code === 'auth/email-already-in-use') setError('This email address is already in use.'); 
      else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters long.'); 
      else setError('Failed to create account. Please try again.'); 
      console.error("Sign up error:", err); 
    }
    finally { 
      setLoading(false); 
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <label htmlFor="firstName" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">First name</label>
          <input 
            type="text" 
            id="firstName" 
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2A2F3B] border border-gray-300 dark:border-gray-700/60 text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 focus:border-indigo-500 dark:focus:border-purple-500 transition-colors duration-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm" 
            value={firstName} 
            onChange={(e) => setFirstName(e.target.value)} 
            required 
            aria-required="true" />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Last name</label>
          <input 
            type="text" 
            id="lastName" 
            className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2A2F3B] border border-gray-300 dark:border-gray-700/60 text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 focus:border-indigo-500 dark:focus:border-purple-500 transition-colors duration-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm" 
            value={lastName} 
            onChange={(e) => setLastName(e.target.value)} 
            required 
            aria-required="true" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
        <input 
          type="email" 
          id="email" 
          className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2A2F3B] border border-gray-300 dark:border-gray-700/60 text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 focus:border-indigo-500 dark:focus:border-purple-500 transition-colors duration-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm" 
          placeholder="name@example.com" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          aria-required="true" />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
        <input 
          type="password" 
          id="password" 
          className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2A2F3B] border border-gray-300 dark:border-gray-700/60 text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 focus:border-indigo-500 dark:focus:border-purple-500 transition-colors duration-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm" 
          placeholder="••••••••" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          aria-required="true" 
          minLength={6} />
      </div>
      {error && <p className="text-sm text-center -mt-2 text-red-600 dark:text-red-400">{error}</p>}
      <button 
        type="submit" 
        disabled={loading} 
        className="w-full py-3.5 mt-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-700 dark:hover:to-indigo-700 text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D] focus:ring-indigo-500 dark:focus:ring-purple-500 text-sm" >
        {loading ? <Loader2 className="animate-spin h-5 w-5 text-white mx-auto" /> : 'Create an account'}
      </button>
    </form>
  );
}

export function GoogleSignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const saveOrUpdateUserData = async (user: User) => {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const docSnap = await getDoc(userDocRef);
      const name = user.displayName || "Anonymous User";
      const photoURL = user.photoURL || null;
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ');


      if (!docSnap.exists()) {
        const initialData = prepareInitialProfileData(user.uid, user.email, name, photoURL, firstName, lastName);
        await setDoc(userDocRef, {
            ...initialData,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userDocRef, {
          name: name,
          displayName: name,
          email: user.email,
          photoURL: photoURL,
          lastLoginAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error saving or updating user data:", err);
      throw err;
    }
  };

  const handleGoogleSignUp = async () => {
    setError(''); 
    setLoading(true);
    try { 
      const provider = new GoogleAuthProvider(); 
      const result = await signInWithPopup(auth, provider); 
      await saveOrUpdateUserData(result.user); 
      navigate('/onboarding'); 
    }
    catch (err: any) { 
      if (err.code === 'auth/popup-closed-by-user') { 
        console.log('Google Sign-In popup closed by user.'); 
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email using a different sign-in method.'); 
      } else { 
        setError("Google sign-up failed. Please try again."); 
        console.error("Google sign up failed", err); 
      } 
    }
    finally { 
      setLoading(false); 
    }
  };

  return (
    <>
      <button
        onClick={handleGoogleSignUp}
        disabled={loading}
        className="w-full py-3.5 mb-4 bg-white hover:bg-gray-50 dark:bg-[#2A2F3B] dark:hover:bg-gray-700/70 border border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-200 font-medium rounded-full flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D] focus:ring-indigo-500 dark:focus:ring-purple-500 text-sm"
      >
        {loading ? (
             <Loader2 className="animate-spin h-5 w-5 text-indigo-500 dark:text-purple-400" />
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
      {error && <p className="text-sm text-center -mt-2 mb-4 text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}

function SignUp() {
  const [effectiveDarkMode, setEffectiveDarkMode] = useState(() => {
    const isIlluminateEnabledItem = localStorage.getItem('isIlluminateEnabled');
    const isIlluminateEnabled = isIlluminateEnabledItem ? JSON.parse(isIlluminateEnabledItem) : false;
    if (isIlluminateEnabled) {
        return false; 
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  React.useEffect(() => {
    const applyAndSetTheme = () => {
        const isIlluminateEnabledItem = localStorage.getItem('isIlluminateEnabled');
        const isIlluminateEnabled = isIlluminateEnabledItem ? JSON.parse(isIlluminateEnabledItem) : false;
        let currentIsDark: boolean;

        if (isIlluminateEnabled) {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            currentIsDark = false;
        } else {
            document.documentElement.classList.remove('light');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
                currentIsDark = true;
            } else {
                document.documentElement.classList.remove('dark');
                currentIsDark = false;
            }
        }
        setEffectiveDarkMode(prevMode => prevMode !== currentIsDark ? currentIsDark : prevMode);
    };

    applyAndSetTheme(); 

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyAndSetTheme);
    
    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'isIlluminateEnabled') {
            applyAndSetTheme();
        }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
        mediaQuery.removeEventListener('change', applyAndSetTheme);
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []); 

  const isIlluminateActive = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
  const cardShadow = effectiveDarkMode && !isIlluminateActive
    ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 20px 40px -10px rgba(128, 90, 213, 0.15)' 
    : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';

  return (
    <div className="min-h-screen font-poppins flex flex-col bg-gray-100 text-gray-900 dark:bg-[#0C0E1A] dark:text-gray-200">
      <header className="py-6 px-4 sm:px-6 h-20"></header>
      <main className="flex flex-grow items-center justify-center px-4 py-8">
        <div 
            className="w-full max-w-md bg-white dark:bg-[#12141D] p-8 sm:p-10 rounded-2xl border border-gray-300 dark:border-gray-700/50 shadow-2xl"
            style={{ boxShadow: cardShadow }} 
        >
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-2">Sign Up</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm whitespace-nowrap"> Learn in minutes. No credit card required. </p>
          
          <GoogleSignUp /> 
          
          <div className="flex items-center my-7"> 
            <hr className="flex-grow border-t border-gray-300 dark:border-gray-600/80" /> 
            <span className="mx-4 text-gray-400 dark:text-gray-500 text-xs font-semibold tracking-wider">OR</span> 
            <hr className="flex-grow border-t border-gray-300 dark:border-gray-600/80" /> 
          </div>
          
          <SignUpForm /> 
          
          <div className="text-center mt-8"> 
            <p className="text-sm text-gray-600 dark:text-gray-400"> 
              Already have an account?{' '} 
              <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200"> Sign in </a> 
            </p> 
          </div>
        </div>
      </main>
      <footer className="py-8 bg-gray-100 dark:bg-[#0C0E1A]"> 
        <div className="text-center text-xs text-gray-500 px-4">
          <p className="whitespace-nowrap overflow-hidden text-ellipsis sm:whitespace-normal"> 
            By creating or entering an account, you agree to the{' '} 
            <a href="/terms" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200"> Terms of Service </a>{' '} 
            and{' '} 
            <a href="/privacy-policy" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200"> Privacy Policy </a> . 
          </p> 
        </div> 
      </footer>
    </div>
  );
}
export default SignUp;
