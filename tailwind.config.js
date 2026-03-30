/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
        },
        dark: {
          bg: '#1a1a2e',
          card: '#16213e',
          border: '#2d3a5a',
          text: '#e2e8f0',
          muted: '#94a3b8',
        }
      }
    },
  },
  plugins: [],
}
