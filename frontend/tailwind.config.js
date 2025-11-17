/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        prem: '#06492D',
        sec: '#BB5522',
        text: '#FFFFFF'
      },
    },
  },
  plugins: [],
}
