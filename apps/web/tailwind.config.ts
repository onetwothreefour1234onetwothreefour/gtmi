import type { Config } from 'tailwindcss';

const config: Config = {
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
        // Design's px-fixed editorial scale (matches docs/design/styles.css).
        'fs-display': ['72px', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'fs-h1': ['44px', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        'fs-h2': ['28px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'fs-h3': ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'fs-body': ['15px', { lineHeight: '1.5' }],
        'fs-small': ['13px', { lineHeight: '1.4' }],
        'fs-micro': ['11px', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      colors: {
        // Semantic tokens resolve to bare custom properties (the design's
        // flat hex palette in globals.css). No HSL indirection.
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
          5: 'var(--ink-5)',
        },
        paper: {
          DEFAULT: 'var(--paper)',
          2: 'var(--paper-2)',
          3: 'var(--paper-3)',
        },
        rule: {
          DEFAULT: 'var(--rule)',
          soft: 'var(--rule-soft)',
        },
        navy: {
          DEFAULT: 'var(--navy)',
          2: 'var(--navy-2)',
          soft: 'var(--navy-soft)',
        },
        positive: 'var(--positive)',
        warning: 'var(--warning)',
        negative: 'var(--negative)',

        // Shadcn/Radix compatibility aliases.
        surface: 'var(--surface)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          2: 'var(--accent-2)',
          soft: 'var(--accent-soft)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        precalib: {
          fg: 'var(--precalib-fg)',
          bg: 'var(--precalib-bg)',
        },
        // Sequential warm-orange ramp for the score bar. Kept from Phase 4 —
        // the design did not provide a 5-step sequential ramp and this
        // reads as part of the editorial palette.
        score: {
          1: '#FCEEC9',
          2: '#E8B17A',
          3: '#C46A4A',
          4: '#9C3F2A',
          5: '#7A2A1F',
        },
        // Pillars — design's warm-cool low-chroma spectrum.
        pillar: {
          a: 'var(--pillar-a)',
          b: 'var(--pillar-b)',
          c: 'var(--pillar-c)',
          d: 'var(--pillar-d)',
          e: 'var(--pillar-e)',
        },
      },
      borderRadius: {
        // Editorial design sits on hard corners. card/button keep their
        // radii names for back-compat with shadcn primitives.
        card: '0px',
        button: '0px',
        table: '0px',
        lg: '0px',
        md: '0px',
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
