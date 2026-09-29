import { handler, ok } from '@/lib/api'
import { getSuggestions, type TimeBudget } from '@/lib/next-step'

/**
 * Sugestoes para o tempo disponivel (modo "tenho X minutos").
 *
 * Devolve no maximo quatro opcoes: o objetivo e decidir rapido, nao escolher
 * entre tudo. A plataforma nao cobra cronograma; ela responde "o que consigo
 * fazer agora".
 */

const permitidos: TimeBudget[] = [10, 20, 45]

export const GET = handler({}, async ({ request, user }) => {
  const url = new URL(request.url)
  const bruto = Number(url.searchParams.get('minutos'))
  const minutos = (permitidos.includes(bruto as TimeBudget) ? bruto : 20) as TimeBudget

  const sugestoes = await getSuggestions(user.id, minutos)

  return ok({
    minutos,
    sugestoes: sugestoes.map((sugestao) => ({
      tipo: sugestao.kind,
      id: sugestao.id,
      titulo: sugestao.title,
      motivo: sugestao.reason,
      href: sugestao.href,
      minutos: sugestao.minutes,
      acao: sugestao.action,
      modulo: sugestao.moduleTitle ?? null,
    })),
  })
})
