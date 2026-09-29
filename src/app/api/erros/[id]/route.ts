import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'

const schemaAtualizar = z.object({
  titulo: z.string().trim().min(3).max(200).optional(),
  contexto: z.string().max(4000).optional(),
  causa: z.string().max(4000).optional(),
  solucao: z.string().max(4000).optional(),
  aprendizado: z.string().max(4000).optional(),
  codigo: z.string().max(20000).optional(),
  linguagem: z.string().max(30).optional(),
  tecnologia: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  resolvido: z.boolean().optional(),
  /** Marca que o erro foi revisitado agora. Base do sistema de revisao. */
  revisado: z.boolean().optional(),
})

export const PATCH = handler({ schema: schemaAtualizar }, async ({ user, body, params }) => {
  const id = params.id ?? ''

  const atual = await db.errorRecord.findFirst({ where: { id, userId: user.id } })
  if (!atual) {
    return fail('Registro não encontrado.', 404)
  }

  await db.errorRecord.update({
    where: { id: atual.id },
    data: {
      ...(body.titulo !== undefined ? { title: body.titulo } : {}),
      ...(body.contexto !== undefined ? { context: body.contexto } : {}),
      ...(body.causa !== undefined ? { cause: body.causa } : {}),
      ...(body.solucao !== undefined ? { solution: body.solucao } : {}),
      ...(body.aprendizado !== undefined ? { learning: body.aprendizado } : {}),
      ...(body.codigo !== undefined ? { code: body.codigo } : {}),
      ...(body.linguagem !== undefined ? { language: body.linguagem } : {}),
      ...(body.tecnologia !== undefined ? { technology: body.tecnologia } : {}),
      ...(body.tags !== undefined ? { tags: toJson(body.tags) } : {}),
      ...(body.resolvido !== undefined ? { resolved: body.resolvido } : {}),
      ...(body.revisado
        ? { reviewedAt: new Date(), reviewCount: { increment: 1 } }
        : {}),
    },
  })

  return ok({ id })
})

export const DELETE = handler({}, async ({ user, params }) => {
  const id = params.id ?? ''

  const removido = await db.errorRecord.deleteMany({ where: { id, userId: user.id } })
  if (removido.count === 0) {
    return fail('Registro não encontrado.', 404)
  }

  return ok({ id })
})
