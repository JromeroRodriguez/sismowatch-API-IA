/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        slate: {
          850: '#151f32',
          900: '#0f172a',
          950: '#090d16',
        },
        seismic: {
          low: '#10b981',    // green (< 3.0)
          med: '#f59e0b',    // amber (3.0 - 4.4)
          high: '#f97316',   // orange (4.5 - 5.9)
          severe: '#ef4444', // red (>= 6.0)
          deep: '#8b5cf6',   // purple
        }
      },
      boxShadow: {
        'glow-amber': '0 0 24px -4px rgba(245, 158, 11, 0.25)',
        'glow-rose': '0 0 24px -4px rgba(239, 68, 68, 0.25)',
        'glow-emerald': '0 0 24px -4px rgba(16, 185, 129, 0.25)',
        'card-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
