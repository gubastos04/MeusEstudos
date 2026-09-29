import { handler, ok } from '@/lib/api'
import { destroySession } from '@/lib/session'

export const POST = handler({ requireAuth: false }, async () => {
  await destroySession()
  return ok({ proximo: '/entrar' })
})
