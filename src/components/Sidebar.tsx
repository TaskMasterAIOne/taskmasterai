import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Settings,
  FileText,
  ZapOff,
  Crown,
  CircleUserRound,
  PanelRightClose,
  PanelRightOpen,
  Menu,
  Folders,
  MessageCircle
} from "lucide-react";
import { LogoSmall } from "./LogoSmall";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { User } from 'firebase/auth';
import { UserTier, onUserProfileSnapshot, PREMIUM_EMAILS, PRO_EMAILS } from '../lib/current-paying-user';

interface SidebarProps {
  userName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
}

const CollapsedLogoIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="collapsed-logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#635BFF' }} />
        <stop offset="100%" style={{ stopColor: '#8A85FF' }} />
      </linearGradient>
    </defs>
    <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="url(#collapsed-logo-gradient)"/>
  </svg>
);

const DEV_EMAILS = ["bajinsrinivasr@lexington1.net"];
const INTERN_EMAILS = ["poojarameshkumar789@gmail.com", "ali.ahsan.a214@gmail.com", "amrish.naranappa@gmail.com", "navaneeth.ravindranath@gmail.com", "Goduwin_Ravi@yahoo.com", "gautham.paddu@outlook.com", "Isha.kandhaluram@gmail.com"];

export function Sidebar({
  userName,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  setIsMobileOpen,
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

  useEffect(() => {
    let profileListenerUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (profileListenerUnsubscribe) {
        profileListenerUnsubscribe();
      }
      
      setCurrentUser(user);
      setShowInitialAvatarGlow(false);
      setShowTags(false);

      if (user) {
        setUserTier('loading');
        
        const email = user.email?.toLowerCase();
        const isHardcodedPremium = email ? PREMIUM_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
        const isHardcodedPro = email ? PRO_EMAILS.map(e => e.toLowerCase()).includes(email) : false;
        
        const userIsDev = user.email ? DEV_EMAILS.includes(user.email) : false;
        const userIsIntern = user.email ? INTERN_EMAILS.includes(user.email) : false;
        setIsDev(userIsDev);
        setIsIntern(userIsIntern);
        if (userIsDev || userIsIntern) {
          setShowInitialAvatarGlow(true);
        }

        profileListenerUnsubscribe = onUserProfileSnapshot(user.uid, (profile) => {
          if (isHardcodedPremium) {
            setUserTier('premium');
          } else if (isHardcodedPro) {
            setUserTier('pro');
          } else if (profile) {
            setUserTier(profile.activeTier || 'basic');
          } else {
            setUserTier('basic');
          }
        });

      } else {
        setCurrentUser(null);
        setUserTier('loading');
        setIsDev(false);
        setIsIntern(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileListenerUnsubscribe) {
        profileListenerUnsubscribe();
      }
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
    { label: "Notes", icon: FileText, path: "/notes" },
    { label: "Focus", icon: ZapOff, path: "/focus", isUnderMaintenance: true },
    { label: "AI Chat", icon: MessageCircle, path: "/ai" },
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

  const sidebarContainerBg = "bg-white dark:bg-[#12141D]";
  const sidebarTextColor = "text-gray-500 dark:text-gray-400";
  const sidebarBorderColor = "border-transparent dark:border-transparent";
  const menuItemHoverBg = "hover:bg-gray-100 dark:hover:bg-[#1A1D29]";
  const menuItemHoverText = "hover:text-gray-800 dark:hover:text-gray-100";
  const activeMenuItemBg = "bg-indigo-50 dark:bg-[#635BFF]/20";
  const activeMenuItemText = "text-indigo-600 dark:text-[#A7A3FF]";
  const activeMenuItemFontWeight = "font-semibold";
  const userProfileNameText = "text-gray-800 dark:text-gray-100";
  const userProfileTierTextBasic = "text-gray-500 dark:text-gray-400";
  const userProfileHoverBg = "hover:bg-gray-100 dark:hover:bg-[#1A1D29]/80";
  const avatarDefaultBg = "bg-gray-200 dark:bg-gray-700";
  const avatarDefaultIconColor = "text-gray-500 dark:text-gray-400";
  const mobileHeaderBg = "bg-white dark:bg-[#12141D]";
  const mobileHeaderBorder = "border-b border-gray-200 dark:border-gray-700/50";
  const mobileMenuButtonColor = "text-gray-600 dark:text-gray-300";
  let initialAvatarGlowClass = "";
  if (showInitialAvatarGlow) {
    if (isDev) initialAvatarGlowClass = "animate-avatar-initial-glow-dev";
    else if (isIntern) initialAvatarGlowClass = "animate-avatar-initial-glow-intern";
  }
  const canShowDevOrInternTags = showTags && (isDev || isIntern) && !isMobileOpen;
  const areDevOrInternTagsVisible = canShowDevOrInternTags && (!isCollapsed || isMobileOpen);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 ${mobileHeaderBg} ${mobileHeaderBorder} h-14 z-40 md:hidden flex items-center px-4`}>
        <button
          onClick={() => {
            if (typeof setIsMobileOpen === 'function') {
              setIsMobileOpen(true);
            }
          }}
          className={`${mobileMenuButtonColor} p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors`}
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      <div className="pt-14 md:pt-0" />

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 md:hidden"
          onClick={() => {
            if (typeof setIsMobileOpen === 'function') {
              setIsMobileOpen(false);
            }
          }}
        />
      )}
      <aside 
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 left-0 h-full ${sidebarContainerBg} ${sidebarBorderColor} flex flex-col py-4 px-3 font-poppins border-r z-[60] transition-all duration-300 ease-in-out ${isCollapsed && !isMobileOpen ? "md:w-20" : "md:w-64"} ${isMobileOpen ? "w-64 translate-x-0" : "-translate-x-full md:translate-x-0"} md:h-full`}>
        <div className={`mb-5 flex items-center h-[44px] relative ${isCollapsed && !isMobileOpen ? "justify-center" : "justify-between"}`}>
            <a href="/" title="TaskMaster AI">
                {(!isCollapsed || isMobileOpen) ? (
                    <div className="ml-1">
                        <LogoSmall />
                    </div>
                ) : (
                    <div className="ml-[-15px]">
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
                    <PanelRightOpen className="w-5 h-5" strokeWidth={2} />
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
                    ? <PanelRightClose className="w-5 h-5" strokeWidth={2} /> 
                    : <PanelRightOpen className="w-5 h-5" strokeWidth={2} />
                }
            </button>
        </div>
        <nav className="flex-grow">
          <ul className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isUnderMaintenance = (item as any).isUnderMaintenance;
              return (
                <li key={item.label}>
                  <button onClick={() => handleNavigation(item.path)} className={`w-full flex items-center gap-3 px-2.5 py-2.5 text-sm rounded-lg transition-all duration-200 ease-out transform hover:scale-[1.01] ${sidebarTextColor} ${menuItemHoverBg} ${menuItemHoverText} ${isActive ? `${activeMenuItemBg} ${activeMenuItemText} ${activeMenuItemFontWeight}` : ""} ${isUnderMaintenance ? 'opacity-70' : ''}`} title={isCollapsed && !isMobileOpen ? item.label : undefined}>
                    <Icon className="w-5 h-5 min-w-[1.25rem]" strokeWidth={isActive ? 2.5 : 2} />
                    {(!isCollapsed || isMobileOpen) && (
                      <span className="flex items-center gap-2">
                        <span className="whitespace-nowrap">{item.label}</span>
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
        <div className="mt-auto flex flex-col gap-3 pt-4 ">
          {!isSettingsPage && (userTier === 'basic' || userTier === 'pro') && (
            <button onClick={handleUpgradeClick} className={`mx-auto flex items-center justify-center text-white rounded-lg transition-all duration-200 ease-out hover:opacity-90 active:scale-95 transform hover:scale-[1.02] bg-gradient-to-br from-[#635BFF] to-[#8A85FF] shadow-lg shadow-indigo-500/30 dark:shadow-indigo-500/20 ${isCollapsed && !isMobileOpen ? "w-10 h-10 aspect-square" : "w-full px-4 py-2.5"}`} title={isCollapsed && !isMobileOpen ? (userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium") : undefined}>
              <Crown className={`min-w-[1.25rem] ${isCollapsed && !isMobileOpen ? "w-5 h-5" : "w-5 h-5 mr-2"}`} strokeWidth={2} />
              {(!isCollapsed || isMobileOpen) && ( <span className="text-sm font-medium whitespace-nowrap">{userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium"}</span> )}
            </button>
          )}
          <button onClick={() => navigate("/settings")} className={`group w-full rounded-lg transition-colors duration-150 ${userProfileHoverBg} ${isCollapsed && !isMobileOpen ? "flex flex-col items-center justify-center py-2.5" : "flex items-center gap-3 px-3 py-2.5"}`} title={isCollapsed && !isMobileOpen ? `${userName || "User"} - Settings` : undefined}>
            <div className="relative flex-shrink-0">
              <div className={`w-9 h-9 rounded-full overflow-hidden ${avatarDefaultBg} ${initialAvatarGlowClass} flex items-center justify-center`} onAnimationEnd={handleInitialGlowEnd}>
                  {currentUser?.photoURL ? ( <img src={currentUser.photoURL} alt={userName || "User"} className="w-full h-full object-cover" /> ) : ( <CircleUserRound className={`w-5 h-5 ${avatarDefaultIconColor}`} strokeWidth={2} /> )}
              </div>
              {areDevOrInternTagsVisible && (
                <div className="absolute flex items-center gap-0.5 animate-fade-in-tags -top-1.5 -right-2">
                  {isDev && ( <span className="px-1 py-0.5 text-[8px] font-semibold text-white bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow select-none" title="Developer">DEV</span> )}
                  {isIntern && ( <span className="px-1 py-0.5 text-[8px] font-semibold text-white bg-gradient-to-br from-teal-500 to-green-600 rounded-full shadow select-none" title="Intern">INT</span> )}
                </div>
              )}
            </div>
            {isCollapsed && !isMobileOpen && (
              <div className="text-center mt-1">
                  {userTier === 'loading' && (
                      <div className="w-2 h-2 mx-auto bg-gray-300 dark:bg-gray-600 rounded-full" title="Loading tier..."></div>
                  )}
                  {userTier === 'premium' && (
                      <div className="w-2 h-2 mx-auto bg-indigo-500 rounded-full" title="Premium Tier"></div>
                  )}
                  {userTier === 'pro' && (
                      <div className="w-2 h-2 mx-auto bg-sky-500 rounded-full" title="Pro Tier"></div>
                  )}
                  {userTier === 'basic' && (
                      <div className="w-2 h-2 mx-auto bg-gray-400 dark:bg-gray-500 rounded-full" title="Basic Tier"></div>
                  )}
              </div>
            )}
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col items-start min-w-0 text-left">
                <span className={`text-sm font-medium truncate max-w-[140px] ${userProfileNameText}`}> {userName || (currentUser ? "User" : "Loading...")} </span>
                <div className="flex items-center">
                  {userTier === 'premium' ? ( <span className="text-xs font-semibold bg-gradient-to-br from-[#635BFF] to-[#8A85FF] text-transparent bg-clip-text"> Premium </span> ) :
                   userTier === 'pro' ? ( <span className="text-xs font-semibold bg-gradient-to-r from-sky-400 to-cyan-500 text-transparent bg-clip-text"> Pro </span> ) :
                   userTier === 'basic' ? ( <span className={`text-xs ${userProfileTierTextBasic}`}>Basic</span> ) :
                   ( <span className={`text-xs ${userProfileTierTextBasic}`}>Loading...</span> )}
                </div>
              </div>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
