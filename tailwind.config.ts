import type { Config } from 'tailwindcss'

/**
 * Design system proprio.
 * Regras:
 * - poucas cores;
 * - contraste alto;
 * - vermelho (danger) somente para erro real / risco / falha de validacao;
 * - nada de estetica gamificada (sem gradientes decorativos, sem cores de recompensa).
 * Os valores concretos ficam em src/app/globals.css como CSS variables,
 * para permitir tema claro e escuro sem duplicar classes.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
          code: 'rgb(var(--surface-code) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
          inverse: 'rgb(var(--ink-inverse) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
        },
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          soft: 'rgb(var(--ok-soft) / <alpha-value>)',
          ink: 'rgb(var(--ok-ink) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          soft: 'rgb(var(--warn-soft) / <alpha-value>)',
          ink: 'rgb(var(--warn-ink) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          ink: 'rgb(var(--danger-ink) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        // Escala confortavel para leitura longa no celular.
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.9375rem', { lineHeight: '1.6rem' }],
        lg: ['1.0625rem', { lineHeight: '1.65rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        lg: '0.5rem',
      },
      maxWidth: {
        reading: '68ch',
      },
      transitionDuration: {
        DEFAULT: '120ms',
      },
    },
  },
  plugins: [],
}

export default config
