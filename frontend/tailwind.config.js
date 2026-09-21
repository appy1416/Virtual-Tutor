/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tutor AI Coral brand palette
        brand: {
          50:  '#FFF0EB',
          100: '#FFE4D9',
          200: '#FFC8B5',
          300: '#FFA48A',
          400: '#FF7C5A',
          500: '#FF5A36', // Core Tutor AI Coral
          600: '#E04826',
          700: '#C23617',
          800: '#9C270F',
          900: '#751B08',
        },
        // Warm Cream surface colors matching Tutor AI screenshot
        tutor: {
          bg: '#FFF9F6',
          surface: '#FFF2EB',
          card: '#FFFFFF',
          border: '#F3E8E2',
          borderHover: '#E8D8CF',
          text: '#1E1B18',
          subtext: '#665E58',
          muted: '#9E958E',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #FF5A36, #FF7C5A, #FFA48A)',
        'brand-gradient-subtle': 'linear-gradient(135deg, rgba(255,90,54,0.08), rgba(255,124,90,0.08))',
      }
    },
  },
  plugins: [],
}


