import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Testes.
 *
 * Ambiente padrao: node. Os testes de componente declaram jsdom no proprio
 * arquivo, com `@vitest-environment jsdom` no topo — assim a suite de regras,
 * que e a maior parte, nao paga o custo de montar um DOM.
 *
 * O banco de teste e criado uma vez em tests/global-setup.ts e fica em
 * prisma/test-vitest.db, fora do Git.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // scrypt e a criacao do banco levam alguns segundos na primeira execucao.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Arquivos compartilham o mesmo banco SQLite: em paralelo, um apagaria o
    // dado do outro no meio do teste.
    fileParallelism: false,
  },
})
