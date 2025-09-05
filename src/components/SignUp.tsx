import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { 
    createUserWithEmailAndPassword, 
    updateProfile,
    GoogleAuthProvider, 
    signInWithPopup,
    signOut,
    User
} from 'firebase/auth';
import { auth, db, functions } from '../lib/firebase';
import { 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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
      if (err.code === 'auth/email-already-in-use') {
        setError('You already have an account with this email! Please log in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.'); 
      } else {
        setError('Failed to create account. Please try again.'); 
      }
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
          <label htmlFor="firstName" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">First name</label>
          <input 
            type="text" 
            id="firstName" 
            className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm" 
            value={firstName} 
            onChange={(e) => setFirstName(e.target.value)} 
            required 
            aria-required="true" />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Last name</label>
          <input 
            type="text" 
            id="lastName" 
            className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm" 
            value={lastName} 
            onChange={(e) => setLastName(e.target.value)} 
            required 
            aria-required="true" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
        <input 
          type="email" 
          id="email" 
          className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm" 
          placeholder="name@example.com" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          aria-required="true" />
      </div>
      <div>
        <label htmlFor="password" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
        <input 
          type="password" 
          id="password" 
          className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm" 
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
        className="w-full py-3.5 mt-1 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm" >
        {loading ? <Loader2 className="animate-spin h-5 w-5 text-white mx-auto" /> : 'Create an account'}
      </button>
    </form>
  );
}

