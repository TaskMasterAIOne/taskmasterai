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
    <div className="min-h-screen font-poppins flex flex-col bg-gray-100 text-gray-900 dark:bg-[#0C0E1A] dark:text-gray-200 illuminate-override">
      <header className="py-6 px-4 sm:px-6 h-20"></header>
      <main className="flex flex-grow items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white dark:bg-[#12141D] p-8 sm:p-10 rounded-2xl border border-gray-300 dark:border-gray-700/50 shadow-2xl illuminate-card-override"
            style={{ boxShadow: cardShadow }} >
          
          {!isSubmitted ? (
            <>
              <h2 className="text-3xl font-semibold text-center text-gray-900 dark:text-white mb-2 illuminate-text-override">Reset Password</h2>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm illuminate-subtext-override">
                Enter your email to get a reset link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 illuminate-subtext-override">Email</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-[#2A2F3B] border border-gray-300 dark:border-gray-700/60 text-gray-900 dark:text-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-purple-500 focus:border-indigo-500 dark:focus:border-purple-500 transition-colors duration-200 placeholder-gray-500 text-sm illuminate-input-override"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required="true"
                  />
                </div>
                
                {errorMessage && <p className="text-red-600 dark:text-red-400 text-sm text-center -mt-2 illuminate-error-override">{errorMessage}</p>}
                
                <button type="submit" disabled={formLoading} className="w-full py-3.5 mt-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-700 dark:hover:to-indigo-700 text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D] focus:ring-indigo-500 dark:focus:ring-purple-500 text-sm illuminate-button-primary-override">
                  {formLoading ? <Loader2 className="animate-spin h-5 w-5 text-white mx-auto" /> : 'Send Reset Link'}
                </button>
              </form>
              <div className="text-center mt-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 illuminate-subtext-override">
                  Remember your password?{' '}
                  <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors duration-200 illuminate-link-override">
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
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 illuminate-text-override">Check your inbox</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm max-w-xs mx-auto illuminate-subtext-override whitespace-nowrap overflow-hidden text-ellipsis">
                We've sent a password reset link to <span className="font-medium text-gray-800 dark:text-gray-200">{email}</span>.
              </p>
              <a href="/login" className="w-full inline-flex justify-center py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-700 dark:hover:to-indigo-700 text-white font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-white dark:focus:ring-offset-[#16181D] focus:ring-indigo-500 dark:focus:ring-purple-500 text-sm illuminate-button-primary-override">
                Back to Sign In
              </a>
            </div>
          )}
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

export default ForgotPassword;
