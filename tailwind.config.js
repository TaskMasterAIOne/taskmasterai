// tailwind.config.js
/** @type {import('tailwindcss').Config} */
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
        // --- REMOVED old dev/intern pulse from here if they existed ---
        // 'dev-pulse': 'dev-pulse 2s infinite ease-in-out',
        // 'intern-glow': 'intern-glow 2.2s infinite ease-in-out',

        // --- ADDED For new animations ---
        'avatar-initial-glow-dev': 'avatar-initial-glow-dev 1s ease-out forwards',
        'avatar-initial-glow-intern': 'avatar-initial-glow-intern 1s ease-out forwards',
        // Combined fade-in and then continuous glow for tags
        'tag-animated-dev': 'tag-fade-in 0.5s ease-out forwards, subtle-tag-glow-dev 2s infinite 0.5s ease-in-out',
        'tag-animated-intern': 'tag-fade-in 0.5s ease-out forwards, subtle-tag-glow-intern 2.2s infinite 0.5s ease-in-out',
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
        // --- REMOVED old dev-pulse / intern-glow keyframes ---
        /*
        'dev-pulse': { ... },
        'intern-glow': { ... },
        */

        // --- ADDED Keyframes for new animations ---
        'avatar-initial-glow-dev': {
          '0%': { boxShadow: '0 0 0px 0px rgba(99, 102, 241, 0)' }, // indigo-500
          '50%': { boxShadow: '0 0 20px 8px rgba(99, 102, 241, 0.5)' },
          '100%': { boxShadow: '0 0 0px 0px rgba(99, 102, 241, 0)' }, // Fades out
        },
        'avatar-initial-glow-intern': {
          '0%': { boxShadow: '0 0 0px 0px rgba(20, 184, 166, 0)' }, // teal-500
          '50%': { boxShadow: '0 0 20px 8px rgba(20, 184, 166, 0.5)' }, // Using teal.500 from your palette
          '100%': { boxShadow: '0 0 0px 0px rgba(20, 184, 166, 0)' }, // Fades out
        },
        'tag-fade-in': { // Generic fade-in for tags
          '0%': { opacity: '0', transform: 'translateY(4px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'subtle-tag-glow-dev': { // No scaling, just shadow pulse for DEV
          '0%, 100%': { boxShadow: '0 0 7px 2px rgba(99, 102, 241, 0.4)' }, // indigo-500
          '50%': { boxShadow: '0 0 12px 3px rgba(99, 102, 241, 0.6)' },
        },
        'subtle-tag-glow-intern': { // No scaling, just shadow pulse for INTERN
          '0%, 100%': { boxShadow: '0 0 7px 2px rgba(20, 184, 166, 0.4)' }, // teal-500
          '50%': { boxShadow: '0 0 12px 3px rgba(20, 184, 166, 0.6)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
