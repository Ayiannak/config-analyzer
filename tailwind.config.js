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
          DEFAULT: '#CDFF66',
          50: '#F7FFE6',
          100: '#EFFFCC',
          200: '#E6FF99',
          300: '#DEFF7F',
          400: '#D6FF73',
          500: '#CDFF66',
          600: '#B8E65C',
          700: '#A3CC52',
          800: '#8FB347',
          900: '#6B8535',
        },
        secondary: {
          DEFAULT: '#8B5CF6',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #CDFF66 0%, #8B5CF6 100%)',
      },
      boxShadow: {
        'accent': '0 10px 40px -10px rgba(205, 255, 102, 0.5)',
        'secondary': '0 10px 40px -10px rgba(139, 92, 246, 0.5)',
      }
    },
  },
  plugins: [],
}
