import { z } from 'zod'

import { handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'
import { bumpActivity, logEvent } from '@/lib/progress'

/**
 * Meus erros.
 *
 * A area existe para o erro virar aprendizado registrado, e depois voltar na
 * revisao. Nada aqui e publico e nada e comparado com outras pessoas.
 */

const schemaCriar = z.object({
  titulo: z.string().trim().min(3, 'Descreva o erro em pelo menos 3 caracteres.').max(200),
  contexto: z.string().max(4000).default(''),
  causa: z.string().max(4000).default(''),
  solucao: z.string().max(4000).default(''),
  aprendizado: z.string().max(4000).default(''),
  codigo: z.string().max(20000).default(''),
  linguagem: z.string().max(30).default('text'),
  tecnologia: z.string().max(60).default(''),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  resolvido: z.boolean().default(false),
  moduloId: z.string().max(80).optional(),
  nodeType: z.string().max(40).optional(),
  nodeId: z.string().max(80).optional(),
})

export const POST = handler({ schema: schemaCriar }, async ({ user, body }) => {
  const registro = await db.errorRecord.create({
    data: {
      userId: user.id,
      title: body.titulo,
      context: body.contexto,
      cause: body.causa,
      solution: body.solucao,
      learning: body.aprendizado,
      code: body.codigo,
      language: body.linguagem,
      technology: body.tecnologia,
      tags: toJson(body.tags),
      resolved: body.resolvido || body.solucao.trim().length > 0,
      moduleId: body.moduloId ?? null,
      nodeType: body.nodeType ?? null,
      nodeId: body.nodeId ?? null,
    },
  })

  await bumpActivity(user.id, { errorsLogged: 1 })
  await logEvent({ userId: user.id, type: 'error_logged', nodeType: body.nodeType, nodeId: body.nodeId })

  return ok({ id: registro.id }, 201)
})

export const GET = handler({}, async ({ request, user }) => {
  const url = new URL(request.url)
  const busca = url.searchParams.get('busca')?.trim() ?? ''

  const registros = await db.errorRecord.findMany({
    where: {
      userId: user.id,
      ...(busca
        ? {
            OR: [
              { title: { contains: busca } },
              { cause: { contains: busca } },
              { solution: { contains: busca } },
              { technology: { contains: busca } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return ok({
    erros: registros.map((registro) => ({
      id: registro.id,
      titulo: registro.title,
      resolvido: registro.resolved,
      tecnologia: registro.technology,
      criadoEm: registro.createdAt,
      revisadoEm: registro.reviewedAt,
    })),
  })
})
