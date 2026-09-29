import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Cria o banco de teste antes da suite.
 *
 * Roda uma vez, num processo separado dos testes. O arquivo e recriado do zero
 * a cada execucao para que nenhum teste dependa de sobra da execucao anterior.
 */

const CAMINHO_BANCO = join(process.cwd(), 'prisma', 'test-vitest.db')
const URL_BANCO = 'file:./test-vitest.db'

export default function setup() {
  for (const arquivo of [CAMINHO_BANCO, `${CAMINHO_BANCO}-journal`]) {
    if (existsSync(arquivo)) rmSync(arquivo)
  }

  const ambiente = { ...process.env, DATABASE_URL: URL_BANCO }
  const opcoes = { env: ambiente, stdio: 'pipe' as const, shell: process.platform === 'win32' }

  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], opcoes)

  // O espelho de /content precisa existir: tentativa de avaliação, resposta,
  // submissão de demanda e progresso de projeto têm chave estrangeira para ele.
  execFileSync('npx', ['tsx', 'scripts/sync-content.ts'], opcoes)
}
