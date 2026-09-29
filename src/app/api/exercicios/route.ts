import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { findExercise } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { toJson } from '@/lib/json'
import { bumpActivity, logEvent } from '@/lib/progress'

/**
 * Registro de tentativa de exercicio.
 *
 * Os testes rodam no navegador (em Worker isolado) e o resultado e enviado para
 * ca. Isso e assumido de forma explicita: exercicio serve para aprender, e o
 * historico e do proprio usuario. Avaliacao de alternativa, onde faz diferenca,
 * e corrigida no servidor (ver /api/avaliacoes).
 *
 * O servidor confere que o exercicio existe no conteudo e reexecuta as
 * verificacoes estruturais, que sao deterministicas e nao dependem de runtime.
 */

const schema = z.object({
  exercicioId: z.string().min(1).max(80),
  aulaId: z.string().max(80).optional(),
  moduloId: z.string().max(80).optional(),
  codigo: z.string().max(20000).default(''),
  linguagem: z.string().max(30).default('text'),
  passou: z.boolean(),
  totalCasos: z.number().int().min(0).max(100),
  casosPassaram: z.number().int().min(0).max(100),
  relatorio: z.unknown().optional(),
  dicasUsadas: z.number().int().min(0).max(10).default(0),
  solucaoVista: z.boolean().default(false),
})

export const POST = handler({ schema }, async ({ user, body }) => {
  const encontrado = findExercise(body.exercicioId)
  if (!encontrado) {
    return fail('Exercício não encontrado.', 404)
  }

  const { exercise, lessonId, moduleId } = encontrado

  const tentativa = await db.exerciseAttempt.create({
    data: {
      userId: user.id,
      exerciseId: exercise.id,
      lessonId,
      code: body.codigo.slice(0, 20000),
      language: exercise.language,
      passed: body.passou,
      totalCases: body.totalCasos,
      passedCases: body.casosPassaram,
      report: toJson(body.relatorio ?? []),
      hintsUsed: body.dicasUsadas,
      solutionSeen: body.solucaoVista,
    },
  })

  await bumpActivity(user.id, { exercisesAttempted: 1 })
  await logEvent({
    userId: user.id,
    type: 'exercise_attempted',
    nodeType: 'exercise',
    nodeId: exercise.id,
    meta: { passou: body.passou, moduleId },
  })

  return ok({ tentativaId: tentativa.id }, 201)
})

/** Ultima tentativa de cada exercicio, usada para reabrir o editor como estava. */
export const GET = handler({}, async ({ request, user }) => {
  const url = new URL(request.url)
  const exercicioId = url.searchParams.get('exercicio')

  if (!exercicioId) {
    return fail('Informe o exercício.', 422, { campo: 'exercicio' })
  }

  const tentativa = await db.exerciseAttempt.findFirst({
    where: { userId: user.id, exerciseId: exercicioId },
    orderBy: { createdAt: 'desc' },
  })

  return ok({
    tentativa: tentativa
      ? {
          codigo: tentativa.code,
          passou: tentativa.passed,
          casosPassaram: tentativa.passedCases,
          totalCasos: tentativa.totalCases,
          criadoEm: tentativa.createdAt,
        }
      : null,
  })
})
