import type { Config } from 'tailwindcss'

/**
 * Marketing site tailwind — keeps the same k2-* CSS variable names as the
 * authenticated app so styles and assets are portable between the two.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        k2: {
          bg: 'var(--k2-bg)',
          'bg-elev': 'var(--k2-bg-elev)',
          'bg-hover': 'var(--k2-bg-hover)',
          border: 'var(--k2-border)',
          'border-strong': 'var(--k2-border-strong)',
          text: 'var(--k2-text)',
          'text-dim': 'var(--k2-text-dim)',
          'text-mute': 'var(--k2-text-mute)',
          accent: 'var(--k2-accent)',
          'accent-dim': 'var(--k2-accent-dim)',
          'accent-fg': 'var(--k2-accent-fg)',
          good: 'var(--k2-good)',
          warn: 'var(--k2-warn)',
          bad: 'var(--k2-bad)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        playfair: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '7px',
        DEFAULT: '10px',
        lg: '14px',
      },
      maxWidth: {
        shell: '1280px',
      },
    },
  },
  plugins: [],
}

export default config
