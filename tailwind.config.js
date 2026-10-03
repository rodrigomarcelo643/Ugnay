/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ugnay: {
          bg: '#FFFFFF',
          soft: '#F4F8FA',
          card: '#FFFFFF',
          surface: '#EBF3F5',
          border: '#D2E3E8',
          text: {
            DEFAULT: '#0F1B22',
            muted: '#5A7D88',
            light: '#8AA4AC',
          },
          teal: {
            DEFAULT: '#2B7A8E',
            dark: '#1B4D5C',
            light: '#3692A6',
            glow: '#4DA6B8',
          },
          gold: {
            DEFAULT: '#D4A037',
            dark: '#A37B24',
            light: '#E5B84B',
            glow: '#F3D37B',
          },
        },
      },
    },
  },
  plugins: [],
};