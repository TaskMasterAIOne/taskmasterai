import React, { useState, useEffect } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { sendPasswordResetEmail } from '../lib/login-firebase';

function ForgotPassword() {
  const [formLoading, setFormLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    // Theme listener for dynamic OS/localStorage changes during component lifecycle
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
    applyTheme(); // Apply on mount
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'isIlluminateEnabled') applyTheme(); });
    
    return () => {
        mediaQuery.removeEventListener('change', applyTheme);
        window.removeEventListener('storage', applyTheme);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setFormLoading(true);
    
    try {
      await sendPasswordResetEmail(email);
      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Password reset failed", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
        setErrorMessage('No account found with this email address.');
      } else {
        setErrorMessage('Failed to send reset email. Please try again later.');
      }
    } finally {
        setFormLoading(false);
    }
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
          
          {!isSubmitted ? (
            <>
              <h2 className="text-3xl font-semibold text-center text-[var(--text-primary)] mb-2 illuminate-text-override">Reset Password</h2>
              <p className="text-center text-[var(--text-secondary)] mb-8 text-sm illuminate-subtext-override">
                Enter your email to get a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 illuminate-subtext-override">Email</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 bg-white dark:bg-[var(--bg-highlight)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] focus:border-[var(--bg-solid-button)] transition-colors duration-200 placeholder-[var(--text-muted)] text-sm illuminate-input-override"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                
                {errorMessage && <p className="text-red-600 dark:text-red-400 text-sm text-center -mt-2 illuminate-error-override">{errorMessage}</p>}
                
                <button type="submit" disabled={formLoading} className="w-full py-3.5 mt-1 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm illuminate-button-primary-override">
                  {formLoading ? <Loader2 className="animate-spin h-5 w-5 text-white mx-auto" /> : 'Send Reset Link'}
                </button>
              </form>
              <div className="text-center mt-6">
                <p className="text-sm text-[var(--text-secondary)] illuminate-subtext-override">
                  Remember your password?{' '}
                  <a href="/login" className="font-medium text-[var(--bg-solid-button)] hover:text-[var(--bg-accent)] transition-colors duration-200 illuminate-link-override">
                    Sign in
                  </a>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 illuminate-text-override">Check your inbox</h3>
              <p className="text-[var(--text-secondary)] mb-8 text-sm max-w-xs mx-auto illuminate-subtext-override whitespace-nowrap overflow-hidden text-ellipsis">
                We've sent a password reset link to <span className="font-medium text-[var(--text-primary)]">{email}</span>.
              </p>
              <a href="/login" className="w-full inline-flex justify-center py-3.5 bg-[var(--bg-solid-button)] hover:bg-[var(--bg-accent)] text-white font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--bg-solid-button)] text-sm illuminate-button-primary-override">
                Back to Sign In
              </a>
            </div>
          )}
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

export default ForgotPassword;
