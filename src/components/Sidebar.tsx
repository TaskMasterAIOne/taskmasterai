import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Settings,
  FileText,
  CalendarDays,
  Users2,
  Globe2,
  ZapOff,
  Bot,
  Crown,
  CircleUserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Folders,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase";
import { User } from 'firebase/auth';

import { UserTier, getUserTier } from '../lib/current-paying-user';

interface SidebarProps {
  userName: string;
  onToggle?: () => void;
  isCollapsed?: boolean;
  isBlackoutEnabled?: boolean;
  isIlluminateEnabled?: boolean;
}

const DEV_EMAILS = ["bajinsrinivasr@lexington1.net", "fugegate@gmail.com", "draco77654@gmail.com"];
const INTERN_EMAILS = ["intern_example@example.com"]; // Add intern emails here

export function Sidebar({
  userName,
  onToggle,
  isCollapsed = false,
  isBlackoutEnabled = false,
  isIlluminateEnabled = false,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isSettingsPage = location.pathname === "/settings";
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userTier, setUserTier] = useState<UserTier>('loading');
  const [isDev, setIsDev] = useState<boolean>(false);
  const [isIntern, setIsIntern] = useState<boolean>(false);

  // States for new animation sequence
  const [showInitialAvatarGlow, setShowInitialAvatarGlow] = useState<boolean>(false);
  const [showTags, setShowTags] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      setShowInitialAvatarGlow(false); // Reset glow on auth change
      setShowTags(false); // Reset tags on auth change
      if (user) {
        setUserTier('loading');
        try {
          const tier = await getUserTier(user.uid, user.email);
          setUserTier(tier);
        } catch (error) {
          console.error("Sidebar: Error fetching user tier:", error);
          setUserTier('basic');
        }
        const userIsDev = user.email ? DEV_EMAILS.includes(user.email) : false;
        const userIsIntern = user.email ? INTERN_EMAILS.includes(user.email) : false;
        setIsDev(userIsDev);
        setIsIntern(userIsIntern);

        if (userIsDev || userIsIntern) {
          setShowInitialAvatarGlow(true); // Start initial glow animation
        }

      } else {
        setCurrentUser(null);
        setUserTier('loading');
        setIsDev(false);
        setIsIntern(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleInitialGlowEnd = () => {
    setShowInitialAvatarGlow(false); // Turn off glow class (animation is `forwards` anyway for fade out)
    setShowTags(true); // Make tags visible to start their animation
  };

  const menuItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Folders", icon: Folders, path: "/folders" },
    { label: "Notes", icon: FileText, path: "/notes" },
    { label: "Calendar", icon: CalendarDays, path: "/calendar" },
    { label: "Friends", icon: Users2, path: "/friends" },
    { label: "Community", icon: Globe2, path: "/community" },
    { label: "Focus Mode", icon: ZapOff, path: "/focus-mode" },
    { label: "AI Assistant", icon: Bot, path: "/ai" },
    { label: "Settings", icon: Settings, path: "/settings" },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleUpgradeClick = () => {
    navigate("/pricing");
    setIsMobileMenuOpen(false);
  };

  let sidebarContainerBg = "bg-[#0c111c] text-gray-300 border-gray-800/50";
  if (isIlluminateEnabled) {
    sidebarContainerBg = "bg-gray-100 text-gray-900 border-gray-300";
  } else if (isBlackoutEnabled) {
    sidebarContainerBg = "bg-gray-950 text-white border-gray-800/50";
  }
  let toggleButtonBg = "bg-[#0c111c] border-gray-800/50 text-gray-400 hover:text-white";
  if (isIlluminateEnabled) {
    toggleButtonBg = "bg-gray-100 border-gray-300 text-gray-500 hover:text-gray-800";
  } else if (isBlackoutEnabled) {
    toggleButtonBg = "bg-gray-950 border-gray-800/50 text-gray-400 hover:text-white";
  }
  const baseMenuItemClasses = "flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-all duration-200";
  const isActiveClasses = isIlluminateEnabled
    ? "bg-gray-200 text-gray-900 font-medium"
    : "bg-gray-800 text-white font-medium";
  const hoverClasses = isIlluminateEnabled
    ? "hover:bg-gray-200 hover:text-gray-900"
    : "hover:bg-gray-800/70 hover:text-white";
  const defaultTextColor = isIlluminateEnabled ? "text-gray-800" : "text-gray-300";
  const userProfileHoverBg = isIlluminateEnabled ? "hover:bg-gray-200" : "hover:bg-gray-800/50";
  const userProfileText = isIlluminateEnabled ? "text-gray-800" : "text-gray-300";
  const defaultAvatarBg = isIlluminateEnabled ? "bg-gray-300" : "bg-gray-800";
  const defaultAvatarIconColor = isIlluminateEnabled ? "text-gray-600" : "text-gray-400";

  let mobileHeaderBg = "bg-[#0c111c] border-b border-gray-800/50";
  if (isIlluminateEnabled) {
    mobileHeaderBg = "bg-gray-100 border-b border-gray-300";
  } else if (isBlackoutEnabled) {
    mobileHeaderBg = "bg-gray-950 border-b border-gray-800/50";
  }
  const mobileHeaderText = isIlluminateEnabled ? "text-gray-900" : "text-gray-100";

  // Determine which initial glow animation to use
  let initialAvatarGlowClass = "";
  if (showInitialAvatarGlow) {
    if (isDev) {
      initialAvatarGlowClass = "animate-avatar-initial-glow-dev";
    } else if (isIntern) {
      initialAvatarGlowClass = "animate-avatar-initial-glow-intern";
    }
  }

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 ${mobileHeaderBg} h-14 z-40 md:hidden flex items-center px-4 justify-between`}
      >
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`${mobileHeaderText} p-2 hover:opacity-80 transition-opacity`}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="md:ml-0 md:pt-0">
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}
        <div
          className={`
            fixed top-0 left-0 h-full ${sidebarContainerBg} flex flex-col
            py-6 px-3 font-poppins border-r z-50
            transition-all duration-300 ease-in-out
            ${isCollapsed ? "md:w-20" : "md:w-64"}
            ${isMobileMenuOpen ? "w-64 translate-x-0 pt-14" : "-translate-x-full md:translate-x-0"}
            md:pt-6 md:h-full
          `}
        >
          <div className="mb-6 flex items-center pl-3">
            {isCollapsed && !isMobileMenuOpen ? (
              <a href="/"> {/* Collapsed Logo */}
                <svg className="w-8 h-8 text-indigo-500" /* ...SVG Path... */ fill="currentColor" />
              </a>
            ) : (
              <div className="flex items-center justify-between w-full">
                <a href="/" className="flex items-center space-x-2 whitespace-nowrap overflow-hidden">
                  <Logo className="w-8 h-8 flex-shrink-0" />
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.path)}
                  className={` ${baseMenuItemClasses} ${defaultTextColor} ${hoverClasses} ${isActive ? isActiveClasses : ""} transition-transform duration-200 hover:scale-[1.02] `}
                  title={isCollapsed && !isMobileMenuOpen ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 min-w-[1.25rem]" strokeWidth={2} />
                  {(!isCollapsed || isMobileMenuOpen) && <span>{item.label}</span>}
                </button>
              );
            })}
            {onToggle && (
              <button
                onClick={onToggle}
                className={`absolute -right-4 top-6 p-1.5 rounded-full border transition-colors z-50 ${toggleButtonBg} hidden md:block`}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 min-w-[1rem]" strokeWidth={2} />
                ) : (
                  <PanelLeftClose className="w-4 h-4 min-w-[1rem]" strokeWidth={2} />
                )}
              </button>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-4">
            {!isSettingsPage && (userTier === 'basic' || userTier === 'pro') && (
              <button
                onClick={handleUpgradeClick}
                className={` mx-3 flex items-center justify-center text-white rounded-lg transition-all duration-200 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] ${isCollapsed && !isMobileMenuOpen ? "aspect-square p-2.5" : "px-4 py-2.5"} `}
                title={isCollapsed && !isMobileMenuOpen ? (userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium") : undefined}
              >
                <Crown className={`min-w-[1.25rem] ${isCollapsed && !isMobileMenuOpen ? "w-6 h-6" : "w-5 h-5 mr-2"}`} strokeWidth={2} />
                {(!isCollapsed || isMobileMenuOpen) && ( <span className="text-sm font-medium whitespace-nowrap">{userTier === 'basic' ? "Upgrade to Premium" : "Upgrade to Premium"}</span> )}
              </button>
            )}

            <button
              onClick={() => navigate("/settings")}
              className={`
                mx-3 rounded-lg transition-colors ${userProfileText} ${userProfileHoverBg}
                hover:scale-[1.02] transition-transform duration-200
                ${isCollapsed && !isMobileMenuOpen ? "flex flex-col items-center justify-center aspect-square py-2.5" : "flex items-center gap-3 px-4 py-2.5"}
              `}
              title={isCollapsed && !isMobileMenuOpen ? `${userName || "User"} - Settings` : undefined}
            >
              {/* Avatar Container */}
              <div
                className={`relative flex-shrink-0 w-8 h-8 rounded-full ${initialAvatarGlowClass}`}
                onAnimationEnd={handleInitialGlowEnd} // Event listener for animation end
              >
                <div className={`w-full h-full rounded-full overflow-hidden ${defaultAvatarBg}`}>
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt={userName || "User"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CircleUserRound className={`w-5 h-5 min-w-[1.25rem] ${defaultAvatarIconColor}`} strokeWidth={2} />
                    </div>
                  )}
                </div>
              </div>

              {/* User Info and Tags (only if not collapsed or mobile menu is open) */}
              {(!isCollapsed || isMobileMenuOpen) && (
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-left text-sm font-medium truncate max-w-[160px]">
                    {userName || (currentUser ? "User" : "Loading...")}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {userTier === 'premium' ? (
                      <span className="text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-transparent bg-clip-text"> Premium </span>
                    ) : userTier === 'pro' ? (
                      <span className="text-xs font-semibold bg-gradient-to-r from-teal-400 to-cyan-500 text-transparent bg-clip-text"> Pro </span>
                    ) : userTier === 'basic' ? (
                      <span className="text-xs text-gray-500">Basic</span>
                    ) : (
                      <span className="text-xs text-gray-500">Loading...</span>
                    )}
                  </div>

                  {/* New DEV/INTERN Tags - Placed below name/tier */}
                  {showTags && (isDev || isIntern) && (
                    <div className="mt-1.5 flex gap-1.5 items-center">
                      {isDev && (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-indigo-500 select-none animate-tag-animated-dev"
                          title="Developer"
                        >
                          DEV
                        </span>
                      )}
                      {isIntern && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white bg-teal-500 select-none animate-tag-animated-intern ${isDev ? 'ml-0' : ''}`} // Removed ml-0, gap-1.5 on parent handles spacing
                          title="Intern"
                        >
                          INT
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
