import { fail, handler, ok } from '@/lib/api'
import { db } from '@/lib/db'

/**
 * Healthcheck: a aplicacao alcanca o banco?
 *
 * Existe porque em 07/10/2026 a senha do banco foi rotacionada e a
 * `DATABASE_URL` da Vercel ficou com a antiga. O build passou limpo, o deploy
 * subiu, as telas publicas responderam normalmente — e producao ficou dois
 * dias sem conseguir uma unica consulta, porque nada que roda antes do deploy
 * exercita a credencial. `db:conferir` compara dialeto, nao senha.
 *
 * Devolve so `{ ok: true }`: quem chama esta perguntando se o sistema responde,
 * nao quanto conteudo existe. Numero de aulas num endpoint publico seria dado
 * de graca para quem nao entrou.
 */

// Sem isto a rota pode ser pre-renderizada no build: ela nao le cookie nem
// cabecalho, entao nada a obriga a ser dinamica. Um healthcheck respondido a
// partir do build diria "ok" para sempre, inclusive com o banco fora — pior
// que nao existir, porque da falsa confianca.
export const dynamic = 'force-dynamic'

export const GET = handler({ requireAuth: false }, async () => {
  try {
    // Consulta minima: o que esta sendo verificado e a conexao, nao o schema.
    await db.$queryRaw`SELECT 1`
    return ok({})
  } catch (erro) {
    // O log e metade do motivo desta rota existir: sem ele, "producao quebrada"
    // chega como um digest opaco e a investigacao comeca do zero.
    console.error('[saude] banco inacessivel', erro)
    // 503 e nao 500: o servico esta indisponivel, e e isso que quem monitora
    // precisa distinguir de um erro de programacao.
    return fail('Banco de dados inacessivel.', 503)
  }
})
