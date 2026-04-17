import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
          ghost: 'var(--color-ink-ghost)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          hover: 'var(--color-surface-hover)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
          text: 'var(--color-warning-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
          text: 'var(--color-danger-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
          text: 'var(--color-info-text)',
        },
        // Legacy aliases
        paper: 'var(--color-surface)',
        bone: 'var(--color-surface-raised)',
        muted: 'var(--color-ink-muted)',
        amber: {
          DEFAULT: 'var(--color-ink)',
          50: 'var(--color-surface-raised)',
          100: 'var(--color-surface-hover)',
          600: 'var(--color-ink-secondary)',
        },
        error: 'var(--color-danger)',
      },
      fontFamily: {
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '10px',
        '3xl': '12px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.2)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.2)',
        md: '0 4px 16px rgba(0,0,0,0.3)',
        lg: '0 12px 40px rgba(0,0,0,0.4)',
        xl: '0 24px 64px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}

export default config
