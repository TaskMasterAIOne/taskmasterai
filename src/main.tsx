import { StrictMode, useEffect, useState, useLayoutEffect, useRef } from 'react';
import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';

import { pdfjs } from 'react-pdf';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

import { motion } from 'framer-motion';
import App from './App';
import Partner from './components/Partner';
import Login from './components/Login';
import SignUp from './components/SignUp';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Pricing from './components/Pricing';
import Terms from './components/Terms';
import Settings from './components/Settings';
import Onboarding from './components/Onboarding';
import ForgotPassword from './components/Forgot-Password';
import PrivacyPolicy from './components/Privacy-Policy';
import { Dashboard } from './components/Dashboard';
import Contact from './components/Contact';
import { Folders } from './components/Folders';
import AIChat from './components/AI-Chat';
import Notes from './components/Notes';
import './index.css';
import FriendsOutage from './outage-pages/FriendsOutage';
import Status from './status/Status';
import { PublicNoteView } from './components/PublicNoteView';
import ComingSoon from './components/ComingSoon';
import { FocusMode } from './components/Focus-Mode';
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Loader2, AlertTriangle, Wrench, Instagram, ArrowRight } from 'lucide-react';
import { Logo } from './components/Logo';

const DefaultHelmet = () => (
  <Helmet>
    <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17070659093"></script>
    <script>
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-17070659093');
      `}
    </script>
  </Helmet>
);

const ThemeProvider = ({ children }) => {
  useEffect(() => {
    const applyTheme = () => {
      const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
      if (isIlluminateEnabled) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        return;
      }
      document.documentElement.classList.remove('light', 'dark');
      const savedTheme = localStorage.getItem('appTheme') || 'system';
      if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.add('light');
      }
    };

    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('storage', (event) => { if (event.key === 'appTheme' || event.key === 'isIlluminateEnabled') applyTheme(); });
    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
      window.removeEventListener('storage', applyTheme);
    };
  }, []);

  return <>{children}</>;
};

const UnderMaintenance = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const cardNode = cardRef.current;
    const mediaNode = mediaRef.current;
    if (!cardNode || !mediaNode) return;

    const observer = new ResizeObserver(() => {
        const cardHeight = cardNode.getBoundingClientRect().height;
        mediaNode.style.height = `${cardHeight}px`;
    });

    observer.observe(cardNode);
    return () => observer.disconnect();
  }, []);
  
  const lightModeImage = "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/Screenshot%202025-07-19%20at%2011.49.54%E2%80%AFPM.png?alt=media&token=ab0ad6ad-e2a0-461b-be22-40dbe21bc0cc";
  const darkModeVideo = "https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/TaskMaster%20AI%20Demo%20Video%20(1).mp4?alt=media&token=257d12b1-16b9-4552-9a3d-b3e306fa0f98";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-poppins bg-[#F9FAFB] dark:bg-[#0A0B0F] text-gray-800 dark:text-gray-200">
      <div className="absolute top-8 sm:top-12">
        <Logo />
      </div>

      <div className="w-full max-w-7xl mx-auto flex-grow flex flex-col items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          <motion.div 
            className="w-full max-w-md mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <div ref={cardRef} className="w-full bg-white dark:bg-[#16181D] p-8 sm:p-10 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-lg text-left">
              <div className="flex items-center gap-4 mb-4">
                <Wrench className="w-10 h-10 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                <h1 className="text-4xl font-semibold text-gray-900 dark:text-white">
                  Under Maintenance
                </h1>
              </div>
              <p className="mb-6 text-base text-gray-500 dark:text-gray-400">
                We're currently performing scheduled maintenance. We should be back online shortly. Thank you for your patience!
              </p>
              <div className="bg-gray-100 dark:bg-gray-800/60 text-sm text-gray-500 dark:text-gray-400 rounded-lg px-4 py-3 text-center">
                Estimated Downtime: <span className="font-semibold text-gray-700 dark:text-gray-300">3-4 days</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
              className="relative w-full max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
          >
            <div ref={mediaRef} className="w-full flex items-center justify-center">
              <div className="relative w-full h-full">
                <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-indigo-600/80 via-purple-600/80 to-pink-600/80 opacity-20 blur-2xl"></div>
                {isDarkMode ? (
                    <video
                        src={darkModeVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        style={{ filter: 'brightness(1.1) contrast(1.1)' }}
                        className="relative rounded-2xl shadow-2xl border-2 border-gray-700/70 w-full h-full object-cover pointer-events-none"
                        onLoadedMetadata={(e) => { (e.target as HTMLVideoElement).playbackRate = 1.75; }}
                    />
                ) : (
                    <img
                        src={lightModeImage}
                        alt="TaskMaster AI Product Screenshot" 
                        className="relative rounded-2xl shadow-2xl border-2 border-gray-200 w-full h-full object-cover"
                    />
                )}
              </div>
            </div>
          </motion.div>

        </div>

        <div className="mt-24 text-center w-full">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-5">In the meantime, check us out!</h3>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="https://www.instagram.com/taskmasteroneai/?hl=en" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white dark:bg-[#2A2D35] text-gray-800 dark:text-white p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3A3D45] transition-colors shadow-md w-full max-w-xs">
                    <div className="flex items-center space-x-3">
                        <Instagram className="w-6 h-6 text-pink-500"/>
                        <span className="font-semibold text-lg">Instagram</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                </a>
                <a href="https://www.tiktok.com/@taskmasterai" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white dark:bg-[#2A2D35] text-gray-800 dark:text-white p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-[#3A3D45] transition-colors shadow-md w-full max-w-xs">
                    <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 flex items-center justify-center">
                            <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/tiktok-logo.png?alt=media&token=de834810-541b-4761-a6b5-113bc57d40a8" alt="TikTok Logo" className="w-5 h-5 object-contain" />
                        </div>
                        <span className="font-semibold text-lg">TikTok</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                </a>
            </div>
        </div>
      </div>
      
      <p className="py-8 text-sm text-gray-500 dark:text-gray-500">
        &copy; {new Date().getFullYear()} TaskMaster AI. All Rights Reserved.
      </p>
    </div>
  );
};

const NotFound = () => { /* ... existing NotFound component ... */ };
const PageTitle = ({ title, children }: { title: string; children: React.ReactNode }) => ( <> <Helmet> <title>{title} | TaskMaster AI</title> </Helmet> {children} </> );
const RootTitle = ({ children }: { children: React.ReactNode }) => ( <> <Helmet> <title>TaskMaster AI</title> </Helmet> {children} </> );

const AppRoutes = () => {
  const { user, loading: authIsLoading } = useAuth();
  const maintenanceMode = true;

  if (maintenanceMode) {
    return (
        <Routes>
            <Route path="*" element={<PageTitle title="Under Maintenance"><UnderMaintenance /></PageTitle>} />
        </Routes>
    );
  }

  if (authIsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-[#0A0B0F] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <PageTitle title="Login"><Login /></PageTitle>} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <PageTitle title="Sign Up"><SignUp /></PageTitle>} />
      <Route path="/pricing" element={<PageTitle title="Pricing"><Pricing /></PageTitle>} />
      <Route path="/terms" element={<PageTitle title="Terms of Service"><Terms /></PageTitle>} />
      <Route path="/settings" element={user ? <PageTitle title="Settings"><Settings /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/onboarding" element={<PageTitle title="Welcome"><Onboarding /></PageTitle>} />
      <Route path="/privacy-policy" element={<PageTitle title="Privacy Policy"><PrivacyPolicy /></PageTitle>} />
      <Route path="/partner" element={<PageTitle title="TaskPartner"><Partner /></PageTitle>} />
      <Route path="/forgot-password" element={<PageTitle title="Reset Password"><ForgotPassword /></PageTitle>} />
      <Route path="/dashboard" element={user ? <PageTitle title="Dashboard"><Dashboard /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/contact" element={<PageTitle title="Contact Us"><Contact /></PageTitle>} />
      <Route path="/folders" element={user ? <PageTitle title="Folders"><Folders /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/ai" element={user ? <PageTitle title="AI Chat"><AIChat /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/notes" element={user ? <PageTitle title="Notes"><Notes /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/" element={<RootTitle><App /></RootTitle>} />
      <Route path="/status" element={<PageTitle title="Status"><Status /></PageTitle>} />
      <Route path="/focus" element={user ? <PageTitle title="Focus"><FocusMode /></PageTitle> : <Navigate to="/login" replace />} />
      <Route path="/public-note/:noteId" element={<PageTitle title="Public Note"><PublicNoteView /></PageTitle>} />
      <Route path="*" element={<PageTitle title="404 Not Found"><NotFound /></PageTitle>} />
    </Routes>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <DefaultHelmet />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <Analytics />
            <SpeedInsights />
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);

export {};
