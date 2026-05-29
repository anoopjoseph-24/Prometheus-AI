/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#050506',       // Pure Obsidian
          card: '#0C0C0E',     // Deep Graphite
          border: '#1E1E24',   // Dark Border
          muted: '#71717A',    // Zinc 500
        },
        brand: {
          primary: '#DC2626',   // Crimson Red
          glow: '#EF4444',      // Ruby Red
          accent: '#F59E0B',    // Amber / Gold Accent
          cyber: '#18181B',     // Matte Black
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-red': 'glowRed 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glowRed: {
          '0%': { boxShadow: '0 0 5px rgba(220, 38, 38, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(220, 38, 38, 0.5)' },
        }
      }
    },
  },
  plugins: [],
}
