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
        accent: {
          50: '#FEF3C7',
          500: '#FBBF24',
          700: '#D97706',
        },
        special: {
          500: '#A855F7',
          700: '#9333EA',
        },
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
      borderRadius: {
        DEFAULT: '12px',
      },
      boxShadow: {
        soft: '0 6px 22px rgba(37,99,235,.10)',
        glow: '0 0 24px rgba(251,191,36,.4)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        'bounce-soft': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '30%': { transform: 'translateY(-12px) rotate(-3deg)' },
          '60%': { transform: 'translateY(-6px) rotate(3deg)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-8px)' },
          '40%, 80%': { transform: 'translateX(8px)' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '40%': { transform: 'rotate(8deg)' },
          '60%': { transform: 'rotate(-4deg)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0) rotate(-12deg)', opacity: '0' },
          '70%': { transform: 'scale(1.1) rotate(4deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
      },
      animation: {
        breathe: 'breathe 3s ease-in-out infinite',
        'bounce-soft': 'bounce-soft 0.7s ease-out',
        shake: 'shake 0.4s ease-in-out',
        wave: 'wave 1.6s ease-in-out',
        'pop-in': 'pop-in 0.5s cubic-bezier(.34,1.56,.64,1)',
      },
    },
  },
  plugins: [],
}

export default config
