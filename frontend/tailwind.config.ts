import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Default everywhere: code, hashes, diffs, graph labels.
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
        // UI chrome only (buttons, nav labels) — opt in with `font-sans`.
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        bg: {
          DEFAULT: '#0d1117',
          soft: '#161b22',
          inset: '#010409',
          hover: '#21262d',
        },
        border: {
          DEFAULT: '#30363d',
          muted: '#21262d',
        },
        fg: {
          DEFAULT: '#e6edf3',
          muted: '#8b949e',
          // Lightened from #6e7681 to clear WCAG AA (>=4.5) for small text on
          // both bg and bg-soft; still visibly fainter than fg-muted.
          faint: '#7d8590',
        },
        // Diff surfaces.
        diff: {
          add: '#3fb950',
          'add-bg': 'rgba(63,185,80,0.15)',
          remove: '#f85149',
          'remove-bg': 'rgba(248,81,73,0.15)',
        },
        // Neutral hash-grey scale for object ids / metadata.
        hash: {
          DEFAULT: '#8b949e',
          50: '#f0f3f6',
          100: '#d0d7de',
          200: '#afb8c1',
          300: '#8b949e',
          400: '#6e7681',
          500: '#57606a',
          600: '#424a53',
          700: '#32383f',
          800: '#21262d',
          900: '#161b22',
        },
        // Single accent for branch pointers + active states.
        accent: {
          DEFAULT: '#58a6ff',
          soft: '#1f6feb',
          muted: 'rgba(88,166,255,0.15)',
        },
        branch: '#d2a8ff',
        tag: '#e3b341',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        // Easing shared with src/lib/motion.ts EASE so CSS entry animations and
        // framer-motion variants read as one motion language.
        'fade-in': 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
