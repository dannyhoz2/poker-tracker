/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        poker: {
          green: '#1a5d1a',
          felt: '#35654d',
          gold: '#d4af37',
          red: '#c41e3a',
        },
      },
    },
  },
  plugins: [],
}
