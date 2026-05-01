import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          300: '#93C5FD',
          500: '#3B82F6',
          700: '#2563EB',
          900: '#1E3A8A',
        },
        accent: { 50: '#FEF3C7', 500: '#FBBF24', 700: '#D97706' },
        special: { 500: '#A855F7', 700: '#9333EA' },
        muted: '#6B7280',
        rule: '#E5E7EB',
        ok: '#10B981',
        warn: '#EF4444',
        bronze: '#CD7F32',
        silver: '#C0C0C0',
        gold: '#FFD700',
        sapphire: '#0F52BA',
        emerald: '#50C878',
        obsidian: '#3D3D3D',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      borderRadius: { DEFAULT: '12px' },
      boxShadow: { soft: '0 6px 22px rgba(37,99,235,.10)', glow: '0 0 24px rgba(251,191,36,.4)' },
      keyframes: {
        breathe: { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.04)' } },
        'bounce-soft': { '0%, 100%': { transform: 'translateY(0) rotate(0deg)' }, '30%': { transform: 'translateY(-12px) rotate(-3deg)' }, '60%': { transform: 'translateY(-6px) rotate(3deg)' } },
        shake: { '0%, 100%': { transform: 'translateX(0)' }, '20%, 60%': { transform: 'translateX(-8px)' }, '40%, 80%': { transform: 'translateX(8px)' } },
        wave: { '0%, 100%': { transform: 'rotate(0deg)' }, '20%': { transform: 'rotate(-8deg)' }, '40%': { transform: 'rotate(8deg)' }, '60%': { transform: 'rotate(-4deg)' } },
        'pop-in': { '0%': { transform: 'scale(0) rotate(-12deg)', opacity: '0' }, '70%': { transform: 'scale(1.1) rotate(4deg)', opacity: '1' }, '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' } },
        // v3.7.5 — animations plus vivantes pour Dodo
        'slide-up-bounce': {
          '0%':   { transform: 'translateY(120%) scale(0.7)', opacity: '0' },
          '50%':  { transform: 'translateY(-15%) scale(1.1)', opacity: '1' },
          '70%':  { transform: 'translateY(8%) scale(0.95)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        celebrate: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg) scale(1)' },
          '15%':      { transform: 'translateY(-18px) rotate(-8deg) scale(1.08)' },
          '30%':      { transform: 'translateY(0) rotate(8deg) scale(1)' },
          '45%':      { transform: 'translateY(-12px) rotate(-4deg) scale(1.05)' },
          '60%':      { transform: 'translateY(0) rotate(4deg) scale(1)' },
          '75%':      { transform: 'translateY(-6px) rotate(0deg) scale(1.02)' },
        },
        'wobble-strong': {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '15%':      { transform: 'translateX(-12px) rotate(-6deg)' },
          '30%':      { transform: 'translateX(10px) rotate(5deg)' },
          '45%':      { transform: 'translateX(-8px) rotate(-4deg)' },
          '60%':      { transform: 'translateX(6px) rotate(3deg)' },
          '75%':      { transform: 'translateX(-3px) rotate(-1deg)' },
        },
        'peek-in': {
          '0%':   { transform: 'translateY(100%) scale(0.5)', opacity: '0' },
          '60%':  { transform: 'translateY(-10%) scale(1.05) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: '1' },
        },
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 0.7s ease-out',
        shake: 'shake 0.4s ease-in-out',
        wave: 'wave 1.6s ease-in-out',
        'pop-in': 'pop-in 0.5s cubic-bezier(.34,1.56,.64,1)',
        // v3.7.5
        'slide-up-bounce': 'slide-up-bounce 0.7s cubic-bezier(.34,1.56,.64,1)',
        celebrate: 'celebrate 1.4s ease-in-out infinite',
        'wobble-strong': 'wobble-strong 0.7s ease-in-out',
        'peek-in': 'peek-in 0.6s cubic-bezier(.34,1.56,.64,1)',
      },
    },
  },
  plugins: [],
}

export default config
