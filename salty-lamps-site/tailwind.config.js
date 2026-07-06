export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ericka': '#b86040',
        'ericka-dark': '#8f4a2e',
        'ericka-light': '#d4956b',
      },
      fontFamily: {
        'oswald': ['Oswald', 'sans-serif'],
        'pt-sans': ['"PT Sans"', 'Arial', 'sans-serif'],
      }
    }
  },
  plugins: []
}
