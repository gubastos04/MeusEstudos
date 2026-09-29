import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { getProject } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { parseRecord, parseStringArray, toJson } from '@/lib/json'
import { completeProgress, logEvent, startProgress } from '@/lib/progress'

/**
 * Progresso de um projeto evolutivo.
 *
 * O projeto avanca por etapas e nao e concluido numa sessao. O que a plataforma
 * guarda: etapas concluidas, checklist de publicacao e os campos de portfolio
 * escritos pela pessoa.
 *
 * Nada e inventado aqui: problema, decisoes, dificuldades e aprendizados sao
 * texto do usuario. A plataforma nao gera metrica de resultado.
 */

const schema = z.object({
  acao: z.enum(['iniciar', 'salvar', 'concluir-etapa', 'reabrir-etapa', 'publicar', 'despublicar']),
  etapaId: z.string().max(80).optional(),
  etapaAtual: z.number().int().min(1).max(30).optional(),
  checklist: z.record(z.string().max(200), z.boolean()).optional(),
  repositorio: z.string().max(300).optional(),
  deploy: z.string().max(300).optional(),
  notas: z.string().max(20000).optional(),
  problema: z.string().max(8000).optional(),
  decisoes: z.string().max(8000).optional(),
  dificuldades: z.string().max(8000).optional(),
  aprendizados: z.string().max(8000).optional(),
})

export const POST = handler({ schema }, async ({ user, body, params }) => {
  const projetoId = params.id ?? ''
  const projeto = getProject(projetoId)

  if (!projeto) {
    return fail('Projeto não encontrado.', 404)
  }

  const dados = {
    ...(body.etapaAtual !== undefined ? { currentStep: body.etapaAtual } : {}),
    ...(body.checklist !== undefined ? { checklist: toJson(body.checklist) } : {}),
    ...(body.repositorio !== undefined ? { repoUrl: body.repositorio || null } : {}),
    ...(body.deploy !== undefined ? { deployUrl: body.deploy || null } : {}),
    ...(body.notas !== undefined ? { notes: body.notas } : {}),
    ...(body.problema !== undefined ? { problem: body.problema } : {}),
    ...(body.decisoes !== undefined ? { decisions: body.decisoes } : {}),
    ...(body.dificuldades !== undefined ? { difficulties: body.dificuldades } : {}),
    ...(body.aprendizados !== undefined ? { learnings: body.aprendizados } : {}),
  }

  if (body.acao === 'iniciar') {
    const progresso = await db.projectProgress.upsert({
      where: { userId_projectId: { userId: user.id, projectId: projeto.id } },
      create: { userId: user.id, projectId: projeto.id, currentStep: 1, ...dados },
      update: dados,
    })

    await startProgress({ userId: user.id, nodeType: 'project', nodeId: projeto.id })

    return ok({ etapaAtual: progresso.currentStep })
  }

  const existente = await db.projectProgress.findUnique({
    where: { userId_projectId: { userId: user.id, projectId: projeto.id } },
  })

  if (!existente) {
    return fail('Comece o projeto antes de salvar.', 409)
  }

  if (body.acao === 'salvar') {
    await db.projectProgress.update({ where: { id: existente.id }, data: dados })
    return ok({ etapaAtual: existente.currentStep })
  }

  if (body.acao === 'concluir-etapa' || body.acao === 'reabrir-etapa') {
    if (!body.etapaId) {
      return fail('Informe a etapa.', 422, { campo: 'etapaId' })
    }

    const etapa = projeto.steps.find((item) => item.id === body.etapaId)
    if (!etapa) {
      return fail('Etapa não encontrada neste projeto.', 404)
    }

    const concluidas = new Set(parseStringArray(existente.doneSteps))

    if (body.acao === 'concluir-etapa') {
      concluidas.add(etapa.id)
      await completeProgress({
        userId: user.id,
        nodeType: 'project-step',
        nodeId: `${projeto.id}::${etapa.id}`,
      })
    } else {
      concluidas.delete(etapa.id)
    }

    // A etapa atual e a primeira ainda nao concluida.
    const proxima = projeto.steps.find((item) => !concluidas.has(item.id))

    await db.projectProgress.update({
      where: { id: existente.id },
      data: {
        ...dados,
        doneSteps: toJson([...concluidas]),
        currentStep: proxima?.order ?? projeto.steps.length,
      },
    })

    return ok({ concluidas: [...concluidas], etapaAtual: proxima?.order ?? projeto.steps.length })
  }

  if (body.acao === 'despublicar') {
    await db.projectProgress.update({
      where: { id: existente.id },
      data: { ...dados, publishedAt: null },
    })
    return ok({ publicado: false })
  }

  // Publicar: exige o minimo para o projeto servir de portfolio.
  const atualizado = await db.projectProgress.update({ where: { id: existente.id }, data: dados })
  const checklist = parseRecord(atualizado.checklist)
  const itensMarcados = Object.values(checklist).filter(Boolean).length

  if (!atualizado.repoUrl) {
    return fail('Informe o link do repositório antes de marcar como publicado.', 422, {
      campo: 'repositorio',
    })
  }

  if (itensMarcados === 0) {
    return fail('Marque no checklist de qualidade o que você já fez antes de publicar.', 422, {
      campo: 'checklist',
    })
  }

  await db.projectProgress.update({
    where: { id: existente.id },
    data: { publishedAt: atualizado.publishedAt ?? new Date() },
  })

  await completeProgress({ userId: user.id, nodeType: 'project', nodeId: projeto.id })
  await logEvent({ userId: user.id, type: 'content_completed', nodeType: 'project', nodeId: projeto.id })

  return ok({ publicado: true })
})
