import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { verifyPassword } from '@/lib/crypto'
import { db } from '@/lib/db'
import { destroySession } from '@/lib/session'

/**
 * Exclusao de conta.
 *
 * Remove tudo de uma vez: todas as tabelas de dado de usuario tem
 * onDelete: Cascade apontando para User. Exige a senha atual, porque e
 * irreversivel.
 */

const schema = z.object({
  senha: z.string().min(1, 'Informe sua senha para confirmar.'),
  confirmacao: z.literal('EXCLUIR', {
    errorMap: () => ({ message: 'Digite EXCLUIR para confirmar.' }),
  }),
})

export const POST = handler({ schema }, async ({ user, body }) => {
  const registro = await db.user.findUnique({ where: { id: user.id } })
  if (!registro) return fail('Conta não encontrada.', 404)

  const confere = await verifyPassword(body.senha, registro.passwordHash)
  if (!confere) {
    return fail('Senha incorreta.', 403, { campo: 'senha' })
  }

  await db.user.delete({ where: { id: user.id } })
  await destroySession()

  return ok({ excluida: true, proximo: '/entrar' })
})
