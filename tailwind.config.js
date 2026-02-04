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
          DEFAULT: '#FF9500',
          50: '#FFF5E6',
          100: '#FFE6C2',
          200: '#FFD699',
          300: '#FFC670',
          400: '#FFB247',
          500: '#FF9500',
          600: '#E68600',
          700: '#CC7700',
          800: '#B36800',
          900: '#805000',
        },
        secondary: {
          DEFAULT: '#00CED1',
          50: '#E6FFFF',
          100: '#B3FFFF',
          200: '#80FFFF',
          300: '#4DFFFF',
          400: '#1AFFFF',
          500: '#00CED1',
          600: '#00B8BA',
          700: '#00A2A4',
          800: '#008C8E',
          900: '#006365',
        },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #FF9500 0%, #00CED1 100%)',
      },
      boxShadow: {
        'accent': '0 10px 40px -10px rgba(255, 149, 0, 0.5)',
        'secondary': '0 10px 40px -10px rgba(0, 206, 209, 0.5)',
      }
    },
  },
  plugins: [],
}
