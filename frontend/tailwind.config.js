/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          pitch: '#09090B',
          card: '#121215',
          elevated: '#18181B',
          hover: '#27272A',
        },
        border: {
          subtle: '#27272A',
          strong: '#3F3F46',
          red: '#DC2626',
        },
        red: {
          DEFAULT: '#DC2626',
          bright: '#EF4444',
          hover: '#B91C1C',
          dark: '#991B1B',
          glow: 'rgba(220, 38, 38, 0.2)',
        },
        text: {
          main: '#FAFAFA',
          sub: '#A1A1AA',
          muted: '#71717A',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        'red-subtle': '0 4px 20px -2px rgba(220, 38, 38, 0.15)',
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.24)',
      },
    },
  },
  plugins: [],
};
