import type { Config } from 'tailwindcss';
// @ts-ignore
import forms from '@tailwindcss/forms';

export default {
  content: [
    './index.html',
    './src/**/*.{html,ts}',
    // if you consume libs/components from packages/, include them too:
    '../../packages/**/*.{html,ts}',
  ],
  theme: {
    extend: {
      colors: {
        board:  { bg: '#0f6ad4' },
        list:   { bg: '#f1f2f4' },
        card:   { bg: '#ffffff' },
        ink:    { base: '#172b4d', sub: '#44546F' },
        accent: { blue: '#579DFF', green: '#4BCE97', red: '#F87171', yellow: '#F9AB00' }
      },
      boxShadow: {
        card: '0 1px 0 rgba(9,30,66,.25)'
      },
      borderRadius: { xl2: '1rem' }
    },
  },
  plugins: [forms],
} satisfies Config;
