import { fail, handler, ok } from '@/lib/api'
import { aiRequestSchema, runAi } from '@/lib/ai'
import { getAiStatus } from '@/lib/ai/limits'
import { clientKey, rateLimit } from '@/lib/rate-limit'

/**
 * Unica porta de entrada da IA.
 *
 * A chave da Anthropic e usada somente aqui, no servidor. Ela nunca aparece em
 * resposta, em HTML, em cookie nem em variavel publica.
 *
 * Alem do limite diario por usuario, ha um limite curto por minuto: protege
 * contra um laco acidental no cliente gerando dezenas de chamadas.
 */

export const POST = handler({ schema: aiRequestSchema }, async ({ request, user, body }) => {
  const porMinuto = await rateLimit(`ia:${user.id}`, 6, 60)
  if (!porMinuto.allowed) {
    return fail(
      `Muitas chamadas seguidas. Tente de novo em ${porMinuto.retryAfterSeconds} segundo(s).`,
      429,
    )
  }

  const porIp = await rateLimit(clientKey(request, 'ia-ip'), 40, 60 * 60)
  if (!porIp.allowed) {
    return fail('Limite de uso da IA atingido para este acesso.', 429)
  }

  const resultado = await runAi(user.id, body)

  if (!resultado.ok) {
    return fail(resultado.erro, resultado.status)
  }

  return ok({
    texto: resultado.text,
    restantes: resultado.remaining,
    demandaId: resultado.demandId,
    geradaPorIa: resultado.generated,
    uso: resultado.usage,
  })
})

/** Estado da IA para a interface. Nunca devolve a chave, apenas a dica final. */
export const GET = handler({}, async ({ user }) => {
  const status = await getAiStatus(user.id)

  return ok({
    configurada: status.configured,
    habilitada: status.enabled,
    origem: status.source,
    modelo: status.model,
    limiteDiario: status.dailyLimit,
    usadasHoje: status.usedToday,
    restantes: status.remaining,
    dicaChave: status.keyHint,
    mensagem: status.message,
  })
})
