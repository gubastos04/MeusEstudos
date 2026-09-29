import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'

/**
 * Anotacao individual.
 *
 * Toda operacao usa `where: { id, userId }`. Assim um id valido de outra pessoa
 * nao altera nada: a consulta simplesmente nao encontra o registro.
 */

const schemaAtualizar = z.object({
  titulo: z.string().trim().min(3).max(140).optional(),
  corpo: z.string().max(20000).optional(),
  codigo: z.string().max(20000).optional(),
  linguagem: z.string().max(30).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  fixada: z.boolean().optional(),
})

export const PATCH = handler({ schema: schemaAtualizar }, async ({ user, body, params }) => {
  const id = params.id ?? ''

  const atualizado = await db.note.updateMany({
    where: { id, userId: user.id },
    data: {
      ...(body.titulo !== undefined ? { title: body.titulo } : {}),
      ...(body.corpo !== undefined ? { body: body.corpo } : {}),
      ...(body.codigo !== undefined ? { code: body.codigo } : {}),
      ...(body.linguagem !== undefined ? { language: body.linguagem } : {}),
      ...(body.tags !== undefined ? { tags: toJson(body.tags) } : {}),
      ...(body.fixada !== undefined ? { pinned: body.fixada } : {}),
    },
  })

  if (atualizado.count === 0) {
    return fail('Anotação não encontrada.', 404)
  }

  return ok({ id })
})

export const DELETE = handler({}, async ({ user, params }) => {
  const id = params.id ?? ''

  const removido = await db.note.deleteMany({ where: { id, userId: user.id } })

  if (removido.count === 0) {
    return fail('Anotação não encontrada.', 404)
  }

  return ok({ id })
})
