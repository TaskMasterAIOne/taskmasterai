import { StrictMode, useEffect } from 'react';
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
      mediaQuery.removeEventListener('change', applyTheme);
      window.removeEventListener('storage', applyTheme);
    };
  }, []);

  return <>{children}</>;
};

// Updated: VideoPlayer now uses aspect-video for a horizontal layout
const VideoPlayer = ({ src }) => (
    <div className="aspect-video w-full max-w-lg mx-auto bg-indigo-500/80 dark:bg-[#635bff] rounded-3xl p-2 border-2 border-indigo-400/50 dark:border-[#635bff]/50 shadow-xl shadow-indigo-500/30 dark:shadow-[#8a85ff]/40">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full rounded-2xl object-cover"
      ></video>
    </div>
);

const UnderMaintenance = () => {
  const isIlluminate = document.documentElement.classList.contains('light');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-poppins bg-gray-100 dark:bg-[#0A0B0F] text-gray-800 dark:text-gray-200 illuminate-override">
      <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
        <div className="mb-10">
            <Logo />
        </div>

        {/* Updated: Added lg:items-stretch to make columns equal height */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 lg:items-stretch">
          {/* Left Column: Maintenance Card */}
          <motion.div
            className="w-full h-full"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            {/* Updated: Card now fills height and centers content */}
            <div
              className="w-full max-w-xl mx-auto bg-white dark:bg-[#16181D] p-8 sm:p-10 rounded-2xl border border-gray-300 dark:border-gray-700/50 shadow-2xl text-center illuminate-card-override h-full flex flex-col justify-center"
              style={{
                boxShadow: !isIlluminate && document.documentElement.classList.contains('dark')
                  ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 20px 40px -10px rgba(128, 90, 213, 0.1)'
                  : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 20px 40px -10px rgba(0, 0, 0, 0.05)'
              }}
            >
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                <Wrench className="w-16 h-16 mx-auto mb-6 text-indigo-500 dark:text-indigo-400 illuminate-icon-override" />
              </motion.div>
              <motion.h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 dark:text-white mb-4 illuminate-text-override" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }}>
                Under Maintenance
              </motion.h1>
              <motion.p className="mb-6 text-base text-gray-600 dark:text-gray-400 illuminate-subtext-override" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}>
                We're currently performing scheduled maintenance. We should be back online shortly. Thank you for your patience!
              </motion.p>
              <motion.div className="bg-gray-100 dark:bg-gray-800/60 text-sm text-gray-500 dark:text-gray-400 rounded-lg px-4 py-2 inline-block" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}>
                Estimated Downtime: <span className="font-semibold text-gray-700 dark:text-gray-300">3-4 days</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Column: Video and Socials */}
          <motion.div
            className="w-full h-full"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          >
            {/* Updated: Container now fills height and centers content */}
            <div className="h-full flex flex-col justify-center items-center">
              <VideoPlayer src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/TaskMaster%20AI%20Demo%20Video%20(1).mp4?alt=media&token=257d12b1-16b9-4552-9a3d-b3e306fa0f98" />
              <div className="mt-8 text-center w-full max-w-xs">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-4">In the meantime, check us out!</h3>
                <div className="flex flex-col space-y-3">
                  <a href="https://www.instagram.com/taskmasteroneai/?hl=en" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white dark:bg-[#2A2D35] text-gray-800 dark:text-white p-4 rounded-xl hover:bg-gray-200 dark:hover:bg-[#3A3D45] transition-colors shadow-md">
                    <div className="flex items-center space-x-3">
                      <Instagram className="w-6 h-6 text-pink-500"/>
                      <span className="font-semibold">Instagram</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                  </a>
                  <a href="https://www.tiktok.com/@taskmasterai" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between bg-white dark:bg-[#2A2D35] text-gray-800 dark:text-white p-4 rounded-xl hover:bg-gray-200 dark:hover:bg-[#3A3D45] transition-colors shadow-md">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/deepworkai-c3419.appspot.com/o/tiktok-logo.png?alt=media&token=de834810-541b-4761-a6b5-113bc57d40a8" alt="TikTok Logo" className="w-5 h-5 object-contain" />
                      </div>
                      <span className="font-semibold">TikTok</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500"/>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <p className="mt-20 text-xs text-gray-500 dark:text-gray-600 illuminate-footertext-override">
          &copy; {new Date().getFullYear()} TaskMaster AI. All Rights Reserved.
        </p>
      </div>
    </div>
  );
};

const NotFound = () => {
  const isIlluminate = document.documentElement.classList.contains('light');
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 font-poppins bg-gray-100 text-gray-800 dark:bg-[#0A0B0F] dark:text-gray-200 illuminate-override`}>
      <div className="absolute top-6 sm:top-8 w-full flex justify-center"> <Link to="/" aria-label="Go to Homepage"> <Logo /> </Link> </div>
      <div className={`w-full max-w-md bg-white dark:bg-[#16181D] p-8 sm:p-10 rounded-2xl border border-gray-300 dark:border-gray-700/50 shadow-2xl text-center illuminate-card-override`} style={{ boxShadow: !isIlluminate && document.documentElement.classList.contains('dark') ? '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 20px 40px -10px rgba(128, 90, 213, 0.1)' : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 20px 40px -10px rgba(0, 0, 0, 0.05)' }} >
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: "easeOut" }} >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-yellow-500 dark:text-yellow-400 illuminate-icon-override" />
        </motion.div>
        <motion.h1 className="text-6xl sm:text-7xl font-extrabold text-gray-900 dark:text-white mb-3 illuminate-text-override" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.4, ease: "easeOut" }} > 404 </motion.h1>
        <motion.h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-4 illuminate-text-override" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }} > Page Not Found </motion.h2>
        <motion.p className="mb-8 text-sm sm:text-base text-gray-600 dark:text-gray-400 illuminate-subtext-override" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }} > Oops! This page doesn't exist. </motion.p>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }} >
          <Link to="/" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-indigo-500 dark:to-purple-600 dark:hover:from-indigo-600 dark:hover:to-purple-700 text-white rounded-full text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 illuminate-button-override" > Go to Homepage </Link>
        </motion.div>
      </div>
      <p className="mt-8 text-xs text-gray-500 dark:text-gray-600 illuminate-footertext-override"> If you believe this is an error, please <a href="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline illuminate-link-override">contact support</a>. </p>
    </div>
  );
};

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
      <div className="min-h-screen bg-gray-100 dark:bg-[#0A0B0F] flex items-center justify-center illuminate-override">
        <Loader2 className="w-10 h-10 text-indigo-500 dark:text-indigo-500 animate-spin" />
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
