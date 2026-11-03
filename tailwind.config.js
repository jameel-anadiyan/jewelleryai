/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#FBF8F1',
          100: '#F7F0DF',
          200: '#EEDDBA',
          300: '#E4CA92',
          400: '#DAB86C',
          500: '#C5A059',
          600: '#AA8542',
          700: '#8A6831',
          800: '#6C4E23',
          900: '#4D3618',
        },
        obsidian: {
          850: '#161922',
          900: '#0F1117',
          950: '#090A0D',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 2.2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        }
      }
    },
  },
  plugins: [],
};
