// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin'; // Import the plugin function

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        gray: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        indigo: { // Used for DEV tag
          500: '#6366f1',
          600: '#4f46e5',
        },
        purple: {
          500: '#a855f7',
        },
        teal: { // Added for INTERN tag
          500: '#14b8a6', // Tailwind's teal-500
          600: '#0d9488', // Tailwind's teal-600
        }
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slower': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',

        'avatar-initial-glow-dev': 'avatar-initial-glow-dev 1s ease-out forwards',
        'avatar-initial-glow-intern': 'avatar-initial-glow-intern 1s ease-out forwards',

        'tag-animated-dev': 'tag-fade-in 0.5s ease-out forwards, subtle-tag-glow-dev 2s infinite 0.5s ease-in-out',
        'tag-animated-intern': 'tag-fade-in 0.5s ease-out forwards, subtle-tag-glow-intern 2.2s infinite 0.5s ease-in-out',

        'fade-in-tags': 'tag-fade-in 0.5s ease-out forwards',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'avatar-initial-glow-dev': {
          '0%': { boxShadow: '0 0 0px 0px rgba(99, 102, 241, 0)' },
          '50%': { boxShadow: '0 0 20px 8px rgba(99, 102, 241, 0.5)' },
          '100%': { boxShadow: '0 0 0px 0px rgba(99, 102, 241, 0)' },
        },
        'avatar-initial-glow-intern': {
          '0%': { boxShadow: '0 0 0px 0px rgba(20, 184, 166, 0)' },
          '50%': { boxShadow: '0 0 20px 8px rgba(20, 184, 166, 0.5)' },
          '100%': { boxShadow: '0 0 0px 0px rgba(20, 184, 166, 0)' },
        },
        'tag-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'subtle-tag-glow-dev': {
          '0%, 100%': { boxShadow: '0 0 7px 2px rgba(99, 102, 241, 0.4)' },
          '50%': { boxShadow: '0 0 12px 3px rgba(99, 102, 241, 0.6)' },
        },
        'subtle-tag-glow-intern': {
          '0%, 100%': { boxShadow: '0 0 7px 2px rgba(20, 184, 166, 0.4)' },
          '50%': { boxShadow: '0 0 12px 3px rgba(20, 184, 166, 0.6)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    // Custom plugin to hide scrollbars on standard overflow utilities
    plugin(function({ addBase, theme }) {
      const overflowClasses = [
        '.overflow-auto',
        '.overflow-scroll',
        '.overflow-x-auto',
        '.overflow-x-scroll',
        '.overflow-y-auto',
        '.overflow-y-scroll',
        'textarea.overflow-auto', // Specific for textareas
        'textarea.overflow-scroll',
        'textarea.overflow-y-auto',
        'textarea.overflow-y-scroll',
      ];

      const scrollbarHideStyles = {};

      overflowClasses.forEach(cls => {
        // For Webkit-based browsers
        scrollbarHideStyles[`${cls}::-webkit-scrollbar`] = { 'display': 'none' };
        // For Firefox and IE/Edge
        scrollbarHideStyles[cls] = {
            ...(scrollbarHideStyles[cls] || {}), // Keep existing styles if any
            '-ms-overflow-style': 'none',  /* IE and Edge */
            'scrollbar-width': 'none'  /* Firefox */
        };
      });

      addBase(scrollbarHideStyles);
    }),
    // You can add other plugins here, e.g., require('tailwind-scrollbar-hide') if you still want the explicit .scrollbar-hide utility for some cases
  ],
};
