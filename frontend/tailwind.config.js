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
      fontFamily: {
        'display': ['Playfair Display', 'serif'],
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
	  fontWeight: {
		'normal': '400',
	  },
    },
  },
  plugins: [
    function({ addBase }) {
      addBase({
        // Firefox (standard CSS)
        '*': {
          'scrollbar-width': 'thin',
          'scrollbar-color': '#06492D #1a1a1a',
        },
        // Chrome, Edge, Safari (webkit)
        '::-webkit-scrollbar': {
          width: '8px',
        },
        '::-webkit-scrollbar-track': {
          backgroundColor: '#1a1a1a',
        },
        '::-webkit-scrollbar-thumb': {
          backgroundColor: '#06492D',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          backgroundColor: '#BB5522',
        },
      })
    }
  ],
}
