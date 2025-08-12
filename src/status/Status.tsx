code
Jsx
download
content_copy
expand_less

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import 'katex/dist/katex.min.css';
import {
    LayoutDashboard, NotebookText, FolderKanban,
    Eye, Settings, History, Sparkles
} from 'lucide-react';

const Logo = () => (
  <Link to="/" className="flex items-center space-x-2 group" aria-label="Go to Homepage">
    <svg
      className="w-8 h-8 text-indigo-500 group-hover:text-indigo-400 transition-colors"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.19C2 19.83 4.17 22 7.81 22H16.19C19.83 22 22 19.83 22 16.19V7.81C22 4.17 19.83 2 16.19 2ZM9.97 14.9L7.72 17.15C7.57 17.3 7.38 17.37 7.19 17.37C7 17.37 6.8 17.3 6.66 17.15L5.91 16.4C5.61 16.11 5.61 15.63 5.91 15.34C6.2 15.05 6.67 15.05 6.97 15.34L7.19 15.56L8.91 13.84C9.2 13.55 9.67 13.55 9.97 13.84C10.26 14.13 10.26 14.61 9.97 14.9ZM9.97 7.9L7.72 10.15C7.57 10.3 7.38 10.37 7.19 10.37C7 10.37 6.8 10.3 6.66 10.15L5.91 9.4C5.61 9.11 5.61 8.63 5.91 8.34C6.2 8.05 6.67 8.05 6.97 8.34L7.19 8.56L8.91 6.84C9.2 6.55 9.67 6.55 9.97 6.84C10.26 7.13 10.26 7.61 9.97 7.9ZM17.56 16.62H12.31C11.9 16.62 11.56 16.28 11.56 15.87C11.56 15.46 11.9 15.12 12.31 15.12H17.56C17.98 15.12 18.31 15.46 18.31 15.87C18.31 16.28 17.98 16.62 17.56 16.62ZM17.56 9.62H12.31C11.9 9.62 11.56 9.28 11.56 8.87C11.56 8.46 11.9 8.12 12.31 8.12H17.56C17.98 8.12 18.31 8.46 18.31 8.87C18.31 9.28 17.98 9.62 17.56 9.62Z" fill="currentColor"/>
    </svg>
    <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
      Status
    </span>
  </Link>
);

const serviceStatus = [
  { name: "Dashboard", icon: LayoutDashboard, uptime: "99.99%", majorIssue: null, description: "Core application interface and widgets." },
  { name: "Notes", icon: NotebookText, uptime: "99.98%", majorIssue: null, description: "Note-taking, editing, and organization features." },
  { name: "Folders", icon: FolderKanban, uptime: "100.00%", majorIssue: null, description: "File and note organization using folders." },
  {
    name: "Focus",
    icon: Eye,
    uptime: "100.00%",
    majorIssue: null,
    description: "Distraction-free work environment feature. Now available for all users!",
    isNewFeature: true,
  },
  { name: "Settings", icon: Settings, uptime: "99.96%", majorIssue: null, description: "User account and application preferences." },
];

const incidentHistory = [
    {
        date: "March 4, 2:59 PM EST",
        title: "Major Outage - Notes Feature",
        description: "We experienced a major outage affecting the Notes feature. Due to performance issues with underlying AI models, the system was unable to generate notes reliably during this time. Our team identified the root cause and implemented a fix to restore full functionality. We apologize for the inconvenience and appreciate your patience.",
        resolvedDate: "April 13, 2025",
        status: "Resolved"
    },
];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } } };

