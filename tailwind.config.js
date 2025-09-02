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

  'clarika': ['Clarika Geometric Medium', 'Clarika Fallback', 'sans-serif'],
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
        // New semantic font families for the typography system
        'heading': ['Clarika Geometric Medium', 'Clarika Fallback', 'sans-serif'],
        'body': ['Clarika Geometric Medium', 'Clarika Fallback', 'sans-serif'],
        'mono': ['Menlo', 'Monaco', 'Courier New', 'monospace'],
        // Optimized Clarika variants for specific use cases
        'clarika-pricing': ['Clarika Geometric Medium', 'Clarika Fallback', 'sans-serif'],
        'clarika-numbers': ['Clarika Geometric Medium', 'Clarika Fallback', 'sans-serif'],
      },
      colors: {
        // Global theme colors using CSS custom properties
        theme: {
          primary: 'var(--bg-primary)',
          sidebar: 'var(--bg-sidebar)',
          card: 'var(--bg-card)',
          highlight: 'var(--bg-highlight)',
          'solid-button': 'var(--bg-solid-button)',
          'border-radius': 'var(--bg-border-radius)',
          'text-primary': 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
          'border-primary': 'var(--border-primary)',
          'border-secondary': 'var(--border-secondary)',
        },
        // Legacy dark colors for backward compatibility
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
      fontFeatureSettings: {
        'tabular': ['tnum'],
        'kern': ['kern'],
        'liga': ['liga'],
        'calt': ['calt'],
      },
      fontVariantNumeric: {
        'tabular': 'tabular-nums',
        'oldstyle': 'oldstyle-nums',
        'lining': 'lining-nums',
        'proportional': 'proportional-nums',
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
      // Updated typography plugin with responsive clamp() values and proper font families
      typography: (theme) => ({
        DEFAULT: {
          css: {
            // Color variables using theme colors
            '--tw-prose-body': theme('colors.theme.text-secondary'),
            '--tw-prose-headings': theme('colors.theme.text-primary'),
            '--tw-prose-lead': theme('colors.theme.text-secondary'),
            '--tw-prose-links': theme('colors.theme.solid-button'),
            '--tw-prose-bold': theme('colors.theme.text-primary'),
            '--tw-prose-counters': theme('colors.theme.solid-button'),
            '--tw-prose-bullets': theme('colors.theme.solid-button'),
            '--tw-prose-hr': theme('colors.theme.border-primary'),
            '--tw-prose-quotes': theme('colors.theme.text-secondary'),
            '--tw-prose-quote-borders': theme('colors.theme.solid-button'),
            '--tw-prose-captions': theme('colors.theme.text-muted'),
            '--tw-prose-code': theme('colors.theme.solid-button'),
            '--tw-prose-pre-code': theme('colors.theme.text-primary'),
            '--tw-prose-pre-bg': theme('colors.theme.card'),
            '--tw-prose-th-borders': theme('colors.theme.border-primary'),
            '--tw-prose-td-borders': theme('colors.theme.border-primary'),
            
            // Font families - Clarika for headings and body
            fontFamily: theme('fontFamily.body').join(', '),
            
            // Headings with responsive clamp() values
            h1: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '700', 
              fontSize: 'clamp(1.875rem, 1.5rem + 1vw, 2.5rem)',
              lineHeight: '1.2',
              marginTop: '1.5rem',
              marginBottom: '1rem',
              color: 'var(--tw-prose-headings)',
            },
            h2: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '600', 
              fontSize: 'clamp(1.5rem, 1.25rem + 0.8vw, 2rem)',
              lineHeight: '1.3',
              marginTop: '1.25rem',
              marginBottom: '0.75rem',
              color: 'var(--tw-prose-headings)',
            },
            h3: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '600', 
              fontSize: 'clamp(1.25rem, 1.125rem + 0.5vw, 1.5rem)',
              lineHeight: '1.4',
              marginTop: '1rem',
              marginBottom: '0.5rem',
              color: 'var(--tw-prose-headings)',
            },
            h4: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '600', 
              fontSize: 'clamp(1.125rem, 1rem + 0.4vw, 1.25rem)',
              lineHeight: '1.4',
              color: 'var(--tw-prose-headings)',
            },
            h5: { 
              fontFamily: theme('fontFamily.body').join(', '),
              fontWeight: '600', 
              fontSize: 'clamp(1rem, 0.9rem + 0.3vw, 1.125rem)',
              lineHeight: '1.5',
              color: 'var(--tw-prose-headings)',
            },
            h6: { 
              fontFamily: theme('fontFamily.body').join(', '),
              fontWeight: '600', 
              fontSize: 'clamp(1rem, 0.9rem + 0.3vw, 1.125rem)',
              lineHeight: '1.5',
              color: 'var(--tw-prose-headings)',
            },
            
            // Body text with responsive sizing
            p: { 
              fontFamily: theme('fontFamily.body').join(', '),
              fontSize: 'clamp(0.9375rem, 0.85rem + 0.3vw, 1.0625rem)',
              lineHeight: '1.6',
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
              color: 'var(--tw-prose-body)',
            },
            
            // Lists with responsive sizing
            'ul, ol': { 
              fontFamily: theme('fontFamily.body').join(', '),
              fontSize: 'clamp(0.9375rem, 0.85rem + 0.3vw, 1.0625rem)',
              lineHeight: '1.6',
              marginTop: '0.75rem',
              marginBottom: '0.75rem',
              paddingLeft: '1.5rem',
            },
            li: { 
              fontFamily: theme('fontFamily.body').join(', '),
              fontSize: 'clamp(0.9375rem, 0.85rem + 0.3vw, 1.0625rem)',
              lineHeight: '1.6',
              marginTop: '0.25rem',
              marginBottom: '0.5rem',
              color: 'var(--tw-prose-body)',
            },
            
            // Code blocks with responsive sizing
            code: { 
              fontFamily: theme('fontFamily.mono').join(', '),
              fontSize: '0.9em',
              backgroundColor: 'var(--tw-prose-pre-bg)',
              padding: '0.2em 0.4em',
              borderRadius: '4px',
              color: 'var(--tw-prose-code)',
            },
            'code::before': { content: '"" !important' }, 
            'code::after': { content: '"" !important' },
            
            pre: { 
              fontFamily: theme('fontFamily.mono').join(', '),
              fontSize: 'clamp(0.875rem, 0.8rem + 0.2vw, 1rem)',
              lineHeight: '1.5',
              backgroundColor: 'var(--tw-prose-pre-bg)',
              color: 'var(--tw-prose-pre-code)',
              padding: '1rem',
              borderRadius: '6px',
              overflowX: 'auto',
            },
            'pre code': { 
              backgroundColor: 'transparent !important', 
              padding: '0 !important', 
              fontSize: 'inherit !important', 
              color: 'inherit !important'
            },
            
            // Blockquotes with responsive sizing
            blockquote: {
              fontFamily: theme('fontFamily.body').join(', '),
              fontSize: 'clamp(0.9375rem, 0.85rem + 0.3vw, 1.0625rem)',
              lineHeight: '1.6',
              borderLeftWidth: '4px',
              borderLeftColor: 'var(--tw-prose-quote-borders)',
              paddingLeft: '1rem',
              fontStyle: 'italic',
              color: 'var(--tw-prose-quotes)',
              marginTop: '1rem',
              marginBottom: '1rem',
            },
            
            // Tables with responsive sizing
            table: { 
              width: '100%', 
              marginTop: '1.5rem', 
              marginBottom: '1.5rem', 
              fontSize: 'clamp(0.875rem, 0.8rem + 0.2vw, 1rem)',
              borderCollapse: 'collapse' 
            },
            'thead th': { 
              color: 'var(--tw-prose-headings)', 
              padding: '0.75rem 1rem', 
              fontWeight: '600', 
              textAlign: 'left', 
              border: '1px solid var(--tw-prose-th-borders)', 
              backgroundColor: 'var(--tw-prose-pre-bg)',
            },
            'tbody td': { 
              padding: '0.75rem 1rem', 
              border: '1px solid var(--tw-prose-td-borders)',
              color: 'var(--tw-prose-body)',
            },
            'tbody tr:nth-child(even) td': { 
              backgroundColor: 'var(--tw-prose-pre-bg)',
            },
            
            // Links
            a: { 
              color: 'var(--tw-prose-links)', 
              textDecoration: 'none', 
              fontWeight: '500',
              '&:hover': { 
                color: theme('colors.theme.header'), 
              }, 
            },
            
            // Images
            img: { 
              borderRadius: '12px', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
              marginTop: '1.5rem', 
              marginBottom: '1.5rem',
            },
            
            // List markers
            'ul > li:not([data-list])::marker': { 
              color: 'var(--tw-prose-bullets)', 
              fontWeight: '600' 
            },
            'ol > li::marker': { 
              color: 'var(--tw-prose-counters)', 
              fontWeight: '600' 
            },
          },
        },
        invert: {
          css: {
            // Dark mode color variables
            '--tw-prose-body': theme('colors.dark.text'),
            '--tw-prose-headings': theme('colors.gray.50'),
            '--tw-prose-lead': theme('colors.gray.400'),
            '--tw-prose-links': theme('colors.theme.solid-button'),
            '--tw-prose-bold': theme('colors.gray.50'),
            '--tw-prose-counters': theme('colors.theme.solid-button'),
            '--tw-prose-bullets': theme('colors.theme.solid-button'),
            '--tw-prose-hr': theme('colors.gray.700'),
            '--tw-prose-quotes': theme('colors.dark.text-secondary'),
            '--tw-prose-quote-borders': theme('colors.theme.solid-button'),
            '--tw-prose-captions': theme('colors.gray.400'),
            '--tw-prose-code': theme('colors.theme.solid-button'),
            '--tw-prose-pre-code': theme('colors.gray.200'),
            '--tw-prose-pre-bg': theme('colors.dark.secondary'),
            '--tw-prose-th-borders': theme('colors.gray.600'),
            '--tw-prose-td-borders': theme('colors.gray.700'),
            
            // Font families remain the same in dark mode
            fontFamily: theme('fontFamily.body').join(', '),
            
            // Headings in dark mode
            h1: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            h2: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            h3: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            h4: { 
              fontFamily: theme('fontFamily.heading').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            h5: { 
              fontFamily: theme('fontFamily.body').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            h6: { 
              fontFamily: theme('fontFamily.body').join(', '),
              color: 'var(--tw-prose-headings)',
            },
            
            // Body text in dark mode
            p: { 
              fontFamily: theme('fontFamily.body').join(', '),
              color: 'var(--tw-prose-body)',
            },
            
            // Lists in dark mode
            'ul, ol': { 
              fontFamily: theme('fontFamily.body').join(', '),
              color: 'var(--tw-prose-body)',
            },
            li: { 
              fontFamily: theme('fontFamily.body').join(', '),
              color: 'var(--tw-prose-body)',
            },
            
            // Links in dark mode
            a: { 
              color: 'var(--tw-prose-links)',
              '&:hover': { 
                color: theme('colors.theme.accent-secondary'), 
              }, 
            },
            
            // List markers in dark mode
            'ul > li:not([data-list])::marker': { 
              color: 'var(--tw-prose-bullets)' 
            },
            'ol > li::marker': { 
              color: 'var(--tw-prose-counters)' 
            },
            
            // Blockquotes in dark mode
            blockquote: {
              fontFamily: theme('fontFamily.body').join(', '),
              borderLeftColor: 'var(--tw-prose-quote-borders)',
              color: 'var(--tw-prose-quotes)',
            },
            
            // Code in dark mode
            code: { 
              backgroundColor: 'var(--tw-prose-pre-bg)',
              color: 'var(--tw-prose-code)',
            },
            
            // Pre blocks in dark mode
            'pre': {
              backgroundColor: 'var(--tw-prose-pre-bg)',
              color: 'var(--tw-prose-pre-code)',
            },
            'pre code': { 
              backgroundColor: 'transparent !important', 
              color: 'inherit !important' 
            },
            
            // Images in dark mode
            img: { 
              borderColor: theme('colors.dark.secondary') 
            },
            
            // Tables in dark mode
            'thead th': { 
              color: 'var(--tw-prose-headings)', 
              border: '1px solid var(--tw-prose-th-borders)', 
              backgroundColor: 'var(--tw-prose-pre-bg)',
            },
            'tbody td': { 
              color: 'var(--tw-prose-body)', 
              border: '1px solid var(--tw-prose-td-borders)', 
              backgroundColor: 'var(--tw-prose-pre-bg)',
            },
            'tbody tr:nth-child(even) td': { 
              backgroundColor: theme('colors.dark.secondary'),
            }
          },
        },
      }),
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
