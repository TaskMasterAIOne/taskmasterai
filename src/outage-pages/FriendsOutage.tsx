import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// SVG Icon for Maintenance (Example using a gear)
const MaintenanceIcon = ({ className = "" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 5.853a.75.75 0 001.116.624l1.68-1.003a.75.75 0 01.95.697v1.516a.75.75 0 00.699.74l2.048.167a.75.75 0 01.684.848l-.341 1.954a.75.75 0 00.17.665l1.288 1.288a.75.75 0 010 1.06l-1.288 1.288a.75.75 0 00-.17.666l.341 1.954a.75.75 0 01-.684.848l-2.048.167a.75.75 0 00-.699.74v1.516a.75.75 0 01-.95.697l-1.68-1.003a.75.75 0 00-1.116.624l-.178 2.034c-.15.904-.933 1.567-1.85 1.567h-1.844c-.917 0-1.699-.663-1.85-1.567l-.178-2.034a.75.75 0 00-1.116-.624l-1.68 1.003a.75.75 0 01-.95-.697V18.3a.75.75 0 00-.699-.74l-2.048-.167a.75.75 0 01-.684-.848l.341-1.954a.75.75 0 00.17-.666l-1.288-1.288a.75.75 0 010-1.06l1.288-1.288a.75.75 0 00.17-.665l-.341-1.954a.75.75 0 01.684-.848l2.048-.167a.75.75 0 00.699-.74V5.653a.75.75 0 01.95-.697l1.68 1.003a.75.75 0 001.116-.624l.178-2.034c.15-.904.933-1.567 1.85-1.567h1.844zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" clipRule="evenodd" />
  </svg>
);


const FriendsOutage = () => {
  // --- Theme Support Logic ---
  const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
  const isBlackoutEnabled = JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false');

  // Determine dynamic classes based on theme
  const containerClass = isIlluminateEnabled
    ? 'bg-gray-50 text-gray-900' // Illuminate: Very light gray bg, dark text
    : isBlackoutEnabled
    ? 'bg-black text-gray-100'   // Blackout: Pure black bg, light gray text
    : 'bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white'; // Default: Dark gradient bg, white text

  const cardClass = isIlluminateEnabled
    ? 'bg-white shadow-lg rounded-xl p-8 md:p-10 border border-gray-200' // Light card, shadow, border
    : isBlackoutEnabled
    ? 'bg-gray-900 shadow-lg rounded-xl p-8 md:p-10 border border-gray-700'   // Darker card, subtle border
    : 'bg-[#1e293b]/60 backdrop-blur-md shadow-xl rounded-xl p-8 md:p-10 border border-gray-700/50'; // Default: Semi-transparent dark card

  const iconColor = isIlluminateEnabled ? 'text-indigo-600' : 'text-indigo-400';
  const headingColor = isIlluminateEnabled ? 'text-gray-800' : 'text-white';
  const textColor = isIlluminateEnabled ? 'text-gray-600' : 'text-gray-300';
  const strongTextColor = isIlluminateEnabled ? 'text-gray-700' : 'text-white'; // For the date
  const labelBgClass = isIlluminateEnabled ? 'bg-indigo-100' : 'bg-gray-800'; // Adjusted label background
  const labelTextColor = isIlluminateEnabled ? 'text-indigo-800' : 'text-gray-300';
  const statusButtonClass = isIlluminateEnabled
    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' // Light secondary button
    : 'bg-gray-700 text-white hover:bg-gray-600';    // Dark secondary button
  // --- End Theme Support Logic ---

  return (
    <div className={`relative flex flex-col items-center justify-center min-h-screen font-poppins p-4 md:p-6 overflow-hidden ${containerClass}`}>
      {/* Background Animated Elements (Adjusted Opacity) */}
      <motion.div
        className="absolute bg-indigo-500 rounded-full filter blur-3xl opacity-20" // More blur, adjusted opacity
        style={{ width: 300, height: 300, top: '-50px', left: '-80px' }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
      />
      <motion.div
        className="absolute bg-purple-500 rounded-full filter blur-3xl opacity-15" // More blur, adjusted opacity
        style={{ width: 250, height: 250, bottom: '-70px', right: '-100px' }}
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
      />
       <motion.div // Smaller rotating element
        className="absolute bg-indigo-500 rounded-full opacity-10"
        style={{ width: 100, height: 100, bottom: '15%', left: '5%' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
       <motion.div // Smaller moving element
        className="absolute bg-purple-500 rounded-full opacity-10"
        style={{ width: 80, height: 80, top: '20%', right: '8%' }}
        animate={{ x: [0, -30, 0], y: [0, 30, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
      />


      {/* Main Content Card */}
      <motion.div
        className={`relative z-10 flex flex-col items-center text-center w-full max-w-2xl ${cardClass}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Icon */}
        <div className="mb-5">
          <MaintenanceIcon className={`w-12 h-12 md:w-16 md:h-16 ${iconColor}`} />
        </div>

        {/* Heading */}
        <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${headingColor}`}>
          Feature Under Maintenance
        </h1>

        {/* Maintenance Message */}
        <p className={`max-w-lg text-base md:text-lg leading-relaxed mb-6 ${textColor}`}>
          The Friends feature is temporarily unavailable as we perform scheduled maintenance and upgrades
          to enhance your experience. We expect everything to be back online by{' '}
          <strong className={strongTextColor}>April 30</strong>.
        </p>

        {/* Reassurance Label */}
        <div // Changed label to div for better layout control
          className={`inline-block mx-auto mb-8 font-medium text-sm md:text-base
                     leading-relaxed px-4 py-2 rounded-lg ${labelBgClass} ${labelTextColor}`}
        >
          Rest assured, your data is safe and secure during this period.
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0 w-full justify-center">
          {/* Return to Dashboard (Primary) */}
          <Link
            to="/dashboard"
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-full transition-all transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Dashboard
          </Link>
          {/* Check Status (Secondary) */}
          <Link
            to="/status"
            className={`px-6 py-2.5 font-medium rounded-full transition-colors transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${isIlluminateEnabled ? 'focus:ring-gray-400' : 'focus:ring-gray-500'} ${statusButtonClass} whitespace-nowrap`}
          >
            Check Status Page
          </Link>
        </div>
      </motion.div>

       {/* Optional Footer Link */}
       <div className="absolute bottom-4 text-center text-xs text-gray-500 z-10">
          Need help? <Link to="/contact" className="underline hover:text-indigo-400">Contact Support</Link>
       </div>
    </div>
  );
};

export default FriendsOutage;
