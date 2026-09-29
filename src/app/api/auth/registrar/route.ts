import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { emailSchema, nameSchema, passwordSchema, registerUser } from '@/lib/auth'
import { clientKey, rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  nome: nameSchema,
  email: emailSchema,
  senha: passwordSchema,
})

export const POST = handler({ schema, requireAuth: false }, async ({ request, body }) => {
  const limite = await rateLimit(clientKey(request, 'cadastro-ip'), 5, 60 * 60)
  if (!limite.allowed) {
    return fail('Muitas contas criadas a partir deste acesso. Tente mais tarde.', 429)
  }

  const resultado = await registerUser(
    { name: body.nome, email: body.email, password: body.senha },
    request.headers.get('user-agent'),
  )

  if (!resultado.ok) {
    // Email ja existente e erro de campo: a tela destaca o campo certo.
    const campo = resultado.error.includes('email') ? 'email' : undefined
    return fail(resultado.error, 409, campo ? { campo } : undefined)
  }

  // Conta nova sempre passa pelo inicio rapido antes do painel.
  return ok({ proximo: '/comecar' }, 201)
})
