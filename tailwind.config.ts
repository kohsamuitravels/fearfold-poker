import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a3a2a',
          dark: '#0f2318',
          light: '#2a5040',
        },
        gold: {
          DEFAULT: '#c9a84c',
          light: '#e8c97a',
          dark: '#a07830',
        },
        chip: {
          red: '#e53e3e',
          blue: '#3182ce',
          green: '#38a169',
          black: '#1a202c',
          white: '#f7fafc',
        }
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'card-deal': 'cardDeal 0.3s ease-out forwards',
        'chip-fly': 'chipFly 0.4s ease-in-out forwards',
        'pulse-turn': 'pulseTurn 1s ease-in-out infinite',
        'fold': 'fold 0.3s ease-in forwards',
      },
      keyframes: {
        cardDeal: {
          '0%': { transform: 'translateX(-100px) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'translateX(0) rotate(0deg)', opacity: '1' },
        },
        pulseTurn: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201, 168, 76, 0.7)' },
          '50%': { boxShadow: '0 0 0 12px rgba(201, 168, 76, 0)' },
        }
      }
    },
  },
  plugins: [],
}
export default config
