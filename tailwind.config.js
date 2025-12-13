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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
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
