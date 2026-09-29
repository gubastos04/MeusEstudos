import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { passwordSchema } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { redefinirSenha } from '@/lib/redefinicao-senha'

/**
 * Troca a senha a partir do link recebido por email.
 *
 * O token e de uso unico e, ao ser consumido, todas as sessoes da conta sao
 * encerradas. Quem redefine a senha entra de novo com a senha nova.
 */

const schema = z.object({
  token: z.string().min(10).max(200),
  senha: passwordSchema,
})

export const POST = handler({ schema, requireAuth: false }, async ({ request, body }) => {
  // Limite por IP: impede varrer tokens por tentativa e erro.
  const limite = await rateLimit(clientKey(request, 'redefinir-ip'), 15, 60 * 60)
  if (!limite.allowed) {
    return fail('Muitas tentativas. Tente de novo mais tarde.', 429)
  }

  const resultado = await redefinirSenha(body.token, body.senha)

  if (!resultado.ok) {
    return fail(resultado.erro, 400, { campo: 'token' })
  }

  return ok({
    mensagem: 'Senha alterada. As sessões abertas foram encerradas — entre com a senha nova.',
    proximo: '/entrar',
  })
})
