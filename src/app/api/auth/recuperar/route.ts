import { z } from 'zod'

import { handler, ok } from '@/lib/api'
import { emailSchema } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { MENSAGEM_PEDIDO, pedirRedefinicao } from '@/lib/redefinicao-senha'

/**
 * Pedido de redefinicao de senha.
 *
 * A resposta e SEMPRE a mesma, inclusive quando o limite e atingido e quando a
 * conta nao existe. Qualquer diferenca — de texto, de status ou de tempo —
 * transformaria esta rota num verificador de quais emails tem cadastro.
 */

const schema = z.object({ email: emailSchema })

export const POST = handler({ schema, requireAuth: false }, async ({ request, body }) => {
  const porIp = await rateLimit(clientKey(request, 'recuperar-ip'), 10, 60 * 60)
  const porEmail = await rateLimit(`recuperar-email:${body.email}`, 3, 60 * 60)

  if (!porIp.allowed || !porEmail.allowed) {
    // Nada de 429 aqui: o status já diria que aquele email recebeu pedidos.
    return ok({ mensagem: MENSAGEM_PEDIDO })
  }

  const resultado = await pedirRedefinicao(body.email)

  if (resultado.detalhe === 'sem-transporte' || resultado.detalhe === 'falha-no-envio') {
    // Quem administra precisa saber; quem pediu recebe a mesma mensagem.
    console.error(`[recuperar] pedido não entregue: ${resultado.detalhe}`)
  }

  return ok({ mensagem: MENSAGEM_PEDIDO })
})
