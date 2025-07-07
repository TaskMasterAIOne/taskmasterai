// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import plugin from 'tailwindcss/plugin';

// Reflect the CSS-safe names for keys, but actual font names (quoted if spaces) for values
const QUILL_FONTS_OBJECT_FOR_TAILWIND = {
  'sans-serif': ['sans-serif'],
  'serif': ['serif'],
  'monospace': ['monospace'],
  'arial': ['Arial', 'sans-serif'],
  'comicsansms': ['"Comic Sans MS"', 'cursive', 'sans-serif'], // Key is CSS-safe
  'couriernew': ['"Courier New"', 'Courier', 'monospace'],    // Key is CSS-safe
  'georgia': ['Georgia', 'serif'],
  'helvetica': ['Helvetica', 'sans-serif'],
  'lucidasansunicode': ['"Lucida Sans Unicode"', '"Lucida Grande"', 'sans-serif'], // Key is CSS-safe
  'poppins': ['Poppins', 'sans-serif'],
  'tahoma': ['Tahoma', 'sans-serif'],
  'timesnewroman': ['"Times New Roman"', 'Times', 'serif'], // Key is CSS-safe
  'trebuchetms': ['"Trebuchet MS"', 'sans-serif'],       // Key is CSS-safe
  'verdana': ['Verdana', 'sans-serif']
};


