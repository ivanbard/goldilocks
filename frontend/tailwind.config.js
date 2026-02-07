/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'vent-green': '#22c55e',
        'vent-blue': '#3b82f6',
        'vent-orange': '#f97316',
        'vent-gray': '#6b7280',
        'risk-low': '#22c55e',
        'risk-medium': '#eab308',
        'risk-high': '#ef4444',
      },
    },
  },
  plugins: [],
};
