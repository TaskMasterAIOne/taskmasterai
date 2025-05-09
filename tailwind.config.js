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
        indigo: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        purple: {
          500: '#a855f7',
        },
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slower': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
        // --- ADDED ---
        'dev-pulse': 'dev-pulse 2s infinite ease-in-out',
        'intern-glow': 'intern-glow 2.2s infinite ease-in-out',
        // --- END ADDED ---
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
        // --- ADDED ---
        'dev-pulse': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 6px 2px rgba(99, 102, 241, 0.6)' }, // indigo-500 based (using your defined indigo-500: #6366f1)
          '50%': { transform: 'scale(1.15)', boxShadow: '0 0 10px 4px rgba(129, 140, 248, 0.75)' }, // a lighter indigo
        },
        'intern-glow': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 6px 2px rgba(16, 185, 129, 0.6)' },   // teal-500/green-500 like
          '50%': { transform: 'scale(1.15)', boxShadow: '0 0 10px 4px rgba(52, 211, 153, 0.75)' },  // a lighter version
        },
        // --- END ADDED ---
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
