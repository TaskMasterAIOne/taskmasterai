import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface SignUpFormProps {
  isDarkMode: boolean;
}

export function SignUpForm({ isDarkMode }: SignUpFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { const result = await createUserWithEmailAndPassword(auth, email, password); const user = result.user; const fullName = `${firstName.trim()} ${lastName.trim()}`; await updateProfile(user, { displayName: fullName }); const userDocRef = doc(db, "users", user.uid); await setDoc(userDocRef, { uid: user.uid, email: user.email, firstName: firstName.trim(), lastName: lastName.trim(), name: fullName, displayName: fullName, createdAt: serverTimestamp(), tokens: 500, uploadBonusCount: 0, abuseWarningCount: 0, }); navigate('/splashscreen'); }
    catch (err: any) { if (err.code === 'auth/email-already-in-use') setError('This email address is already in use.'); else if (err.code === 'auth/weak-password') setError('Password should be at least 6 characters long.'); else setError('Failed to create account. Please try again.'); console.error("Sign up error:", err); }
    finally { setLoading(false); }
  };
  
  // Define conditional styles based on the isDarkMode prop
  const labelClass = isDarkMode ? "text-gray-400" : "text-gray-500"; // Light mode label slightly darker
  const inputBgClass = isDarkMode ? "bg-[#2A2F3B]" : "bg-gray-100"; // Lighter input for light mode
  const inputBorderClass = isDarkMode ? "border-gray-700/60" : "border-gray-300";
  const inputTextColorClass = isDarkMode ? "text-gray-200" : "text-gray-800"; // Darker text for light mode inputs
  const inputFocusRingClass = isDarkMode ? "focus:ring-purple-500 focus:border-purple-500" : "focus:ring-indigo-500 focus:border-indigo-500";
  const placeholderColorClass = isDarkMode ? "placeholder-gray-500" : "placeholder-gray-400";
  
  const primaryButtonBgClass = isDarkMode 
    ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
    : "bg-indigo-600 hover:bg-indigo-700"; // Solid color for light mode button
  const focusOffsetClass = isDarkMode ? "focus:ring-offset-[#16181D]" : "focus:ring-offset-white";
  const errorTextClass = isDarkMode ? "text-red-400" : "text-red-600";
  const loaderColorClass = "text-white"; // Loader on primary button is always white


  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <label htmlFor="firstName" className={`block text-xs font-medium ${labelClass} mb-1.5`}>First name</label>
          <input type="text" id="firstName" className={`w-full px-4 py-3 ${inputBgClass} border ${inputBorderClass} ${inputTextColorClass} rounded-lg focus:outline-none focus:ring-2 ${inputFocusRingClass} transition-colors duration-200 ${placeholderColorClass} text-sm`} value={firstName} onChange={(e) => setFirstName(e.target.value)} required aria-required="true" />
        </div>
        <div>
          <label htmlFor="lastName" className={`block text-xs font-medium ${labelClass} mb-1.5`}>Last name</label>
          <input type="text" id="lastName" className={`w-full px-4 py-3 ${inputBgClass} border ${inputBorderClass} ${inputTextColorClass} rounded-lg focus:outline-none focus:ring-2 ${inputFocusRingClass} transition-colors duration-200 ${placeholderColorClass} text-sm`} value={lastName} onChange={(e) => setLastName(e.target.value)} required aria-required="true" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={`block text-xs font-medium ${labelClass} mb-1.5`}>Email</label>
        <input type="email" id="email" className={`w-full px-4 py-3 ${inputBgClass} border ${inputBorderClass} ${inputTextColorClass} rounded-lg focus:outline-none focus:ring-2 ${inputFocusRingClass} transition-colors duration-200 ${placeholderColorClass} text-sm`} placeholder="sarthak@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-required="true" />
      </div>
      <div>
        <label htmlFor="password" className={`block text-xs font-medium ${labelClass} mb-1.5`}>Password</label>
        <input type="password" id="password" className={`w-full px-4 py-3 ${inputBgClass} border ${inputBorderClass} ${inputTextColorClass} rounded-lg focus:outline-none focus:ring-2 ${inputFocusRingClass} transition-colors duration-200 ${placeholderColorClass} text-sm`} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required aria-required="true" minLength={6} />
      </div>
      {error && <p className={`text-sm text-center -mt-2 ${errorTextClass}`}>{error}</p>}
      <button type="submit" disabled={loading} className={`w-full py-3.5 mt-1 ${primaryButtonBgClass} text-white font-semibold rounded-full transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-2 ${focusOffsetClass} ${inputFocusRingClass} text-sm`} >
        {loading ? <Loader2 className={`animate-spin h-5 w-5 ${loaderColorClass} mx-auto`} /> : 'Create an account'}
      </button>
    </form>
  );
}