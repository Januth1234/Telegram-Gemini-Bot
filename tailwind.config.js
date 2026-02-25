/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.tsx', './services/**/*.ts', './types.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: { xs: '320px', tiny: '380px' },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans Sinhala', 'Noto Sans Tamil', 'sans-serif'],
      },
      animation: {
        reveal: 'reveal 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fade: 'fadeIn 0.25s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-in-up': 'slideInUp 0.35s ease-out forwards',
      },
      keyframes: {
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
