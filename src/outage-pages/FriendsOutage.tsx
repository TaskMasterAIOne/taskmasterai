import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// Inline keyframes for demonstration (optional)
// const spinAnimation = `
//   @keyframes spin {
//     0% { transform: rotate(0deg); }
//     100% { transform: rotate(360deg); }
//   }
// `;

const FriendsOutage = () => {
  // --- Theme Support Logic ---
  // Read theme settings from localStorage, defaulting to false if not found
  const isIlluminateEnabled = JSON.parse(localStorage.getItem('isIlluminateEnabled') || 'false');
  const isBlackoutEnabled = JSON.parse(localStorage.getItem('isBlackoutEnabled') || 'false');

  // Determine container and text classes based on theme
  const containerClass = isIlluminateEnabled
    ? 'bg-white text-gray-900' // Illuminate: White background, dark text
    : isBlackoutEnabled
    ? 'bg-gray-950 text-white' // Blackout: Very dark background, white text
    : 'bg-[#0f172a] text-white'; // Default: Original dark blue background, white text

  const headingColor = isIlluminateEnabled ? 'text-gray-900' : 'text-white';
  const textColor = isIlluminateEnabled ? 'text-gray-700' : 'text-gray-300'; // Adjust for better contrast in light mode
  const labelBgColor = isIlluminateEnabled ? 'bg-gray-200' : 'bg-gray-800'; // Lighter label bg for light mode
  const labelTextColor = isIlluminateEnabled ? 'text-gray-800' : 'text-gray-300'; // Darker label text for light mode
  // --- End Theme Support Logic ---


  return (
    // Apply dynamic container class
    <div className={`relative flex flex-col items-center justify-center min-h-screen font-poppins p-6 overflow-hidden ${containerClass}`}>
      {/* Inline keyframes (optional) */}
      {/* <style>{spinAnimation}</style> */}

      {/* Background Circles (opacity adjusted slightly for potentially lighter backgrounds) */}
      <motion.div
        className="absolute bg-indigo-500 rounded-full opacity-20 md:opacity-30" // Slightly less opaque for light mode
        style={{ width: 350, height: 350, top: '-100px', left: '-100px' }}
        animate={{ x: [0, 80, 0], y: [0, 50, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bg-purple-500 rounded-full opacity-20 md:opacity-30" // Slightly less opaque for light mode
        style={{ width: 300, height: 300, bottom: '-150px', right: '-150px' }}
        animate={{ x: [0, -80, 0], y: [0, -50, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bg-indigo-500 rounded-full opacity-10 md:opacity-20" // Reduced opacity
        style={{ width: 200, height: 200, bottom: '20%', left: '-100px' }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute bg-purple-500 rounded-full opacity-10 md:opacity-20" // Reduced opacity
        style={{ width: 150, height: 150, top: '30%', right: '-70px' }}
        animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Main Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        {/* Emoji or Icon */}
        <div className="mb-4 text-5xl">
          <span role="img" aria-label="sad face">😞</span>
        </div>

        {/* Heading - Apply dynamic heading color */}
        <h1 className={`text-4xl md:text-5xl font-bold mb-4 whitespace-nowrap ${headingColor}`}>
          Maintenance Mode
        </h1>

        {/* Outage Message - Apply dynamic text color */}
        <p className={`max-w-xl text-lg md:text-xl leading-relaxed text-center ${textColor}`}>
          Friends is currently experiencing a major outage due to unforeseen issues. We're working
          to restore full functionality, with service resuming by <strong>April 30</strong>.
        </p>

        {/* Bold, Single-Line Reassurance - Apply dynamic label colors */}
        <label
          className={`inline-block mx-auto mt-8 font-bold text-lg md:text-xl
                     leading-relaxed px-4 py-2 rounded-lg shadow whitespace-nowrap ${labelBgColor} ${labelTextColor}`}
        >
          Rest assured, your messages are safe and secure during this period.
        </label>

        {/* Navigation Buttons - Styles kept consistent for now, but could be themed further if needed */}
        <div className="mt-8 flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
          {/* Return to Dashboard */}
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full transition-all transform hover:scale-105"
          >
            Return to Dashboard
          </Link>
          {/* Check Status - Consider adjusting bg/text for light mode if needed */}
          <Link
            to="/status"
            className={`px-6 py-2 rounded-full transition-transform transform hover:scale-105 whitespace-nowrap ${isIlluminateEnabled ? 'bg-gray-300 text-gray-800 hover:bg-gray-400' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            Check Status
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default FriendsOutage;
