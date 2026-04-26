import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EAF2F8',
          100: '#D4E7F3',
          500: '#2E75B6',
          700: '#1F4E79',
          900: '#0E3559',
        },
        muted: '#6B7280',
        rule: '#E5E7EB',
        ok: '#1E7E34',
        warn: '#C0392B',
        bronze: '#CD7F32',
        silver: '#C0C0C0',
        gold: '#FFD700',
        sapphire: '#0F52BA',
        emerald: '#50C878',
        obsidian: '#3D3D3D',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
      },
      boxShadow: {
        soft: '0 6px 22px rgba(31,78,121,.08)',
      },
    },
  },
  plugins: [],
}

export default config
