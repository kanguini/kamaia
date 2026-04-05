import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0D0D0D',
        paper: '#FAFAF8',
        bone: '#F0EDE6',
        amber: {
          50: '#FFF8EC',
          100: '#FFEFD3',
          200: '#FFDEA6',
          300: '#FFC86E',
          400: '#FFAA33',
          500: '#C8872A',
          600: '#A66B1E',
          700: '#854F14',
          800: '#6B3D10',
          900: '#4A2A0C',
          DEFAULT: '#C8872A',
        },
        muted: '#6B6660',
        border: '#E2DDD6',
        'border-strong': '#C8C0B4',
        error: '#C0392B',
        success: '#1E7A45',
        warning: '#D97706',
        info: '#2A5FC8',
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        mono: ['DM Mono', 'monospace'],
        sans: ['Instrument Sans', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
