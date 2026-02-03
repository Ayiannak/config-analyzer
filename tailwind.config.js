/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sentry: {
          purple: {
            DEFAULT: '#6C5FC7',
            50: '#F5F3FF',
            100: '#EBE8FF',
            200: '#D9D4FF',
            300: '#BFB5FF',
            400: '#A08DFF',
            500: '#6C5FC7',
            600: '#5A4DB5',
            700: '#4A3F99',
            800: '#3D357D',
            900: '#1D1127',
          },
          pink: {
            DEFAULT: '#F55459',
            500: '#F55459',
          },
          coral: '#F55459',
        }
      },
      backgroundImage: {
        'sentry-gradient': 'linear-gradient(135deg, #6C5FC7 0%, #F55459 100%)',
      },
      boxShadow: {
        'sentry': '0 10px 40px -10px rgba(108, 95, 199, 0.5)',
      }
    },
  },
  plugins: [],
}
