/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        notion: {
          bg: '#ffffff',
          surface: '#f7f6f3',
          hover: '#f1f1ef',
          border: '#e9e9e7',
          border2: '#d9d8d5',
          text: '#37352f',
          sub: '#6b6b6a',
          muted: '#9b9a97',
          placeholder: '#c7c6c3',
        }
      },
      fontSize: { xs: ['11px', '16px'], sm: ['13px', '20px'], base: ['14px', '22px'] }
    }
  },
  plugins: []
}