export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ...QUILL_FONTS_OBJECT_FOR_TAILWIND,
      },
      colors: {
        dark: {
          DEFAULT: '#0A0B0F',
          primary: '#0C0E1A',
          secondary: '#16181D',
          tertiary: '#1F2328',
          text: '#E0E0E0',
          'text-secondary': '#A0A0A0',
        },
        gray: {
          900: '#0f172a', 800: '#1e293b', 700: '#334155', 600: '#475569',
          500: '#64748b', 400: '#94a3b8', 300: '#cbd5e1', 200: '#e2e8f0',
          100: '#f1f5f9', 50: '#f8fafc',
        },
        indigo: {
          600: '#4f46e5', 500: '#6366f1', 400: '#818cf8', 300: '#a5b4fc',
        },
        purple: {
          600: '#9333ea', 500: '#a855f7', 400: '#c084fc',
        },
        teal: {
          600: '#0d9488', 500: '#14b8a6',
        },
        pink: {
          600: '#db2777', 400: '#f472b6',
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
        'fadeIn': 'fadeIn 0.3s ease-out forwards',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { 'background-size': '200% 200%', 'background-position': 'left center' },
          '50%': { 'background-size': '200% 200%', 'background-position': 'right center' },
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
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.gray.700'),
            '--tw-prose-headings': theme('colors.gray.900'),
            '--tw-prose-lead': theme('colors.gray.600'),
            '--tw-prose-links': theme('colors.indigo.600'),
            '--tw-prose-bold': theme('colors.gray.900'),
            '--tw-prose-counters': theme('colors.purple.500'),
            '--tw-prose-bullets': theme('colors.purple.500'),
            '--tw-prose-hr': theme('colors.gray.200'),
            '--tw-prose-quotes': theme('colors.gray.600'),
            '--tw-prose-quote-borders': theme('colors.purple.500'),
            '--tw-prose-captions': theme('colors.gray.500'),
            '--tw-prose-code': theme('colors.pink.600'),
            '--tw-prose-pre-code': theme('colors.gray.800'),
            '--tw-prose-pre-bg': theme('colors.gray.50'),
            '--tw-prose-th-borders': theme('colors.gray.300'),
            '--tw-prose-td-borders': theme('colors.gray.200'),
            fontFamily: theme('fontFamily.poppins', ['Poppins', 'sans-serif']).join(', '),
            a: { '&:hover': { color: theme('colors.indigo.700', theme('colors.indigo.500')) }, textDecoration: 'none', fontWeight: '500',},
            h1: { fontWeight: '700', fontSize: theme('fontSize.3xl')[0], lineHeight: theme('fontSize.3xl')[1].lineHeight, marginBottom: theme('spacing.6'), marginTop: theme('spacing.8')},
            h2: { fontWeight: '600', fontSize: theme('fontSize.2xl')[0], lineHeight: theme('fontSize.2xl')[1].lineHeight, marginTop: theme('spacing.7'), marginBottom: theme('spacing.5'),},
            h3: { fontWeight: '600', fontSize: theme('fontSize.xl')[0], lineHeight: theme('fontSize.xl')[1].lineHeight, marginTop: theme('spacing.6'), marginBottom: theme('spacing.4'),},
            'ul, ol': { paddingLeft: theme('spacing.5'), marginTop: theme('spacing.4'), marginBottom: theme('spacing.4'),},
            li: { marginTop: theme('spacing.2'), marginBottom: theme('spacing.2') },
            'ul > li:not([data-list])::marker': { color: 'var(--tw-prose-bullets)', fontWeight: '600' }, // Target standard ul li markers
            'ol > li::marker': { color: 'var(--tw-prose-counters)', fontWeight: '600' },
             // Specific styling for Quill checklist items will be handled in Notes.tsx readOnlyQuillClasses
            p: { marginBottom: theme('spacing.5'), lineHeight: '1.75',},
            blockquote: {
              borderLeftWidth: '3px',
              borderLeftColor: 'var(--tw-prose-quote-borders)',
              paddingLeft: theme('spacing.4'),
              fontStyle: 'italic',
              color: 'var(--tw-prose-quotes)',
            },
            code: { backgroundColor: theme('colors.gray.100'), padding: '0.2em 0.4em', borderRadius: theme('borderRadius.md'), fontSize: '0.9em',},
            'code::before': { content: '"" !important' }, 'code::after': { content: '"" !important' },
            'pre': {
                backgroundColor: 'var(--tw-prose-pre-bg)',
                color: 'var(--tw-prose-pre-code)',
                padding: theme('spacing.4'),
                borderRadius: theme('borderRadius.md'),
                overflowX: 'auto',
            },
            'pre code': { backgroundColor: 'transparent !important', padding: '0 !important', fontSize: '0.875em !important', color: 'inherit !important'},
            img: { borderRadius: theme('borderRadius.lg'), boxShadow: theme('boxShadow.md'), marginTop: theme('spacing.6'), marginBottom: theme('spacing.6'),},
            table: { width: '100%', marginTop: theme('spacing.6'), marginBottom: 'spacing.6', fontSize: theme('fontSize.sm'), borderCollapse: 'collapse' },
            'thead th': { color: theme('colors.gray.800'), padding: `${theme('spacing.2')} ${theme('spacing.3')}`, fontWeight: '600', textAlign: 'left', border: `1px solid var(--tw-prose-th-borders)`, backgroundColor: theme('colors.gray.100'),},
            'tbody td': { padding: `${theme('spacing.2')} ${theme('spacing.3')}`, border: `1px solid var(--tw-prose-td-borders)`,},
            'tbody tr:nth-child(even) td': { backgroundColor: theme('colors.gray.50'),},
          },
        },
        invert: {
          css: {
            '--tw-prose-body': theme('colors.dark.text'),
            '--tw-prose-headings': theme('colors.gray.50'),
            '--tw-prose-lead': theme('colors.gray.400'),
            '--tw-prose-links': theme('colors.indigo.300'),
            '--tw-prose-bold': theme('colors.gray.50'),
            '--tw-prose-counters': theme('colors.purple.400'),
            '--tw-prose-bullets': theme('colors.purple.400'),
            '--tw-prose-hr': theme('colors.gray.700'),
            '--tw-prose-quotes': theme('colors.dark.text-secondary'),
            '--tw-prose-quote-borders': theme('colors.purple.400'),
            '--tw-prose-captions': theme('colors.gray.400'),
            '--tw-prose-code': theme('colors.pink.400'),
            '--tw-prose-pre-code': theme('colors.gray.200'),
            '--tw-prose-pre-bg': theme('colors.dark.secondary'),
            '--tw-prose-th-borders': theme('colors.gray.600'),
            '--tw-prose-td-borders': theme('colors.gray.700'),
            fontFamily: theme('fontFamily.poppins', ['Poppins', 'sans-serif']).join(', '),
            a: { '&:hover': { color: theme('colors.indigo.400', theme('colors.indigo.200')) },},
            h1: { color: 'var(--tw-prose-headings)'},
            h2: { color: 'var(--tw-prose-headings)'},
            h3: { color: 'var(--tw-prose-headings)'},
            'ul > li:not([data-list])::marker': { color: 'var(--tw-prose-bullets)' }, // Target standard ul li markers for dark mode
            'ol > li::marker': { color: 'var(--tw-prose-counters)' },
            // Specific styling for Quill checklist items will be handled in Notes.tsx readOnlyQuillClasses
            blockquote: {
                borderLeftColor: 'var(--tw-prose-quote-borders)',
                color: 'var(--tw-prose-quotes)',
            },
            code: { backgroundColor: theme('colors.dark.tertiary') },
            'pre': {
                backgroundColor: 'var(--tw-prose-pre-bg)',
                color: 'var(--tw-prose-pre-code)',
            },
            'pre code': { backgroundColor: 'transparent !important', color: 'inherit !important' },
            img: { borderColor: theme('colors.dark.secondary') },
            'thead th': { color: 'var(--tw-prose-headings)', border: `1px solid var(--tw-prose-th-borders)`, backgroundColor: theme('colors.dark.secondary'),},
            'tbody td': { color: 'var(--tw-prose-body)', border: `1px solid var(--tw-prose-td-borders)`, backgroundColor: theme('colors.dark.primary'),},
            'tbody tr:nth-child(even) td': { backgroundColor: theme('colors.dark.secondary'),}
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    plugin(function({ addBase, addUtilities, theme }) {
      // Add base styles for consistent, modern scrollbars
      addBase({
        // For Firefox
        'html': {
          'scrollbar-width': 'thin',
          'scrollbar-color': `${theme('colors.gray.400')} transparent`,
        },
        '.dark html': {
          'scrollbar-color': `${theme('colors.gray.600')} ${theme('colors.dark.primary')}`,
        },
        // For Webkit-based browsers (Chrome, Safari, Edge)
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: theme('colors.gray.300'),
          borderRadius: '10px',
          border: `2px solid transparent`,
          backgroundClip: 'content-box',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: theme('colors.gray.400'),
        },
        '.dark ::-webkit-scrollbar-thumb': {
          backgroundColor: theme('colors.gray.600'),
        },
        '.dark ::-webkit-scrollbar-thumb:hover': {
          backgroundColor: theme('colors.gray.500'),
        },
      });

      // Add utility to hide scrollbars if needed
      addUtilities({
        '.no-scrollbar::-webkit-scrollbar': { 'display': 'none' },
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',  /* IE and Edge */
          'scrollbar-width': 'none'    /* Firefox */
        },
      });
    })
  ],
};