export function GoogleSignUp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceConnected, setWorkspaceConnected] = useState(false);
  const navigate = useNavigate();

  // Handle OAuth callback on component mount
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code && state && sessionStorage.getItem('workspace_connecting')) {
        try {
          const googleOAuthCallback = httpsCallable(functions, 'googleOAuthCallback');
          await googleOAuthCallback({ code, state });
          
          setWorkspaceConnected(true);
          sessionStorage.removeItem('workspace_connecting');
          
          const isSignupFlow = sessionStorage.getItem('signup_google_workspace');
          if (isSignupFlow) {
            sessionStorage.removeItem('signup_google_workspace');
          }
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Navigate appropriately based on flow
          setTimeout(() => {
            if (isSignupFlow) {
              navigate('/onboarding');
            } else {
              navigate('/dashboard');
            }
          }, 2000);
        } catch (error: any) {
          console.error('Error in OAuth callback:', error);
          setError(`Failed to connect Google Workspace: ${error.message}`);
          sessionStorage.removeItem('workspace_connecting');
          sessionStorage.removeItem('signup_google_workspace');
          
          // Still navigate to onboarding if this was a signup flow
          if (sessionStorage.getItem('signup_google_workspace')) {
            setTimeout(() => {
              navigate('/onboarding');
            }, 2000);
          }
        }
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  const saveNewUserData = async (user: User, includeGoogleWorkspace = false) => {
    const userDocRef = doc(db, "users", user.uid);
    try {
      const name = user.displayName || "Anonymous User";
      const photoURL = user.photoURL || null;
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ');

      // Create new user document (we already checked they don't exist)
      const initialData = prepareInitialProfileData(user.uid, user.email, name, photoURL, firstName, lastName);
      
      // Add Google Workspace connection flags if this is a Google signup
      const userData = {
        ...initialData,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(includeGoogleWorkspace && {
          // Mark as ready for Google Workspace connection
          googleWorkspaceRequested: true,
          // We'll set the actual connection flags after OAuth
        })
      };
      
      await setDoc(userDocRef, userData);
    } catch (err) {
      console.error("Error saving new user data:", err);
      throw err;
    }
  };


  const handleGoogleSignUp = async () => {
    setError(''); 
    setLoading(true);
    try { 
      // Mark that we're in a signup flow
      sessionStorage.setItem('signup_in_progress', 'true');
      
      const provider = new GoogleAuthProvider(); 
      const result = await signInWithPopup(auth, provider); 
      
      // Check if user already exists
      const userDocRef = doc(db, "users", result.user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        // User already has an account - sign them out and show error
        await signOut(auth);
        sessionStorage.removeItem('signup_in_progress');
        setError('You already have an account! Please log in instead.');
        return;
      }
      
      // New user - create account first
      await saveNewUserData(result.user, true); 
      
      sessionStorage.removeItem('signup_in_progress');
      
      // Now redirect to Google OAuth for Workspace permissions
      try {
        const isProduction = window.location.hostname === 'www.taskmaster.one';
        const redirectUri = isProduction 
          ? 'https://www.taskmaster.one/onboarding'
          : 'http://localhost:5173/onboarding';

        const getGoogleAuthUrl = httpsCallable(functions, 'getGoogleAuthUrl');
        const authResult = await getGoogleAuthUrl({ redirectUri });
        
        // Store that we're connecting workspace during signup
        sessionStorage.setItem('workspace_connecting', 'true');
        sessionStorage.setItem('signup_google_workspace', 'true');
        
        // Redirect to Google OAuth with full workspace scopes
        window.location.href = (authResult.data as any).url;
      } catch (oauthError: any) {
        console.error("Error starting Google Workspace OAuth:", oauthError);
        // Still navigate to onboarding even if OAuth fails
        setError("Account created! You can connect Google Workspace later in Settings.");
        setTimeout(() => {
          navigate('/onboarding');
        }, 2000);
      }
    }
    catch (err: any) { 
      if (err.code === 'auth/popup-closed-by-user') { 
        /* popup closed by user */ 
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with this email using a different sign-in method.'); 
      } else { 
        setError("Google sign-up failed. Please try again."); 
        console.error("Google sign up failed", err); 
      } 
    }
    finally { 
      sessionStorage.removeItem('signup_in_progress');
      setLoading(false); 
    }
  };

  return (
    <>
      <button
        onClick={handleGoogleSignUp}
        disabled={loading || workspaceConnected}
        className="w-full py-3.5 mb-4 bg-[var(--bg-primary)] hover:bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium rounded-full flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm"
      >
        {loading ? (
             <Loader2 className="animate-spin h-5 w-5 text-[var(--bg-solid-button)]" />
        ) : workspaceConnected ? (
         <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Google Workspace Connected!</span>
         </div>
        ) : (
         <div className="flex items-center justify-center gap-3">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            <span>Continue with Google</span>
         </div>
        )}
      </button>
      
      {workspaceConnected && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Google Workspace Connected</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Drive, Calendar, Gmail, Docs, Sheets, and Slides are now connected to your account.
          </p>
        </div>
      )}
      
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

  // Note: Auth protection is handled by the route guard in main.tsx

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
    <div className="min-h-screen font-clarika flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--bg-accent)] selection:text-white">
      <header className="py-6 px-4 sm:px-6 h-20"></header>
      <main className="flex flex-grow items-center justify-center px-4 py-8">
        <div 
            className="w-full max-w-md bg-[var(--bg-card)] p-8 sm:p-10 rounded-2xl border border-[var(--border-primary)] shadow-2xl"
            style={{ boxShadow: cardShadow }} 
        >
          <h2 className="text-3xl font-semibold text-center text-[var(--text-primary)] mb-2">Sign Up</h2>
          <p className="text-center text-[var(--text-secondary)] mb-8 text-sm whitespace-nowrap"> Learn in minutes. No credit card required. </p>
          
          <GoogleSignUp /> 
          
          <div className="flex items-center my-7"> 
            <hr className="flex-grow border-t border-[var(--border-primary)]" /> 
            <span className="mx-4 text-[var(--text-muted)] text-xs font-semibold tracking-wider">OR</span> 
            <hr className="flex-grow border-t border-[var(--border-primary)]" /> 
          </div>
          
          <SignUpForm /> 
          
          <div className="text-center mt-8"> 
            <p className="text-sm text-[var(--text-secondary)]"> 
              Already have an account?{' '} 
              <a href="/login" className="font-medium text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200"> Sign in </a> 
            </p> 
          </div>
        </div>
      </main>
      <footer className="py-8 bg-[var(--bg-primary)]"> 
        <div className="text-center text-xs text-[var(--text-muted)] px-4">
          <p className="whitespace-nowrap overflow-hidden text-ellipsis sm:whitespace-normal"> 
            By creating or entering an account, you agree to the{' '} 
            <a href="/terms" className="font-medium text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200"> Terms of Service </a>{' '} 
            and{' '} 
            <a href="/privacy-policy" className="font-medium text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200"> Privacy Policy </a> . 
          </p> 
        </div> 
      </footer>
    </div>
  );
}
export default SignUp;
