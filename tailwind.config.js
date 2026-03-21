/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.tsx', './services/**/*.ts', './types.ts'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: { xs: '320px', tiny: '380px' },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Noto Sans Sinhala', 'Noto Sans Tamil', 'sans-serif'],
      },
      animation: {
        reveal: 'reveal 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fade: 'fadeIn 0.25s ease-out forwards',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-in-up': 'slideInUp 0.35s ease-out forwards',
        'hero-float': 'heroFloat 4s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'view-enter': 'reveal 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'theme-classic': 'themeClassic 6s ease-in-out infinite',
        'theme-midnight': 'themeMidnight 8s ease-in-out infinite',
        'theme-aurora': 'themeAurora 12s ease-in-out infinite',
        'theme-terminal': 'themeTerminal 4s linear infinite',
        'theme-terminal-soft': 'themeTerminalSoft 5s ease-in-out infinite',
        'theme-paper': 'themePaper 5s ease-in-out infinite',
        'theme-ocean': 'themeOcean 10s ease-in-out infinite',
        'theme-sunset': 'themeSunset 9s ease-in-out infinite',
        'hero-glow': 'heroGlow 4s ease-in-out infinite',
        'hero-glow-breathe': 'heroGlowBreathe 6s ease-in-out infinite',
        'hero-glow-drift': 'heroGlowDrift 8s ease-in-out infinite',
        'hero-glow-flicker': 'heroGlowFlicker 3.5s steps(4) infinite',
        'hero-glow-shimmer': 'heroGlowShimmer 5s ease-in-out infinite',
        'hero-glow-wave': 'heroGlowWave 6s ease-in-out infinite',
        'hero-glow-warm': 'heroGlowWarm 5.5s ease-in-out infinite',
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
        heroFloat: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 30px rgba(34, 211, 238, 0.12)' },
          '50%': { boxShadow: '0 0 50px rgba(34, 211, 238, 0.2)' },
        },
        heroGlow: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
        heroGlowBreathe: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.97)' },
          '50%': { opacity: '0.75', transform: 'scale(1.05)' },
        },
        heroGlowDrift: {
          '0%': { opacity: '0.4' },
          '25%': { opacity: '0.75' },
          '50%': { opacity: '0.5' },
          '75%': { opacity: '0.8' },
          '100%': { opacity: '0.4' },
        },
        heroGlowFlicker: {
          '0%, 100%': { opacity: '0.45' },
          '25%': { opacity: '0.7' },
          '50%': { opacity: '0.5' },
          '75%': { opacity: '0.75' },
        },
        heroGlowShimmer: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.9' },
        },
        heroGlowWave: {
          '0%, 100%': { opacity: '0.5' },
          '33%': { opacity: '0.85' },
          '66%': { opacity: '0.6' },
        },
        heroGlowWarm: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.88' },
        },
        shimmer: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        themeClassic: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' },
        },
        themeMidnight: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.75' },
        },
        themeTerminalSoft: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '0.85' },
        },
        themeAurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        themeTerminal: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        themePaper: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.92' },
        },
        themeOcean: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '200% 0%' },
        },
        themeSunset: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
};
