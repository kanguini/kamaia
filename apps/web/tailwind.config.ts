import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core
        ink: {
          DEFAULT: '#070707',
          secondary: '#3D3D3A',
          muted: '#888780',
          ghost: '#B4B2A9',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#F7F6F3',
          hover: '#F0EEE9',
        },
        border: {
          DEFAULT: '#E2E0DA',
          strong: '#C8C6BF',
        },
        // Semantic
        success: {
          DEFAULT: '#1D9E75',
          bg: '#D1FAE5',
          text: '#065F46',
        },
        warning: {
          DEFAULT: '#EF9F27',
          bg: '#FEF3C7',
          text: '#92400E',
        },
        danger: {
          DEFAULT: '#E24B4A',
          bg: '#FEE2E2',
          text: '#991B1B',
        },
        info: {
          DEFAULT: '#378ADD',
          bg: '#DBEAFE',
          text: '#1E40AF',
        },
        // Legacy aliases (keep pages working during transition)
        paper: '#FFFFFF',
        bone: '#F7F6F3',
        muted: '#888780',
        amber: {
          DEFAULT: '#070707',
          50: '#F7F6F3',
          100: '#F0EEE9',
          600: '#1a1a1a',
        },
        error: '#E24B4A',
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.06)',
        md: '0 4px 16px rgba(0,0,0,0.08)',
        lg: '0 12px 40px rgba(0,0,0,0.10)',
        xl: '0 24px 64px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}

export default config
