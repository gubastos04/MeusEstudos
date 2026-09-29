import { z } from 'zod'

import { handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'
import { bumpActivity, logEvent } from '@/lib/progress'

/**
 * Anotacoes privadas.
 *
 * Isolamento: toda consulta filtra por userId da sessao. Nenhuma rota aceita
 * userId do cliente, e a listagem nunca alcanca anotacao de outra pessoa.
 */

const schemaCriar = z.object({
  titulo: z.string().trim().min(3, 'Dê um título de pelo menos 3 caracteres.').max(140),
  corpo: z.string().max(20000).default(''),
  codigo: z.string().max(20000).default(''),
  linguagem: z.string().max(30).default('text'),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  moduloId: z.string().max(80).optional(),
  nodeType: z.string().max(40).optional(),
  nodeId: z.string().max(80).optional(),
})

export const POST = handler({ schema: schemaCriar }, async ({ user, body }) => {
  const anotacao = await db.note.create({
    data: {
      userId: user.id,
      title: body.titulo,
      body: body.corpo,
      code: body.codigo,
      language: body.linguagem,
      tags: toJson(body.tags),
      moduleId: body.moduloId ?? null,
      nodeType: body.nodeType ?? null,
      nodeId: body.nodeId ?? null,
    },
  })

  await bumpActivity(user.id, { notesWritten: 1 })
  await logEvent({ userId: user.id, type: 'note_written', nodeType: body.nodeType, nodeId: body.nodeId })

  return ok({ id: anotacao.id }, 201)
})

export const GET = handler({}, async ({ request, user }) => {
  const url = new URL(request.url)
  const busca = url.searchParams.get('busca')?.trim() ?? ''

  const anotacoes = await db.note.findMany({
    where: {
      userId: user.id,
      ...(busca
        ? {
            OR: [{ title: { contains: busca } }, { body: { contains: busca } }, { code: { contains: busca } }],
          }
        : {}),
    },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  })

  return ok({
    anotacoes: anotacoes.map((anotacao) => ({
      id: anotacao.id,
      titulo: anotacao.title,
      corpo: anotacao.body,
      fixada: anotacao.pinned,
      atualizadaEm: anotacao.updatedAt,
    })),
  })
})
