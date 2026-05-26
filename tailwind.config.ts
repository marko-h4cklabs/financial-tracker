import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay: 'var(--bg-overlay)',
        gold: {
          DEFAULT: 'var(--gold-primary)',
          light: 'var(--gold-light)',
          dark: 'var(--gold-dark)',
          muted: 'var(--gold-muted)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        status: {
          green: 'var(--status-green)',
          red: 'var(--status-red)',
          yellow: 'var(--status-yellow)',
          blue: 'var(--status-blue)',
          purple: 'var(--status-purple)',
        },
      },
      fontFamily: {
        display: ['Cormorant Garamond', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
