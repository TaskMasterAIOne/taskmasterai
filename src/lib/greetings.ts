import React from 'react';
import { Sun, Cloud, Sunset, Moon, Zap, Brain, BookOpen } from 'lucide-react';

export const getTimeBasedGreeting = (): {
  greeting: string;
  icon: JSX.Element;
  color: string; // This is for the greeting text
  motivationalLine: string;
  suggestionIcon: JSX.Element;
} => {
  const hour = new Date().getHours();
  let motivationalLine = "Let's make today productive and full of learning! 🚀";
  // Default suggestion icon with lighter dark mode color
  let suggestionIcon = React.createElement(Zap, { className: 'text-yellow-500 dark:text-yellow-200' });


  if (hour >= 5 && hour < 12) {
    motivationalLine = "Morning is a fresh page. What will you learn today? ✨";
    suggestionIcon = React.createElement(BookOpen, { className: 'text-blue-500 dark:text-blue-200' });
    return {
      greeting: 'Good morning',
      icon: React.createElement(Sun, { className: 'text-yellow-500 dark:text-yellow-200' }), // Added className
      color: 'text-white-500 dark:text-white-400', // For greeting text
      motivationalLine,
      suggestionIcon
    };
  } else if (hour >= 12 && hour < 17) {
    motivationalLine = "Keep the momentum going! What insights will you uncover this afternoon? 🧠";
    suggestionIcon = React.createElement(Brain, { className: 'text-pink-500 dark:text-pink-200' });
    return {
      greeting: 'Good afternoon',
      icon: React.createElement(Cloud, { className: 'text-sky-500 dark:text-sky-200' }), // Added className
      color: 'text-sky-500 dark:text-white-400', // For greeting text
      motivationalLine,
      suggestionIcon
    };
  } else if (hour >= 17 && hour < 21) {
    motivationalLine = "Evening is perfect for review or planning your next learning adventure. 🌙";
    // suggestionIcon will use the default Zap icon defined above
    return {
      greeting: 'Good evening',
      icon: React.createElement(Sunset, { className: 'text-orange-500 dark:text-orange-200' }), // Added className
      color: 'text-orange-500 dark:text-white-400', // For greeting text
      motivationalLine,
      suggestionIcon
    };
  } else {
    motivationalLine = "Rest well! Your brain processes learning even while you sleep. 😴";
    // suggestionIcon will use the default Zap icon defined above
    return {
      greeting: 'Good night',
      icon: React.createElement(Moon, { className: 'text-indigo-500 dark:text-indigo-200' }), // Added className
      color: 'text-white-500 dark:text-white-400', // For greeting text
      motivationalLine,
      suggestionIcon
    };
  }
};