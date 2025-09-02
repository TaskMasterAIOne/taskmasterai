import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { googleSignIn, emailSignIn } from '../lib/login-firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { prepareInitialProfileData } from '../lib/current-paying-user';

function Login() {
  const navigate = useNavigate();
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        updateAndNavigate(user);
      }
    });
    
    const applyTheme = () => {
      const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
      if (isIlluminateEnabled) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    
    return () => {
        unsubscribeAuth();
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', applyTheme);
    };
  }, [navigate]);

  const updateAndNavigate = async (user: User) => {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);
        const name = user.displayName || "Anonymous User";
        const photoURL = user.photoURL || null;

        if (docSnap.exists()) {
            // User exists - respect their profile picture preference
            const existingData = docSnap.data();
            const updateData: any = {
                name,
                displayName: name,
                email: user.email,
                lastLoginAt: serverTimestamp()
            };
            
            // Only update photoURL if user didn't explicitly remove it (not null) and it's different
            if (photoURL && existingData?.photoURL !== null && photoURL !== existingData?.photoURL) {
                updateData.photoURL = photoURL;
            }
            
            await updateDoc(userDocRef, updateData);
        } else {
            const [firstName, ...lastNameParts] = name.split(' ');
            const lastName = lastNameParts.join(' ');
            const initialData = prepareInitialProfileData(user.uid, user.email, name, photoURL, firstName, lastName);
            await setDoc(userDocRef, {
                ...initialData,
                createdAt: serverTimestamp(),
                lastLoginAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        }
        navigate('/dashboard');
    } catch (error) {
        console.error("Error on login user data update:", error);
        navigate('/dashboard');
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMessage(''); setFormLoading(true); try { const user = await emailSignIn(email, password); if (user) await updateAndNavigate(user); } catch (error: any) { console.error("Login failed", error); if (error.code === "auth/user-not-found" || error.code === "auth/invalid-email") setErrorMessage("No account found with this email."); else if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") setErrorMessage("Incorrect email or password."); else setErrorMessage("Login failed. Please try again."); } finally { setFormLoading(false); }
  };
  const handleGoogleLogin = async () => {
    setErrorMessage(''); setFormLoading(true); try { const user = await googleSignIn(); if (user) await updateAndNavigate(user); } catch (error: any) { console.error("Google login failed", error); if (error.code === 'auth/popup-closed-by-user') {} else setErrorMessage("Google login failed. Please try again."); } finally { setFormLoading(false); }
  };

  const isIlluminate = document.documentElement.classList.contains('light');
  const cardShadow = !isIlluminate && document.documentElement.classList.contains('dark') 
    ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 20px 40px -10px rgba(128, 90, 213, 0.15)' 
    : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)';

  return (
    <div className="min-h-screen font-clarika flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] illuminate-override selection:bg-[var(--bg-accent)] selection:text-white">
      <header className="py-6 px-4 sm:px-6 h-20"></header>
      <main className="flex flex-grow items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-[var(--bg-card)] p-8 sm:p-10 rounded-2xl border border-[var(--border-primary)] shadow-2xl illuminate-card-override"
            style={{ boxShadow: cardShadow }} >
          <h2 className="text-3xl font-semibold text-center text-[var(--text-primary)] mb-2 illuminate-text-override">Login</h2>
          <p className="text-center text-[var(--text-secondary)] mb-8 text-sm whitespace-nowrap illuminate-subtext-override"> Welcome back! </p>
          <button onClick={handleGoogleLogin} disabled={formLoading} className="w-full py-3.5 mb-4 bg-[var(--bg-primary)] hover:bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] font-medium rounded-full flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm illuminate-button-secondary-override" >
            {formLoading && !email ? <Loader2 className="animate-spin h-5 w-5 text-[var(--bg-solid-button)]" /> : (
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
          <div className="flex items-center my-7"> <hr className="flex-grow border-t border-[var(--border-primary)] illuminate-border-override" /> <span className="mx-4 text-[var(--text-muted)] text-xs font-semibold tracking-wider illuminate-subtext-override">OR</span> <hr className="flex-grow border-t border-[var(--border-primary)] illuminate-border-override" /> </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div> <label htmlFor="email" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 illuminate-subtext-override">Email</label> <input type="email" id="email" autoComplete="email" className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm illuminate-input-override" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-required="true" /> </div>
            <div> <label htmlFor="password" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 illuminate-subtext-override">Password</label> <input type="password" id="password" autoComplete="current-password" className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm illuminate-input-override" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required aria-required="true" /> </div>
            {errorMessage && <p className="text-red-600 dark:text-red-400 text-sm text-center -mt-2 illuminate-error-override">{errorMessage}</p>}
            <button type="submit" disabled={formLoading} className="w-full py-3.5 mt-1 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm illuminate-button-primary-override" > {formLoading && email ? <Loader2 className="animate-spin h-5 w-5 text-white mx-auto" /> : 'Sign In'} </button>
          </form>
          <div className="text-center mt-4"> <a href="/forgot-password" className="text-xs text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200 illuminate-link-override"> Forgot password? </a> </div>
          <div className="text-center mt-6"> <p className="text-sm text-[var(--text-secondary)] illuminate-subtext-override"> Don't have an account?{' '} <a href="/signup" className="font-medium text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200 illuminate-link-override"> Sign up </a> </p> </div>
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
export default Login;
