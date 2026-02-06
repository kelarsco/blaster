/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
      },
      colors: {
        blaster: {
          bg: '#faf8f5',
          'bg-app': '#f5f5f7',
          'bg-card': '#ffffff',
          fg: '#1a1a1a',
          muted: '#6b7280',
          accent: '#6366f1',
          'accent-hover': '#4f46e5',
          'input-bg': '#eff6ff',
          'input-border': '#bfdbfe',
          cta: '#6366f1',
          'cta-hover': '#4f46e5',
          sidebar: '#f8f7f5',
          'sidebar-hover': 'rgba(99, 102, 241, 0.08)',
          'nav-active': 'rgba(38, 39, 74, 1)',
          'nav-active-bg': 'rgba(38, 39, 74, 0.13)',
          border: '#e5e5e5',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.12)',
          dark: 'rgba(0, 0, 0, 0.2)',
          border: {
            light: 'rgba(255, 255, 255, 0.25)',
            dark: 'rgba(255, 255, 255, 0.08)',
          },
        },
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        landing: ['DM Sans', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
