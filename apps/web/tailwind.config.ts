import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1440px',
      },
    },
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Editorial scale. Display sizes use the serif stack.
        'display-xl': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        dek: ['1.125rem', { lineHeight: '1.55', letterSpacing: '0' }],
        body: ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],
        'data-lg': ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'data-md': ['0.875rem', { lineHeight: '1.25', letterSpacing: '0' }],
        'data-sm': ['0.75rem', { lineHeight: '1.3', letterSpacing: '0' }],
      },
      colors: {
        ink: 'hsl(var(--ink))',
        paper: 'hsl(var(--paper))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        precalib: {
          fg: 'hsl(var(--precalib-fg))',
          bg: 'hsl(var(--precalib-bg))',
        },
        score: {
          1: '#FCEEC9',
          2: '#E8B17A',
          3: '#C46A4A',
          4: '#9C3F2A',
          5: '#7A2A1F',
        },
        pillar: {
          a: '#3D5A80',
          b: '#98C1D9',
          c: '#5C8A9B',
          d: '#EE6C4D',
          e: '#293241',
        },
      },
      borderRadius: {
        card: '4px',
        button: '2px',
        table: '0px',
        lg: '4px',
        md: '2px',
        sm: '2px',
      },
      maxWidth: {
        prose: '65ch',
        editorial: '720px',
        page: '1280px',
        'page-wide': '1440px',
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
      },
    },
  },
  plugins: [],
};

export default config;
