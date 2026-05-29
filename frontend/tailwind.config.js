/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: '#09090b',       // Obsidian Black for sidebar
          border: '#18181b',   // Border in dark sidebar
          text: '#a1a1aa',     // Zinc-400
          active: '#ffffff',
          hoverBg: '#180505',  // Very subtle crimson dark tint
        },
        workspace: {
          bg: '#fafafa',       // Bright white/zinc base
          card: '#ffffff',     // Pure white cards
          border: '#e4e4e7',   // Zinc-200 borders
          text: '#18181b',     // Dark text for bright side
          muted: '#71717a',    // Zinc-500 muted text
        },
        brand: {
          primary: '#dc2626',   // Crimson Red
          glow: '#ef4444',      // Ruby Red
          accent: '#b91c1c',    // Dark red
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
