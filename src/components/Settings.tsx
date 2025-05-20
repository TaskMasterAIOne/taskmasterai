import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User as UserIcon, Settings as SettingsIcon, Mail, Key, LogOut,
  Trash2, Save, X, AlertCircle, Crown, Upload, Camera, Moon, Sun,
  PanelLeftDashed, Loader2, Info, BrainCircuit, Star, CreditCard, Activity,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import {
  updateUserProfile, signOutUser, deleteUserAccount, AuthError,
  getCurrentUser, getUserData, deleteProfilePicture,
} from '../lib/settings-firebase';
import { saveUserContext, getUserContext, UserContext } from '../lib/ai-context-firebase';
import {
  getUserTier, UserTier,
  getChatLimitForTier, getNoteLimitsForTier,
  getCurrentMonthUserChatUsage, getUserNoteUsage,
  ChatUsageData, NoteUsageData,
} from '../lib/current-paying-user';
import { createPortalSession } from '../lib/stripe-client';
import { User } from 'firebase/auth';

export function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userData, setUserData] = useState({ name: '', email: '', photoURL: '' });
  const [aiContextData, setAiContextData] = useState<Partial<UserContext>>({});
  const [initialAiContextData, setInitialAiContextData] = useState<Partial<UserContext>>({});
  const [isLoadingAiContext, setIsLoadingAiContext] = useState(true);
  const [isSavingAiContext, setIsSavingAiContext] = useState(false);
  const [isEditingAiContext, setIsEditingAiContext] = useState(false);
  const [aiContextError, setAiContextError] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => JSON.parse(localStorage.getItem('isSidebarCollapsed') || 'false'));
  const [isIlluminateEnabled, setIsIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false'));
  const [isBlackoutEnabled, setIsBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false'));
  const [isSidebarIlluminateEnabled, setIsSidebarIlluminateEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarIlluminateEnabled') || 'false'));
  const [isSidebarBlackoutEnabled, setIsSidebarBlackoutEnabled] = useState(() => JSON.parse(localStorage.getItem('isSidebarBlackoutEnabled') || 'false'));
  const [formData, setFormData] = useState({ name: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isGoogleUser, setIsGoogleUser] = useState<boolean>(false);
  const [userCurrentTier, setUserCurrentTier] = useState<UserTier>('loading');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // --- NEW STATE FOR USAGE DETAILS ---
  const [chatUsage, setChatUsage] = useState<ChatUsageData | null>(null);
  const [noteUsage, setNoteUsage] = useState<NoteUsageData | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.remove('illuminate-mode', 'blackout-mode');
    if (isIlluminateEnabled) {
      document.body.classList.add('illuminate-mode');
    } else if (isBlackoutEnabled) {
      document.body.classList.add('blackout-mode');
    }
    localStorage.setItem('isIlluminateEnabled', JSON.stringify(isIlluminateEnabled));
    localStorage.setItem('isBlackoutEnabled', JSON.stringify(isBlackoutEnabled));
    localStorage.setItem('isSidebarIlluminateEnabled', JSON.stringify(isSidebarIlluminateEnabled));
    localStorage.setItem('isSidebarBlackoutEnabled', JSON.stringify(isSidebarBlackoutEnabled));
  }, [isIlluminateEnabled, isBlackoutEnabled, isSidebarIlluminateEnabled, isSidebarBlackoutEnabled]);

  useEffect(() => {
    setIsLoading(true);
    setIsLoadingAiContext(true);
    setUserCurrentTier('loading');
    setIsLoadingUsage(true); 

    const loadData = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) { navigate('/login'); return; }
      setUser(currentUser);
      const googleFlag = currentUser.providerData?.some((p: any) => p.providerId === 'google.com');
      setIsGoogleUser(!!googleFlag);

      setUserData({
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || '',
      });
      setFormData(prev => ({
          ...prev,
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          currentPassword: '', newPassword: '', confirmPassword: '',
      }));

      const currentMonthStr = new Date().toISOString().slice(0, 7);

      try {
        const [tier, firestoreData, fetchedChatUsage, fetchedNoteUsage] = await Promise.all([
          getUserTier(currentUser.uid, currentUser.email),
          getUserData(currentUser.uid),
          getCurrentMonthUserChatUsage(currentUser.uid, currentMonthStr),
          getUserNoteUsage(currentUser.uid)
        ]);
        
        setUserCurrentTier(tier); // Set tier first
        
        // Only set usage if not premium, or if needed for some other logic later
        // The card itself will be hidden for premium, so these values might not be displayed
        setChatUsage(fetchedChatUsage);
        if (fetchedNoteUsage && fetchedNoteUsage.month === currentMonthStr) {
            setNoteUsage(fetchedNoteUsage);
        } else {
            setNoteUsage({ pdfAi: 0, youtube: 0, month: currentMonthStr });
        }
        
        const loadedUserData = {
          name: firestoreData?.name || currentUser.displayName || '',
          email: currentUser.email || '', 
          photoURL: firestoreData?.photoURL || currentUser.photoURL || '',
        };
        setUserData(loadedUserData);
        setFormData(prev => ({
          ...prev, name: loadedUserData.name, email: loadedUserData.email,
          currentPassword: '', newPassword: '', confirmPassword: '',
        }));

        if (firestoreData?.stripeCustomerId) {
          setStripeCustomerId(firestoreData.stripeCustomerId);
        } else {
          setStripeCustomerId(null);
        }
        setUsageError(null);
      } catch (error) {
        console.error('Error loading user data/tier/usage:', error);
        setError('Failed to load user data or usage details.');
        setUserCurrentTier('basic'); 
        setUsageError("Could not load usage details.");
      } finally {
        setIsLoading(false); 
        setIsLoadingUsage(false); 
      }

      try {
          setIsLoadingAiContext(true);
          const context = await getUserContext(currentUser.uid);
          const loadedContext = {
              workDescription: context?.workDescription || '',
              shortTermFocus: context?.shortTermFocus || '',
              longTermGoals: context?.longTermGoals || '',
              otherContext: context?.otherContext || '',
          };
          setAiContextData(loadedContext);
          setInitialAiContextData(loadedContext);
          setAiContextError(null);
      } catch (err) {
          console.error("Error loading AI context:", err);
          setAiContextError("Failed to load AI context.");
      } finally {
          setIsLoadingAiContext(false);
      }
    };
    loadData();
  }, [navigate]);

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleToggleSidebar = () => { setIsSidebarCollapsed(prev => !prev); };

  const handleToggleIlluminate = (checked: boolean) => {
    setIsIlluminateEnabled(checked);
    if (checked) { setIsBlackoutEnabled(false); setIsSidebarIlluminateEnabled(true); setIsSidebarBlackoutEnabled(false); }
    else { if (!isBlackoutEnabled) { setIsSidebarIlluminateEnabled(false); } }
  };
  const handleToggleBlackout = (checked: boolean) => {
    setIsBlackoutEnabled(checked);
    if (checked) { setIsIlluminateEnabled(false); setIsSidebarBlackoutEnabled(true); setIsSidebarIlluminateEnabled(false); }
    else { if (!isIlluminateEnabled) { setIsSidebarBlackoutEnabled(false); } }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { setError(null); setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleAiContextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => { setAiContextError(null); setAiContextData(prev => ({ ...prev, [e.target.name]: e.target.value })); };
  const handleProfilePictureClick = () => { if (!isUploading) fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    if (!file.type.startsWith('image/')) { setError('Invalid file type.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image too large (max 5MB).'); return; }
    setIsUploading(true); setError(null);
    try {
      const updatedProfile = await updateUserProfile({ photoFile: file }, user.uid);
      const newPhotoURL = updatedProfile?.photoURL || getCurrentUser()?.photoURL || '';
      const refreshedFirestoreData = await getUserData(user.uid);
      setUserData(prev => ({
          ...prev,
          photoURL: refreshedFirestoreData?.photoURL || newPhotoURL,
          name: refreshedFirestoreData?.name || prev.name
      }));
      const refreshedUser = getCurrentUser(); if (refreshedUser) setUser(refreshedUser);
    } catch (err) { console.error("Upload Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to upload.'); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleRemoveProfilePicture = async () => {
    if (!user || !userData.photoURL) return; if (!window.confirm('Remove profile picture?')) return;
    setIsUploading(true); setError(null);
    try {
        await deleteProfilePicture(user.uid);
        setUserData(prev => ({ ...prev, photoURL: '' }));
        const refreshedUser = getCurrentUser(); if (refreshedUser) setUser(refreshedUser);
    }
    catch (err) { console.error("Remove Pic Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to remove.'); }
    finally { setIsUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setIsSaving(true);
    try {
      if (!user) throw new AuthError('Auth session expired.');
      const updateData: { name?: string; email?: string; currentPassword?: string; newPassword?: string } = {};
      let requiresPassword = false;
      const trimmedName = formData.name.trim();
      if (trimmedName !== userData.name) {
          if (!trimmedName) throw new AuthError('Name cannot be empty.');
          updateData.name = trimmedName;
      }
      if (!isGoogleUser) {
          const trimmedEmail = formData.email.trim();
          if (trimmedEmail !== userData.email) {
              if (!trimmedEmail) throw new AuthError('Email cannot be empty.');
              updateData.email = trimmedEmail; requiresPassword = true;
          }
          if (formData.newPassword) {
              if (formData.newPassword.length < 6) throw new AuthError('New password min 6 chars.');
              if (formData.newPassword !== formData.confirmPassword) throw new AuthError('New passwords do not match.');
              updateData.newPassword = formData.newPassword; requiresPassword = true;
          }
          if (requiresPassword && !formData.currentPassword) throw new AuthError('Current password required.');
          if (requiresPassword && formData.currentPassword) updateData.currentPassword = formData.currentPassword;
      }

      if (Object.keys(updateData).length > 0 || (updateData.newPassword && !isGoogleUser)) {
          await updateUserProfile(updateData, user.uid);
          const refreshedUser = getCurrentUser();
          const refreshedFirestoreData = await getUserData(user.uid);

          const newName = refreshedFirestoreData?.name || refreshedUser?.displayName || userData.name;
          const newEmail = refreshedUser?.email || userData.email;
          const newPhotoURL = refreshedFirestoreData?.photoURL || refreshedUser?.photoURL || userData.photoURL;

          setUserData({ name: newName, email: newEmail, photoURL: newPhotoURL });
          setFormData(prev => ({ ...prev, name: newName, email: newEmail, currentPassword: '', newPassword: '', confirmPassword: '' }));
          if(refreshedUser) setUser(refreshedUser);
          setIsEditing(false);
      } else {
          setIsEditing(false); setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) { console.error("Save Error:", err); setError(err instanceof AuthError ? err.message : 'Error saving.'); }
    finally { setIsSaving(false); }
  };

  const handleSaveAiContext = async () => {
       if (!user?.uid) { setAiContextError("User not authenticated."); return; }
       setIsSavingAiContext(true); setAiContextError(null);
       try {
           const dataToSave: Partial<UserContext> = {
               workDescription: aiContextData.workDescription?.trim() || '',
               shortTermFocus: aiContextData.shortTermFocus?.trim() || '',
               longTermGoals: aiContextData.longTermGoals?.trim() || '',
               otherContext: aiContextData.otherContext?.trim() || '',
           };
           await saveUserContext(user.uid, dataToSave);
           setAiContextData(dataToSave); setInitialAiContextData(dataToSave); setIsEditingAiContext(false);
       } catch (err) { console.error("AI Context Save Error:", err); setAiContextError("Failed to save AI context."); }
       finally { setIsSavingAiContext(false); }
   };
  const handleCancelAiContextEdit = () => { setAiContextData(initialAiContextData); setIsEditingAiContext(false); setAiContextError(null); };

  const handleSignOut = async () => { setError(null); try { await signOutUser(); navigate('/login'); } catch (err) { console.error("Sign Out Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to sign out.'); } };

  const handleDeleteAccount = async () => { setError(null); setIsDeleting(true); try { if (!user) throw new AuthError('Auth session expired.'); if (!isGoogleUser && !formData.currentPassword) { throw new AuthError('Current password required.'); } await deleteUserAccount(isGoogleUser ? undefined : formData.currentPassword); navigate('/login'); } catch (err) { console.error("Delete Account Error:", err); setError(err instanceof AuthError ? err.message : 'Failed to delete account.'); } finally { setIsDeleting(false); } };
  const closeDeleteModal = () => { setShowDeleteConfirm(false); setError(null); setFormData(prev => ({...prev, currentPassword: ''})); };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    setPortalError(null);
    setError(null);
    if (!stripeCustomerId) {
      setPortalError("Subscription details not found.");
      setIsManagingSubscription(false);
      return;
    }
    try {
      const { portalUrl } = await createPortalSession();
      window.location.href = portalUrl;
    } catch (err: any) {
      console.error("Manage Subscription Error:", err);
      setPortalError(err.message || "Could not load billing page.");
      setIsManagingSubscription(false);
    }
  };

  const containerClass = isIlluminateEnabled ? "bg-gray-50 text-gray-900" : isBlackoutEnabled ? "bg-black text-gray-200" : "bg-gray-900 text-gray-200";
  const cardClass = isIlluminateEnabled ? "bg-white text-gray-900 border border-gray-200/70 shadow-sm" : isBlackoutEnabled ? "bg-gray-900 text-gray-300 border border-gray-700/50 shadow-md shadow-black/20" : "bg-gray-800 text-gray-300 border border-gray-700/50 shadow-lg shadow-black/20";
  const headingClass = isIlluminateEnabled ? "text-gray-800" : "text-gray-100";
  const subheadingClass = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";
  const inputBg = isIlluminateEnabled ? "bg-gray-100 hover:bg-gray-200/50 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 hover:bg-gray-600/50 border-gray-600 focus:border-blue-500 focus:ring-blue-500";
  const placeholderIconColor = isIlluminateEnabled ? 'text-gray-400' : 'text-gray-500';
  const textareaBg = isIlluminateEnabled ? "bg-gray-100 border-gray-300 focus:border-blue-500 focus:ring-blue-500" : "bg-gray-700 border-gray-600 focus:border-blue-500 focus:ring-blue-500";
  const buttonPrimaryClass = `bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:from-blue-400 hover:to-purple-400 transition-all duration-300 transform hover:scale-105 active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none group relative overflow-hidden`;
  const buttonPrimaryHoverEffect = `hover:brightness-110`;
  const buttonSecondaryClass = `${isIlluminateEnabled ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'} transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed`;
  const buttonDangerClass = `${isIlluminateEnabled ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-900/50 text-red-400 hover:bg-red-800/50'} transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed`;
  const buttonDangerConfirmClass = `bg-red-600 text-white hover:bg-red-700 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed`;
  const errorBoxBg = isIlluminateEnabled ? 'bg-red-100' : 'bg-red-800/30';
  const errorTextColor = isIlluminateEnabled ? 'text-red-700' : 'text-red-400';
  const aiContextErrorBoxBg = isIlluminateEnabled ? 'bg-yellow-100' : 'bg-yellow-800/30';
  const aiContextErrorTextColor = isIlluminateEnabled ? 'text-yellow-800' : 'text-yellow-300';
  const deleteModalBg = isIlluminateEnabled ? 'bg-white border border-gray-200 shadow-xl' : 'bg-gray-800 border border-gray-700 shadow-2xl';
  const deleteModalText = isIlluminateEnabled ? 'text-gray-700' : 'text-gray-200';
  const deleteModalOverlay = 'bg-black/60 backdrop-blur-sm';

  // --- HELPER FUNCTION FOR RESET DATE ---
  const getNextMonthResetDate = () => {
    const now = new Date();
    const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return firstDayNextMonth.toLocaleDateString(undefined, { 
      month: 'long',
      day: 'numeric',
    });
  };

  // --- HELPER COMPONENT FOR PROGRESS BAR ---
  const ProgressBar = ({ current, total, isIlluminate }: { current: number; total: number; isIlluminate: boolean }) => {
    if (userCurrentTier === 'loading' && total === 0 && current === 0) {
      return <div className={`text-xs mt-1 ${subheadingClass}`}>Loading limits...</div>;
    }
    
    const displayTotal = total === Infinity ? '∞' : total;
    
    if (total === Infinity) { // Should not happen if card is hidden for premium, but good fallback
      return (
        <div className="mt-1">
          <div className={`h-2.5 w-full rounded-full overflow-hidden ${isIlluminate ? 'bg-green-100' : 'bg-green-800/50'}`}>
            <div className={`h-full bg-green-500`} style={{ width: `100%` }} />
          </div>
          <p className={`text-xs mt-1 ${subheadingClass} text-right`}>{current} / {displayTotal}</p>
        </div>
      );
    }

    const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
    let barColorClass = isIlluminate ? 'bg-blue-500' : 'bg-blue-500';
    if (percentage > 85) barColorClass = isIlluminate ? 'bg-red-500' : 'bg-red-500';
    else if (percentage > 60) barColorClass = isIlluminate ? 'bg-yellow-500' : 'bg-yellow-500';

    return (
      <div className="mt-1">
        <div className={`h-2.5 w-full rounded-full overflow-hidden ${isIlluminate ? 'bg-gray-200' : 'bg-gray-700'}`}>
          <div className={`h-full ${barColorClass} transition-all duration-500 ease-out`} style={{ width: `${percentage}%` }} />
        </div>
        <p className={`text-xs mt-1 ${subheadingClass} text-right`}>{current} / {displayTotal}</p>
      </div>
    );
  };
  
  return (
    <div className={`flex flex-col min-h-screen ${containerClass}`}>
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        userName={userData.name || 'User'}
        isBlackoutEnabled={isBlackoutEnabled && isSidebarBlackoutEnabled}
        isIlluminateEnabled={isIlluminateEnabled && isSidebarIlluminateEnabled}
      />

      {showDeleteConfirm && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${deleteModalOverlay}`}>
          <div className={`${deleteModalBg} rounded-xl p-5 sm:p-6 max-w-md w-full`}>
            <h3 className={`text-lg font-semibold mb-3 ${headingClass}`}>Delete Account</h3>
            <p className={`mb-4 text-sm ${deleteModalText}`}>
                Are you sure? This permanently deletes your account and all associated data. Cannot be undone.
            </p>
            {!isGoogleUser && (
              <div className="mb-4">
                <label htmlFor="deleteConfirmPassword" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Enter Current Password</label>
                <input id="deleteConfirmPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} placeholder="Required to delete" className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 border ${isIlluminateEnabled ? 'border-gray-300' : 'border-gray-600'}`} disabled={isDeleting}/>
              </div>
            )}
            {error && showDeleteConfirm && (
              <div className={`mb-4 p-2 rounded-md flex items-start gap-2 text-xs ${errorBoxBg} ${errorTextColor}`}>
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button onClick={closeDeleteModal} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`} disabled={isDeleting}>Cancel</button>
              <button onClick={handleDeleteAccount} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonDangerConfirmClass} flex items-center justify-center min-w-[100px]`} disabled={isDeleting || (!isGoogleUser && !formData.currentPassword)}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 overflow-y-auto transition-all duration-300 pt-14 md:pt-0 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-5 sm:py-7">
          <div className="mb-6 sm:mb-8">
            <h1 className={`text-xl sm:text-2xl font-bold flex items-center gap-2 ${headingClass}`}>
              <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />Settings
            </h1>
            <p className={`${subheadingClass} mt-1 text-sm`}>Manage your account settings and preferences</p>
          </div>
          {error && !showDeleteConfirm && ( 
            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${errorBoxBg}`}>
              <AlertCircle className={`w-4 h-4 shrink-0 mt-px ${errorTextColor}`} />
              <p className={`${errorTextColor} text-xs sm:text-sm`}>{error}</p>
            </div>
          )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
               <div className="flex flex-col gap-4 lg:gap-6">
                 {/* Profile Picture Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                   <h2 className={`text-base sm:text-lg font-semibold mb-4 ${headingClass}`}>Profile Picture</h2>
                   <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
                     <div className="relative group flex-shrink-0">
                       <div className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center border-2 ${isIlluminateEnabled ? 'border-gray-200 bg-gray-100' : 'border-gray-700 bg-gray-800'}`}>
                         {isUploading ? (<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full"><Loader2 className="w-5 h-5 animate-spin text-white" /></div>)
                          : userData.photoURL ? (<img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />)
                          : (<UserIcon className={`w-10 h-10 ${placeholderIconColor}`} />)}
                       </div>
                       {!isUploading && (
                         <button onClick={handleProfilePictureClick} className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer" title="Change picture" aria-label="Change profile picture">
                           <Camera className="w-5 h-5 text-white" />
                         </button>
                       )}
                       <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                     </div>
                     <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto justify-center sm:justify-start">
                       <button onClick={handleProfilePictureClick} disabled={isUploading} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`}>
                         <Upload className="w-4 h-4" /> {isUploading ? 'Uploading...' : 'Upload'}
                       </button>
                       {userData.photoURL && !isUploading && (
                         <button onClick={handleRemoveProfilePicture} disabled={isUploading} className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonDangerClass}`}>
                           <Trash2 className="w-4 h-4" /> Remove
                         </button>
                       )}
                     </div>
                   </div>
                 </div>
                 {/* Profile Details Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-base sm:text-lg font-semibold ${headingClass}`}>Profile Details</h2>
                      {!isEditing && (<button type="button" onClick={() => { setIsEditing(true); setError(null); }} disabled={isLoading || isSaving} className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`}>Edit</button>)}
                    </div>
                    <form onSubmit={handleSave}>
                       <div className="space-y-4">
                          <div>
                            <label htmlFor="name" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Name</label>
                            <input id="name" type="text" name="name" value={formData.name} onChange={handleInputChange} disabled={!isEditing || isSaving || isLoading} className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed`} required/>
                          </div>
                          <div>
                            <label htmlFor="email" className={`flex items-center text-xs font-medium mb-1 ${subheadingClass}`}>Email {isGoogleUser && <span className="ml-1.5 text-[10px] text-gray-500">(Managed by Google)</span>}</label>
                            <input id="email" type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={!isEditing || isSaving || isGoogleUser || isLoading} className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 disabled:cursor-not-allowed`} required/>
                          </div>
                          {isEditing && !isGoogleUser && (
                              <>
                                  <hr className={`my-3 ${isIlluminateEnabled ? 'border-gray-200/80' : 'border-gray-700/80'}`} />
                                  <p className={`text-sm font-medium -mb-1 ${headingClass}`}>Change Password</p>
                                  <div>
                                      <label htmlFor="currentPassword" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Current Password</label>
                                      <input id="currentPassword" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Required to change email or password" className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60`} />
                                  </div>
                                  <div>
                                      <label htmlFor="newPassword" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>New Password</label>
                                      <input id="newPassword" type="password" name="newPassword" value={formData.newPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Leave blank to keep current (min 6 chars)" className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60`} />
                                  </div>
                                  <div>
                                      <label htmlFor="confirmPassword" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Confirm New Password</label>
                                      <input id="confirmPassword" type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} disabled={isSaving} placeholder="Confirm if changing" className={`w-full ${inputBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60`} />
                                  </div>
                              </>
                          )}
                      </div>
                      {isEditing && (
                        <div className="flex justify-end gap-2 mt-5">
                          <button type="button" onClick={() => { setIsEditing(false); setError(null); setFormData({name: userData.name, email: userData.email, currentPassword: '', newPassword: '', confirmPassword: ''}); }} disabled={isSaving} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`}>Cancel</button>
                          <button type="submit" disabled={isSaving || isLoading} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonPrimaryClass} ${buttonPrimaryHoverEffect} flex items-center justify-center min-w-[80px]`}>
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save</>}
                          </button>
                        </div>
                      )}
                    </form>
                 </div>
                 {/* Account Actions Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                    <h2 className={`text-base sm:text-lg font-semibold mb-4 ${headingClass}`}>Account Actions</h2>
                    <div className="space-y-3">
                        <button onClick={handleSignOut} className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md ${buttonSecondaryClass}`}><LogOut className="w-4 h-4" /> Sign Out</button>
                        <button onClick={() => { setShowDeleteConfirm(true); setFormData(prev => ({ ...prev, currentPassword: '' })); setError(null); }} className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 text-sm font-medium rounded-md ${buttonDangerClass}`}><Trash2 className="w-4 h-4" /> Delete Account...</button>
                    </div>
                 </div>
                 {/* Universal AI Context Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${headingClass}`}><BrainCircuit className="w-5 h-5 text-purple-400" /> Universal AI Context</h2>
                        {!isEditingAiContext && (<button type="button" onClick={() => { setIsEditingAiContext(true); setAiContextError(null); }} disabled={isLoadingAiContext || isSavingAiContext} className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`}>Edit</button>)}
                    </div>
                    <p className={`${subheadingClass} text-xs sm:text-sm mb-4`}>Provide background information that the AI can always access to personalize its responses and suggestions for you.</p>
                    {aiContextError && (<div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${aiContextErrorBoxBg}`}><AlertCircle className={`w-4 h-4 shrink-0 mt-px ${aiContextErrorTextColor}`} /><p className={`${aiContextErrorTextColor} text-xs sm:text-sm`}>{aiContextError}</p></div>)}
                    {isLoadingAiContext ? (<div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>)
                      : (<div className="space-y-4">
                          <div><label htmlFor="workDescription" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Role / Work</label><textarea id="workDescription" name="workDescription" rows={3} value={aiContextData.workDescription} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Software Engineer..." className={`w-full ${textareaBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 resize-y`}/></div>
                          <div><label htmlFor="shortTermFocus" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Current Focus</label><textarea id="shortTermFocus" name="shortTermFocus" rows={3} value={aiContextData.shortTermFocus} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Completing Project Phoenix..." className={`w-full ${textareaBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 resize-y`}/></div>
                          <div><label htmlFor="longTermGoals" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Long-Term Goals</label><textarea id="longTermGoals" name="longTermGoals" rows={3} value={aiContextData.longTermGoals} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Transition to Tech Lead..." className={`w-full ${textareaBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 resize-y`}/></div>
                          <div><label htmlFor="otherContext" className={`block text-xs font-medium mb-1 ${subheadingClass}`}>Other Context</label><textarea id="otherContext" name="otherContext" rows={3} value={aiContextData.otherContext} onChange={handleAiContextInputChange} disabled={!isEditingAiContext || isSavingAiContext} placeholder="e.g., Preferred communication style..." className={`w-full ${textareaBg} rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-60 resize-y`}/></div>
                          {isEditingAiContext && (<div className="flex justify-end gap-2 mt-5"><button type="button" onClick={handleCancelAiContextEdit} disabled={isSavingAiContext} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonSecondaryClass}`}>Cancel</button><button type="button" onClick={handleSaveAiContext} disabled={isSavingAiContext} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${buttonPrimaryClass} ${buttonPrimaryHoverEffect} flex items-center justify-center min-w-[80px]`}>{isSavingAiContext ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" /> Save Context</>}</button></div>)}
                      </div>)}
                 </div>
               </div>

               <div className="flex flex-col gap-4 lg:gap-6">
                 {/* Appearance Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                    <h2 className={`text-base sm:text-lg font-semibold mb-4 ${headingClass}`}>Appearance</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between"><label htmlFor="illuminate-toggle" className="flex items-center cursor-pointer gap-3"><Sun className={`w-5 h-5 shrink-0 ${isIlluminateEnabled ? 'text-yellow-500' : placeholderIconColor}`} /><div><span className={`font-medium text-sm ${headingClass}`}>Illuminate</span><p className={`${subheadingClass} text-xs mt-0.5`}>Light mode for sharp focus.</p></div></label><label className="relative inline-flex items-center cursor-pointer"><input id="illuminate-toggle" type="checkbox" checked={isIlluminateEnabled} onChange={(e) => handleToggleIlluminate(e.target.checked)} className="sr-only peer"/><div className={`w-9 h-5 rounded-full peer transition-colors ${isIlluminateEnabled ? 'bg-blue-600' : 'bg-gray-600'} peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all`}></div></label></div>
                        <div className="flex items-center justify-between"><label htmlFor="blackout-toggle" className="flex items-center cursor-pointer gap-3"><Moon className={`w-5 h-5 shrink-0 ${isBlackoutEnabled ? 'text-indigo-400' : placeholderIconColor}`} /><div><span className={`font-medium text-sm ${headingClass}`}>Blackout</span><p className={`${subheadingClass} text-xs mt-0.5`}>Dark mode for eased eyes.</p></div></label><label className="relative inline-flex items-center cursor-pointer"><input id="blackout-toggle" type="checkbox" checked={isBlackoutEnabled} onChange={(e) => handleToggleBlackout(e.target.checked)} className="sr-only peer"/><div className={`w-9 h-5 rounded-full peer transition-colors ${isBlackoutEnabled ? 'bg-indigo-600' : 'bg-gray-600'} peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all`}></div></label></div>
                        <div className="pl-8 space-y-4">
                            {isIlluminateEnabled && (<div className="flex items-center justify-between"><label htmlFor="sidebar-illuminate-toggle" className="flex items-center cursor-pointer gap-3"><PanelLeftDashed className={`w-5 h-5 shrink-0 ${placeholderIconColor}`} /><div><span className={`font-medium text-sm ${headingClass}`}>Sidebar Illuminate</span><p className={`${subheadingClass} text-xs mt-0.5`}>Apply light mode to sidebar.</p></div></label><label className="relative inline-flex items-center cursor-pointer"><input id="sidebar-illuminate-toggle" type="checkbox" checked={isSidebarIlluminateEnabled} onChange={(e) => setIsSidebarIlluminateEnabled(e.target.checked)} className="sr-only peer"/><div className={`w-9 h-5 rounded-full peer transition-colors bg-gray-300 peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all`}></div></label></div>)}
                            {isBlackoutEnabled && (<div className="flex items-center justify-between"><label htmlFor="sidebar-blackout-toggle" className="flex items-center cursor-pointer gap-3"><PanelLeftDashed className={`w-5 h-5 shrink-0 ${placeholderIconColor}`} /><div><span className={`font-medium text-sm ${headingClass}`}>Sidebar Blackout</span><p className={`${subheadingClass} text-xs mt-0.5`}>Apply dark mode to sidebar.</p></div></label><label className="relative inline-flex items-center cursor-pointer"><input id="sidebar-blackout-toggle" type="checkbox" checked={isSidebarBlackoutEnabled} onChange={(e) => setIsSidebarBlackoutEnabled(e.target.checked)} className="sr-only peer"/><div className={`w-9 h-5 rounded-full peer transition-colors bg-gray-600 peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all`}></div></label></div>)}
                        </div>
                    </div>
                 </div>
                 {/* Subscription Card */}
                 <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                   <div className="flex items-center justify-between mb-4">
                     <h2 className={`text-base sm:text-lg font-semibold flex items-center gap-1.5 ${headingClass}`}>Subscription</h2>
                     {userCurrentTier === 'loading' && <span className="text-xs text-gray-500">Checking...</span>}
                     {userCurrentTier === 'premium' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm">Premium</span>)}
                     {userCurrentTier === 'pro' && (<span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-teal-400 to-cyan-500 text-white shadow-sm">Pro</span>)}
                     {userCurrentTier === 'basic' && (<span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${isIlluminateEnabled ? 'bg-blue-100 text-blue-800' : 'bg-blue-900/70 text-blue-200'}`}>Basic</span>)}
                   </div>
                   <div className="space-y-3">
                     {userCurrentTier === 'loading' && <div className="text-sm text-gray-400">Loading subscription details...</div>}
                      {userCurrentTier === 'premium' && (
                          <>
                              <p className={`text-sm ${subheadingClass} mb-2`}>Your premium plan includes:</p>
                              <ul className={`list-disc list-outside pl-5 space-y-1.5 text-xs sm:text-sm ${subheadingClass}`}>
                                  <li>Unlimited PDF and Text Notes</li>
                                  <li>Unlimited YouTube Notes</li>
                                  <li>Unlimited AI Chat Interactions</li>
                                  <li>2,500 Tokens Included</li>
                                  <li>Add Unlimited Friends</li>
                                  <li>Unlimited Access to Smart Overview</li>
                              </ul>
                          </>
                      )}
                      {userCurrentTier === 'pro' && (
                          <>
                              <p className={`text-sm ${subheadingClass} mb-2`}>Your pro plan includes:</p>
                              <ul className={`list-disc list-outside pl-5 space-y-1.5 text-xs sm:text-sm ${subheadingClass}`}>
                                  <li>10 PDF and Text Notes per month</li>
                                  <li>5 YouTube Notes per month</li>
                                  <li>200 AI Chat Interactions per month</li>
                                  <li>1,000 Tokens Included</li>
                                  <li>Add up to 10 Friends</li>
                                  <li>Limited Access to Smart Overview</li>
                              </ul>
                          </>
                      )}
                      {userCurrentTier === 'basic' && (
                          <>
                              <p className={`text-sm ${subheadingClass} mb-2`}>Your free plan includes:</p>
                              <ul className={`list-disc list-outside pl-5 space-y-1.5 text-xs sm:text-sm ${subheadingClass}`}>
                                  <li>2 PDF and Text Notes per month</li>
                                  <li>1 Youtube Note per month</li>
                                  <li>10 AI Chat Interactions per month</li>
                                  <li>500 Tokens Included</li>
                                  <li>Add Up to 3 Friends</li>
                              </ul>
                          </>
                      )}

                      {(userCurrentTier === 'premium' || userCurrentTier === 'pro') && stripeCustomerId && (
                        <div className="pt-4 border-t border-gray-700/30 dark:border-gray-700/50">
                          {portalError && (<p className="text-xs text-red-400 mb-2 flex items-center gap-1"><AlertCircle size={14} /> {portalError}</p>)}
                          <button onClick={handleManageSubscription} disabled={isManagingSubscription} className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${buttonSecondaryClass} disabled:opacity-70`}>
                            {isManagingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {isManagingSubscription ? 'Loading Portal...' : 'Manage Billing & Subscription'}
                          </button>
                        </div>
                      )}
                      {userCurrentTier === 'pro' && (
                        <Link to="/pricing" className={`block mt-4 w-full ${buttonPrimaryClass} ${buttonPrimaryHoverEffect} rounded-md`}>
                          <span className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium"><Crown className="w-4 h-4" /> Upgrade to Premium</span>
                        </Link>
                      )}
                      {userCurrentTier === 'basic' && (
                        <Link to="/pricing" className={`block mt-4 w-full ${buttonPrimaryClass} ${buttonPrimaryHoverEffect} rounded-md`}>
                          <span className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium"><Star className="w-4 h-4" /> Upgrade Plan</span>
                        </Link>
                      )}
                   </div>
                 </div>
                 {/* --- MONTHLY USAGE & LIMITS CARD (Conditionally Rendered) --- */}
                 {userCurrentTier !== 'premium' && (
                     <div className={`${cardClass} rounded-xl p-4 sm:p-5`}>
                       <h2 className={`text-base sm:text-lg font-semibold mb-4 flex items-center gap-2 ${headingClass}`}>
                         <Activity className="w-5 h-5 text-indigo-400" /> Monthly Usage
                       </h2>
                       {isLoadingUsage ? (
                         <div className="flex justify-center items-center h-32">
                           <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                         </div>
                       ) : usageError ? (
                         <div className={`p-3 rounded-md flex items-start gap-2 text-xs ${errorBoxBg} ${errorTextColor}`}>
                           <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                           <span>{usageError}</span>
                         </div>
                       ) : (
                         <>
                           <div className="space-y-4">
                             <div>
                               <label className={`block text-sm font-medium mb-0.5 ${headingClass}`}>AI Chat Interactions</label>
                               <ProgressBar 
                                 current={chatUsage?.count || 0} 
                                 total={getChatLimitForTier(userCurrentTier)}
                                 isIlluminate={isIlluminateEnabled} 
                               />
                             </div>

                             <div>
                               <label className={`block text-sm font-medium mb-0.5 ${headingClass}`}>PDF & Text Notes</label>
                               <ProgressBar 
                                 current={noteUsage?.pdfAi || 0}
                                 total={getNoteLimitsForTier(userCurrentTier).pdfAi}
                                 isIlluminate={isIlluminateEnabled}
                               />
                             </div>

                             <div>
                               <label className={`block text-sm font-medium mb-0.5 ${headingClass}`}>YouTube Notes</label>
                               <ProgressBar
                                 current={noteUsage?.youtube || 0}
                                 total={getNoteLimitsForTier(userCurrentTier).youtube}
                                 isIlluminate={isIlluminateEnabled}
                               />
                             </div>
                           </div>
                           <p className={`mt-5 pt-3 border-t text-center text-xs ${subheadingClass} ${isIlluminateEnabled ? 'border-gray-200' : 'border-gray-700/60'}`}>
                             Usage limits reset on {getNextMonthResetDate()}.
                           </p>
                         </>
                       )}
                     </div>
                 )}
               </div>
             </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
