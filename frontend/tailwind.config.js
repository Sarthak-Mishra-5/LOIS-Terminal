/** @type {import('tailwindcss').Config} */
// The terminal colour set. Keep in sync with src/theme.ts, which charts read from.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#0a0a0a',
          panel: '#141414',
          raised: '#1a1a1a',
          border: '#262626',
          active: '#2a2a2a',
          activeBorder: '#3a3a3a',
          axis: '#404040',
          text: '#e5e5e5',
          muted: '#666666',
          up: '#00ff88',
          down: '#ff3355',
          warn: '#ffaa00',
          info: '#4aa8ff',
          level: '#2962ff',
          candleUp: '#26a69a',
          candleDown: '#ef5350',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'Menlo', 'monospace'],
      },
      fontSize: { base: '12px' },
      borderRadius: { panel: '4px', control: '3px' },
    },
  },
  plugins: [],
};
