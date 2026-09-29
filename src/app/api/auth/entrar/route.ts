import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { emailSchema, loginUser } from '@/lib/auth'
import { clientKey, pruneRateLimits, rateLimit } from '@/lib/rate-limit'

const schema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe sua senha.'),
})

export const POST = handler({ schema, requireAuth: false }, async ({ request, body }) => {
  // Limite por IP e por email: dificulta forca bruta tanto distribuida por
  // conta quanto concentrada numa unica.
  const porIp = await rateLimit(clientKey(request, 'login-ip'), 10, 15 * 60)
  if (!porIp.allowed) {
    return fail(
      `Muitas tentativas. Tente de novo em ${Math.ceil(porIp.retryAfterSeconds / 60)} minuto(s).`,
      429,
    )
  }

  const porEmail = await rateLimit(`login-email:${body.email}`, 8, 15 * 60)
  if (!porEmail.allowed) {
    return fail(
      `Muitas tentativas para este email. Tente de novo em ${Math.ceil(porEmail.retryAfterSeconds / 60)} minuto(s).`,
      429,
    )
  }

  const resultado = await loginUser(
    { email: body.email, password: body.senha },
    request.headers.get('user-agent'),
  )

  if (!resultado.ok) {
    return fail(resultado.error, 401)
  }

  void pruneRateLimits()

  return ok({
    proximo: resultado.user.onboardedAt ? '/inicio' : '/comecar',
  })
})
