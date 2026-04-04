/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Global theme colors using CSS custom properties from theme.css
        background: 'var(--bg-primary)',
        surface: 'var(--bg-sidebar)',
        'surface-elevated': 'var(--bg-card)',
        'surface-highlight': 'var(--bg-highlight)',
        border: {
          DEFAULT: 'var(--border-primary)',
          light: 'var(--border-secondary)',
        },
        text: {
          DEFAULT: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-placeholder)',
        },
        accent: {
          DEFAULT: 'var(--bg-accent)',
          hover: 'var(--bg-accent-secondary)',
          muted: 'var(--bg-header)',
        },
        'status-success': 'var(--status-success)',
        'status-warning': 'var(--status-warning)',
        'status-error': 'var(--status-error)',
        'status-info': 'var(--status-info)',
        // Flat keys so utilities like border-marketing-border / bg-marketing-bg JIT reliably (nested "marketing.border" can fail vs preflight border-color)
        'marketing-bg': 'var(--marketing-bg)',
        'marketing-surface': 'var(--marketing-surface)',
        'marketing-elevated': 'var(--marketing-elevated)',
        'marketing-text': 'var(--marketing-text)',
        'marketing-muted': 'var(--marketing-text-muted)',
        'marketing-border': 'var(--marketing-border)',
        'marketing-link': 'var(--marketing-link)',
        'marketing-link-hover': 'var(--marketing-link-hover)',
        'marketing-eyebrow': 'var(--marketing-eyebrow)',
        'marketing-panel': 'var(--marketing-panel-bg)',
        'marketing-panel-edge': 'var(--marketing-panel-edge)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        /** Same stack as `sans` — kept for explicit `font-inter` usage */
        inter: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        /** Cruip open-react-template heading font (@font-face in index.css) */
        nacelle: ['Nacelle', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        'xs': ['0.8125rem', { lineHeight: '1.5' }],
        'sm': ['0.875rem', { lineHeight: '1.5' }],
        'base': ['0.9375rem', { lineHeight: '1.5' }],
        'lg': ['1.0625rem', { lineHeight: '1.5' }],
        'xl': ['1.1875rem', { lineHeight: '1.4' }],
        '2xl': ['1.375rem', { lineHeight: '1.3' }],
        '3xl': ['1.625rem', { lineHeight: '1.2' }],
        '4xl': ['2rem', { lineHeight: '1.2' }],
        '5xl': ['2.5rem', { lineHeight: '1.1' }],
        '6xl': ['3rem', { lineHeight: '1.05' }],
        '7xl': ['3.5rem', { lineHeight: '1.05' }],
        /**
         * Cruip Open template @theme scale (tailwind v4 app/css/style.css)
         * Use on `.open-sample` so Landing matches template sizing.
         */
        'open-xs': ['0.8125rem', { lineHeight: '1.5384' }],
        'open-sm': ['0.875rem', { lineHeight: '1.5715' }],
        'open-base': ['0.9375rem', { lineHeight: '1.5333', letterSpacing: '-0.0125em' }],
        'open-lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.0125em' }],
        'open-xl': ['1.25rem', { lineHeight: '1.5', letterSpacing: '-0.0125em' }],
        'open-2xl': ['1.5rem', { lineHeight: '1.415', letterSpacing: '-0.0268em' }],
        'open-3xl': ['1.75rem', { lineHeight: '1.3571', letterSpacing: '-0.0268em' }],
        'open-4xl': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.0268em' }],
        'open-5xl': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
        'open-6xl': ['4rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
        'open-7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.0268em' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
