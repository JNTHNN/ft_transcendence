/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mainColor: '#06492D',
        secondColorColor: '#BB5522',
        text: '#FFFFFF',
      },
    },
  },
  plugins: [],
}