const Status = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
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
    }
  }, []);

  const hasMajorOutage = serviceStatus.some(service => service.majorIssue);
  const overallStatusText = hasMajorOutage ? "Major Outage" : "All Systems Operational";
  const lastUpdated = "May 22, 2025; 10:20 AM EST";

  return (
    <div className="min-h-screen flex flex-col font-poppins bg-white text-gray-800 dark:bg-[#0C0E1A] dark:text-gray-200 illuminate-override">
      <header className="w-full py-5 sm:py-6 bg-white dark:bg-[#0C0E1A] illuminate-override ">
        <div className="container mx-auto px-5 sm:px-6">
          <nav className="flex items-center justify-between">
            <Logo />
            <Link
              to="/dashboard"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-semibold transition-colors duration-200 shadow-md hover:shadow-indigo-500/50 illuminate-button-override"
            >
              Go to Dashboard
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-16">
        <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-2 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                System Status
                <span className={`px-3 py-1 text-sm font-semibold rounded-full w-fit ${
                    hasMajorOutage
                        ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                }`}>
                    {overallStatusText}
                </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Last updated: {lastUpdated}</p>
            <hr className="border-gray-200 dark:border-gray-700/60 mb-10"/>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
            >
              {serviceStatus.map((service) => {
                const typedService = service as typeof service & { isNewFeature?: boolean };
                const IconComponent = typedService.icon;
                const isOutage = Boolean(typedService.majorIssue);

                const displayStatusText = isOutage ? "Major Outage" : "Operational";
                const displayStatusColorClass = isOutage 
                    ? "text-red-800 bg-red-100 border-red-200 dark:text-red-300 dark:bg-red-900/40 dark:border-red-700/50"
                    : "text-green-800 bg-green-100 border-green-200 dark:text-green-300 dark:bg-green-900/40 dark:border-green-700/50";

                const iconColorClass = typedService.isNewFeature ? 'text-teal-500 dark:text-teal-400' : 'text-indigo-600 dark:text-indigo-400';

                return (
                  <motion.div
                    key={typedService.name}
                    variants={itemVariants}
                    className="bg-white dark:bg-[#161A2C] border border-gray-200 dark:border-gray-700/60 rounded-xl p-5 shadow-sm hover:shadow-lg dark:hover:border-gray-600 transition-all duration-300 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <IconComponent className={`w-6 h-6 ${iconColorClass}`} />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{typedService.name}</h3>
                        {typedService.isNewFeature && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 rounded-full shadow-sm flex items-center gap-1">
                               <Sparkles className="w-3 h-3 inline-block opacity-80" /> New
                            </span>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${displayStatusColorClass} flex items-center gap-1`}>
                        {displayStatusText}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">
                      {typedService.description}
                      <span className="block text-xs text-gray-500 mt-1">Uptime: {typedService.uptime}</span>
                    </p>
                    {isOutage && (
                      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 rounded-lg text-sm text-red-800 dark:text-red-200 mt-auto">
                         <p className="font-semibold mb-1">Current Issue:</p>
                         <p>{typedService.majorIssue}</p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            <motion.div
                className="mt-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
            >
                 <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                     <History className="w-7 h-7 text-indigo-500 dark:text-indigo-400"/>
                     Past Incidents
                 </h2>
                 {incidentHistory.length === 0 ? (
                     <p className="text-gray-500 dark:text-gray-400 italic">No past incidents reported recently.</p>
                 ) : (
                     <div className="space-y-6">
                         {incidentHistory.map((incident, index) => (
                             <motion.div
                                 key={index}
                                 className="bg-white dark:bg-[#161A2C] p-5 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm"
                                 variants={itemVariants}
                                 initial="hidden"
                                 animate="visible"
                                 transition={{delay: 0.6 + index * 0.1}}
                             >
                                 <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
                                     <h3 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-1 sm:mb-0">{incident.title}</h3>
                                     <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                         incident.status === 'Resolved' 
                                            ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' 
                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/30 dark:text-yellow-300'
                                     }`}>{incident.status}</span>
                                 </div>
                                 <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                                     Reported: {incident.date} {incident.resolvedDate && `| Resolved: ${incident.resolvedDate}`}
                                 </p>
                                 <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                     {incident.description}
                                 </p>
                             </motion.div>
                         ))}
                     </div>
                 )}
            </motion.div>
        </div>
      </main>

      <footer className="bg-white dark:bg-[#0C0E1A] mt-auto illuminate-override illuminate-border-override">
        <div className="container mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="flex items-center space-x-4 text-sm">
              <Link to="/privacy-policy" className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">
                Privacy Policy
              </Link>
              <span className="text-gray-400 dark:text-gray-700">|</span>
              <Link to="/terms" className="text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors">
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 md:mt-0">
              © {new Date().getFullYear()} TaskMaster AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Status;
