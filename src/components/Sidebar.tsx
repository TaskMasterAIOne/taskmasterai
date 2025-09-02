import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Settings,
  ZapOff,
  Crown,
  CircleUserRound,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  Folders,
  MessageCircle,
  Notebook
} from "lucide-react";
import { LogoSmall } from "./LogoSmall";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { User } from 'firebase/auth';
import { UserTier, PREMIUM_EMAILS, PRO_EMAILS, getUserTier } from '../lib/current-paying-user';
import { DEV_EMAILS, INTERN_EMAILS } from '../config/constants';

interface SidebarProps {
  userName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  userProfile?: any;
}

const CollapsedLogoIcon = () => (
  <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="#635BFF"/>
  </svg>
);



export function Sidebar({
  userName,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  setIsMobileOpen,
  userProfile,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsPage = location.pathname === "/settings";
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [isDev, setIsDev] = useState<boolean>(false);
  const [isIntern, setIsIntern] = useState<boolean>(false);
  const [showInitialAvatarGlow, setShowInitialAvatarGlow] = useState<boolean>(false);
  const [showTags, setShowTags] = useState<boolean>(false);
  const [isProfileImageValid, setIsProfileImageValid] = useState<boolean>(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');

  // Function to validate profile picture URL
  const validateProfilePicture = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      
      // Timeout after 3 seconds to prevent hanging
      setTimeout(() => resolve(false), 3000);
    });
  };

  // Update profile picture when userProfile prop changes
  useEffect(() => {
    if (userProfile?.photoURL) {
      validateProfilePicture(userProfile.photoURL).then((isValid) => {
        if (isValid) {
          setProfileImageUrl(userProfile.photoURL);
          setIsProfileImageValid(true);
        } else {
          setProfileImageUrl('');
          setIsProfileImageValid(false);
        }
      });
    } else {
      setProfileImageUrl('');
      setIsProfileImageValid(false);
    }
  }, [userProfile?.photoURL]);

  // Update user tier when userProfile changes - use proper tier checking logic
  useEffect(() => {
    const updateTierFromProfile = async () => {
      if (currentUser && userProfile) {
        try {
          const tier = await getUserTier(currentUser.uid, currentUser.email);
          setUserTier(tier);
        } catch (error) {
          console.error('Error getting user tier:', error);
          // Fallback to hardcoded check
          const email = currentUser.email?.toLowerCase();
          const isHardcodedPremium = email ? PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
          const isHardcodedPro = email ? PRO_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
          
          if (isHardcodedPremium) {
            setUserTier('premium');
          } else if (isHardcodedPro) {
            setUserTier('pro');
          } else {
            setUserTier(userProfile?.activeTier || 'basic');
          }
        }
      }
    };

    updateTierFromProfile();
  }, [currentUser, userProfile]);

  useEffect(() => {
    const authUnsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      setShowInitialAvatarGlow(false);
      setShowTags(false);
      
      if (user) {
        const email = user.email?.toLowerCase();
        
        // Check for dev and intern status using centralized lists
        const userIsDev = user.email ? DEV_EMAILS.map(e => e.toLowerCase()).includes(email || '') : false;
        const userIsIntern = user.email ? INTERN_EMAILS.map(e => e.toLowerCase()).includes(email || '') : false;
        setIsDev(userIsDev);
        setIsIntern(userIsIntern);
        if (userIsDev || userIsIntern) {
          setShowInitialAvatarGlow(true);
        }

        // Get proper user tier using centralized logic
        try {
          const tier = await getUserTier(user.uid, user.email);
          setUserTier(tier);
        } catch (error) {
          console.error('Error getting user tier in auth state change:', error);
          // Fallback to basic hardcoded check
          const isHardcodedPremium = email ? PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
          const isHardcodedPro = email ? PRO_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
          
          if (isHardcodedPremium) {
            setUserTier('premium');
          } else if (isHardcodedPro) {
            setUserTier('pro');
          } else {
            setUserTier('basic');
          }
        }
      } else {
        setCurrentUser(null);
        setUserTier('loading');
        setIsDev(false);
        setIsIntern(false);
      }
    });

    return () => {
      authUnsubscribe();
    };
  }, []);
  
  const handleInitialGlowEnd = () => {
    setShowInitialAvatarGlow(false);
    if (isDev || isIntern) {
      setShowTags(true);
    }
  };

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Folders", icon: Folders, path: "/folders" },
    { label: "Notes", icon: Notebook, path: "/notes" },
    { label: "Focus", icon: ZapOff, path: "/focus"},
    { label: "Chat", icon: MessageCircle, path: "/chat" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    if (typeof setIsMobileOpen === 'function') {
      setIsMobileOpen(false);
    }
  };

  const handleUpgradeClick = () => {
    navigate("/pricing");
    if (typeof setIsMobileOpen === 'function') {
      setIsMobileOpen(false);
    }
  };

  const sidebarContainerBg = "bg-theme-sidebar";
  const sidebarTextColor = "text-theme-text-secondary";
  const sidebarBorderColor = "border-theme-border-primary";
  const menuItemHoverBg = "hover:bg-theme-highlight";
  const menuItemHoverText = "hover:text-theme-text-primary";
  const activeMenuItemBg = "bg-theme-highlight";
  const activeMenuItemText = "text-theme-text-primary";
  const activeMenuItemFontWeight = "font-semibold";
  const userProfileNameText = "text-theme-text-primary";
  const userProfileTierTextBasic = "text-theme-text-secondary";
  const userProfileHoverBg = "hover:bg-theme-highlight";
  const avatarDefaultBg = "bg-theme-highlight";
  const avatarDefaultIconColor = "text-theme-text-secondary";
  const mobileHeaderBg = "bg-theme-sidebar";
  const mobileHeaderBorder = "border-b border-theme-border-secondary";
  const mobileMenuButtonColor = "text-theme-text-secondary";
  let initialAvatarGlowClass = "";
  if (showInitialAvatarGlow) {
    if (isDev) initialAvatarGlowClass = "animate-avatar-initial-glow-dev";
    else if (isIntern) initialAvatarGlowClass = "animate-avatar-initial-glow-intern";
  }
  const canShowDevOrInternTags = showTags && (isDev || isIntern) && !isMobileOpen;
  const areDevOrInternTagsVisible = canShowDevOrInternTags && (!isCollapsed || isMobileOpen);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 ${mobileHeaderBg} ${mobileHeaderBorder} h-12 sm:h-14 z-40 md:hidden flex items-center px-3 sm:px-4`}>
        <button
          onClick={() => {
            if (typeof setIsMobileOpen === 'function') {
              setIsMobileOpen(true);
            }
          }}
          className={`${mobileMenuButtonColor} p-1.5 sm:p-2 rounded-md hover:bg-theme-highlight transition-colors`}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </header>

      <div className="pt-14 md:pt-0" />

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 md:hidden"
          onClick={() => {
            if (typeof setIsMobileOpen === 'function') {
              setIsMobileOpen(false);
            }
          }}
        />
      )}
      <aside 
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 h-full ${sidebarContainerBg} ${sidebarBorderColor} flex flex-col py-3 sm:py-4 px-2.5 sm:px-3 font-clarika border-r z-[60] transition-all duration-300 ease-in-out ${isCollapsed && !isMobileOpen ? "md:w-20" : "md:w-64"} ${isMobileOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0"} md:h-full`}>
        <div className={`mb-5 flex items-center h-[44px] relative ${isCollapsed && !isMobileOpen ? "justify-center" : "justify-between"}`}>
            <a href="/" title="TaskMaster AI">
                {(!isCollapsed || isMobileOpen) ? (
                    <div className="ml-0.5 sm:ml-1">
                        <LogoSmall />
                    </div>
                ) : (
                    <div className="ml-[-12px] sm:ml-[-15px]">
                        <CollapsedLogoIcon />
                    </div>
                )}
            </a>
            {isMobileOpen && (
                <button
                    onClick={() => setIsMobileOpen(false)}
                    className={`p-2 rounded-lg transition-colors ${sidebarTextColor} ${menuItemHoverBg} ${menuItemHoverText} md:hidden`}
                    title="Close menu"
                >
                    <PanelRightOpen className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                </button>
            )}
            <button
                onClick={onToggleCollapse}
                className={`hidden md:block p-2 rounded-lg transition-all duration-300 ease-in-out z-10 ${sidebarTextColor} ${
                    isCollapsed && !isMobileOpen 
                        ? `absolute top-0 -translate-y-[-3.9px] right-[-5px] translate-x-1/2 ${sidebarContainerBg} hover:scale-110` 
                        : `${menuItemHoverBg} ${menuItemHoverText}`
                }`}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {isCollapsed
                    ? <PanelRightClose className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    : <PanelRightOpen className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                }
            </button>
        </div>
        <nav className="flex-grow">
          <ul className="flex flex-col gap-1 sm:gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              // Enhanced active state detection
              const currentPath = location.pathname;
              const itemPath = item.path;
              const isActive = currentPath === itemPath ||
                              (itemPath === '/dashboard' && (currentPath === '/' || currentPath === '')) ||
                              currentPath.startsWith(itemPath + '/') ||
                              (itemPath !== '/' && currentPath === itemPath);
              const isUnderMaintenance = (item as any).isUnderMaintenance;
              return (
                <li key={item.label}>
                  <button onClick={() => handleNavigation(item.path)} className={`w-full flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-2 sm:py-2.5 sidebar-text-responsive rounded-lg transition-all duration-200 ease-out transform hover:scale-[1.01] ${sidebarTextColor} ${menuItemHoverBg} ${menuItemHoverText} ${isActive ? `${activeMenuItemBg} ${activeMenuItemText} ${activeMenuItemFontWeight}` : ""} ${isUnderMaintenance ? 'opacity-70' : ''}`} title={isCollapsed && !isMobileOpen ? item.label : undefined}>
                    <Icon className="sidebar-icon-responsive min-w-[1rem] sm:min-w-[1.25rem] flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                    {(!isCollapsed || isMobileOpen) && (
                      <span className="flex items-center gap-1 sm:gap-1.5">
                        <span className="whitespace-nowrap sidebar-menu-text leading-none">{item.label}</span>
                        {isUnderMaintenance && (
                          <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full font-medium">
                            ⚠️
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-2 sm:gap-3 pt-3 sm:pt-4">
          {!isSettingsPage && (userTier === 'basic' || userTier === 'pro') && (
            <button onClick={handleUpgradeClick} className={`mx-auto flex items-center justify-center text-white rounded-lg transition-all duration-200 ease-out hover:opacity-90 active:scale-95 transform hover:scale-[1.02] bg-theme-solid-button shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/20 ${isCollapsed && !isMobileOpen ? "w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 aspect-square" : "w-full px-3 sm:px-4 py-2 sm:py-2.5"}`} title={isCollapsed && !isMobileOpen ? (userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium") : undefined}>
              <Crown className={`min-w-[1rem] sm:min-w-[1.25rem] ${isCollapsed && !isMobileOpen ? "w-4 h-4 sm:w-5 sm:h-5" : "w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2"}`} strokeWidth={2} />
              {(!isCollapsed || isMobileOpen) && ( <span className="text-xs sm:text-sm font-bold whitespace-nowrap">{userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium"}</span> )}
            </button>
          )}
          <button onClick={() => navigate("/settings")} className={`group w-full rounded-lg transition-colors duration-150 ${userProfileHoverBg} ${isCollapsed && !isMobileOpen ? "flex flex-col items-center justify-center py-2 sm:py-2.5" : "flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-2 sm:py-2.5"}`} title={isCollapsed && !isMobileOpen ? `${userName || "User"} - Settings` : undefined}>
            <div className="relative flex-shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full overflow-hidden ${avatarDefaultBg} ${initialAvatarGlowClass} flex items-center justify-center`} onAnimationEnd={handleInitialGlowEnd}>
                  {(profileImageUrl && isProfileImageValid) ? (
                    <img
                      src={profileImageUrl}
                      alt={userName || "User"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CircleUserRound className={`w-4 h-5 sm:w-5 sm:h-6 ${avatarDefaultIconColor}`} strokeWidth={2} />
                  )}
              </div>
              {areDevOrInternTagsVisible && (
                <div className="absolute flex items-center gap-0.5 animate-fade-in-tags -top-1.5 -right-2">
                  {isDev && ( <span className="px-0.5 sm:px-1 py-0.5 text-[7px] sm:text-[8px] font-semibold text-white bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow select-none" title="Developer">DEV</span> )}
                  {isIntern && ( <span className="px-0.5 sm:px-1 py-0.5 text-[7px] sm:text-[8px] font-semibold text-white bg-gradient-to-br from-teal-500 to-green-600 rounded-full shadow select-none" title="Intern">INT</span> )}
                </div>
              )}
            </div>
            {isCollapsed && !isMobileOpen && (
              <div className="text-center mt-2 sm:mt-3">
                  {userTier === 'loading' && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mx-auto bg-gray-300 dark:bg-gray-600 rounded-full" title="Loading tier..."></div>
                  )}
                  {userTier === 'premium' && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mx-auto bg-indigo-500 rounded-full" title="Premium Tier"></div>
                  )}
                  {userTier === 'pro' && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mx-auto bg-sky-500 rounded-full" title="Pro Tier"></div>
                  )}
                  {userTier === 'basic' && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 mx-auto bg-gray-400 dark:bg-gray-500 rounded-full" title="Basic Tier"></div>
                  )}
              </div>
            )}
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col items-start min-w-0 text-left">
                <span className={`text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-[140px] ${userProfileNameText}`}> {userName || (currentUser ? "User" : "Loading...")} </span>
                <div className="flex items-center">
                  {userTier === 'premium' ? ( <span className="text-[10px] sm:text-xs font-semibold bg-gradient-to-br from-[#635BFF] to-[#8A85FF] text-transparent bg-clip-text"> Premium </span> ) :
                   userTier === 'pro' ? ( <span className="text-[10px] sm:text-xs font-semibold bg-gradient-to-r from-sky-400 to-cyan-500 text-transparent bg-clip-text"> Pro </span> ) :
                   userTier === 'basic' ? ( <span className={`text-[10px] sm:text-xs ${userProfileTierTextBasic}`}>Basic</span> ) :
                   ( <span className={`text-[10px] sm:text-xs ${userProfileTierTextBasic}`}>Loading...</span> )}
                </div>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
