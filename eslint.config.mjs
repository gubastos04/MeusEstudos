import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FlatCompat } from '@eslint/eslintrc'

/**
 * Configuracao do ESLint.
 *
 * O ESLint 9 usa flat config, e o eslint-config-next ainda publica no formato
 * antigo (eslintrc). FlatCompat e a ponte oficial entre os dois — por isso ela
 * aparece aqui em vez de um `extends` direto.
 *
 * As regras adicionais abaixo existem para proteger decisoes do produto que
 * nao dao erro de compilacao, e que em review passariam batidas.
 */

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) })

const configuracao = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'prisma/**/*.db'],
  },

  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // Variavel nao usada e ruido; o prefixo _ marca a intencao de descartar.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // `any` apaga a checagem justamente onde ela protegeria mais.
      '@typescript-eslint/no-explicit-any': 'error',

      // Regra de produto: nenhum texto de conteudo ou resposta de IA vira HTML.
      // Ver CLAUDE.md > Convencoes.
      'react/no-danger': 'error',
    },
  },

  {
    // Os testes chamam route handlers direto e montam objetos parciais de
    // propósito; exigir os tipos completos ali atrapalharia sem ganho.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    // O service worker roda fora do bundle: sem JSX, sem imports do projeto.
    files: ['public/sw.js'],
    languageOptions: {
      globals: { self: 'readonly', caches: 'readonly', clients: 'readonly', Response: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]

export default configuracao
