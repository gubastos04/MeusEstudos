import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { getDemandForUser } from '@/lib/demands'
import { toJson } from '@/lib/json'
import { bumpActivity, completeProgress, logEvent, startProgress } from '@/lib/progress'

/**
 * Trabalho sobre uma demanda.
 *
 * A demanda pode vir do curriculo (/content) ou ter sido gerada por IA para
 * este usuario. `getDemandForUser` resolve os dois casos e nunca devolve
 * demanda gerada de outra pessoa.
 *
 * Os critérios de aceite sao marcados pela propria pessoa. Isso e intencional:
 * o objetivo e treinar honestidade tecnica, nao passar por um validador.
 */

const schema = z.object({
  acao: z.enum(['iniciar', 'salvar', 'concluir', 'abandonar']),
  status: z.enum(['analisando', 'implementando', 'revisando']).optional(),
  entendimento: z.string().max(8000).optional(),
  plano: z.string().max(8000).optional(),
  solucao: z.string().max(20000).optional(),
  notasDeTeste: z.string().max(8000).optional(),
  repositorio: z.string().max(300).optional(),
  branch: z.string().max(120).optional(),
  tituloPr: z.string().max(200).optional(),
  corpoPr: z.string().max(8000).optional(),
  aceite: z.array(z.boolean()).max(20).optional(),
  autoRevisao: z.string().max(8000).optional(),
})

export const POST = handler({ schema }, async ({ user, body, params }) => {
  const demandaId = params.id ?? ''
  const demanda = await getDemandForUser(user.id, demandaId)

  if (!demanda) {
    return fail('Demanda não encontrada.', 404)
  }

  const dados = {
    ...(body.entendimento !== undefined ? { understanding: body.entendimento } : {}),
    ...(body.plano !== undefined ? { plan: body.plano } : {}),
    ...(body.solucao !== undefined ? { solution: body.solucao } : {}),
    ...(body.notasDeTeste !== undefined ? { testNotes: body.notasDeTeste } : {}),
    ...(body.repositorio !== undefined ? { repoUrl: body.repositorio || null } : {}),
    ...(body.branch !== undefined ? { branchName: body.branch || null } : {}),
    ...(body.tituloPr !== undefined ? { prTitle: body.tituloPr || null } : {}),
    ...(body.corpoPr !== undefined ? { prBody: body.corpoPr || null } : {}),
    ...(body.aceite !== undefined ? { acceptance: toJson(body.aceite) } : {}),
    ...(body.autoRevisao !== undefined ? { selfReview: body.autoRevisao } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  }

  if (body.acao === 'iniciar') {
    const submissao = await db.demandSubmission.upsert({
      where: { userId_demandId: { userId: user.id, demandId: demanda.id } },
      create: { userId: user.id, demandId: demanda.id, status: 'analisando', ...dados },
      update: dados,
    })

    await startProgress({ userId: user.id, nodeType: 'demand', nodeId: demanda.id })
    await bumpActivity(user.id, { demandsWorked: 1 })
    await logEvent({ userId: user.id, type: 'demand_started', nodeType: 'demand', nodeId: demanda.id })

    return ok({ status: submissao.status })
  }

  const existente = await db.demandSubmission.findUnique({
    where: { userId_demandId: { userId: user.id, demandId: demanda.id } },
  })

  if (!existente) {
    return fail('Comece a demanda antes de salvar.', 409)
  }

  if (body.acao === 'salvar') {
    const submissao = await db.demandSubmission.update({
      where: { id: existente.id },
      data: dados,
    })
    return ok({ status: submissao.status })
  }

  if (body.acao === 'abandonar') {
    // Parar e um estado legitimo e reversivel. Nada e apagado.
    await db.demandSubmission.update({
      where: { id: existente.id },
      data: { ...dados, status: 'abandonada' },
    })
    return ok({ status: 'abandonada' })
  }

  // Concluir.
  const submissao = await db.demandSubmission.update({
    where: { id: existente.id },
    data: { ...dados, status: 'concluida', completedAt: existente.completedAt ?? new Date() },
  })

  await completeProgress({ userId: user.id, nodeType: 'demand', nodeId: demanda.id })
  await logEvent({ userId: user.id, type: 'demand_completed', nodeType: 'demand', nodeId: demanda.id })

  return ok({ status: submissao.status })
})
