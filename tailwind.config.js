/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nesty: {
          burgundy: '#701F2B',
          burgundyDark: '#52141E',
          burgundyLight: '#8E2B3A',
          burgundySurface: '#F5E4E6',
          cream: '#FAF3E8',
          creamSurface: '#FFFBF5',
          creamElevated: '#F3E8D6',
          creamBorder: '#E5D3B8',
          gold: '#D7A85B',
          goldDark: '#B38336',
          goldLight: '#F7EBD5',
          textPrimary: '#2B1317',
          textSecondary: '#66464B',
          success: '#1E6F43',
          successBg: '#E6F4EC',
          warning: '#B86B14',
          warningBg: '#FDF3E6',
          error: '#B91C1C',
          errorBg: '#FDECEC',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
