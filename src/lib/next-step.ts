import { db } from './db'
import { getModules, getTrack, getDemand, getProject, findExercise, getChallenges } from './content/loader'
import { parseStringArray } from './json'

/**
 * Recomendacao de proximo passo.
 *
 * Duas regras do produto governam este arquivo:
 * 1. mostrar UM proximo passo principal, nunca uma lista infinita;
 * 2. respeitar o tempo disponivel informado pela pessoa, sem cobrar cronograma.
 *
 * Prioridade (spec 41):
 *   conteudo interrompido > demanda em andamento > projeto em andamento >
 *   exercicio pendente > revisao > proximo conteudo
 */

export type TimeBudget = 10 | 20 | 45

export type SuggestionKind =
  | 'lesson'
  | 'checkpoint'
  | 'exercise'
  | 'demand'
  | 'project'
  | 'assessment'
  | 'challenge'
  | 'review-error'
  | 'note'

export type Suggestion = {
  kind: SuggestionKind
  id: string
  title: string
  /** Por que isto esta sendo sugerido agora. Frase curta, sem motivacao artificial. */
  reason: string
  href: string
  minutes: number
  /** Texto do botao: "Continuar", "Retomar", "Comecar", "Revisar". */
  action: string
  moduleTitle?: string
}

/** Ordem em que os modulos sao percorridos, respeitando a trilha escolhida. */
function moduleOrderFor(trackId: string | null | undefined) {
  const modules = getModules()
  const track = trackId ? getTrack(trackId) : null
  if (!track) return modules

  const rank = new Map(track.moduleIds.map((id, index) => [id, index]))
  return [...modules].sort((a, b) => {
    const rankA = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rankB = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    if (rankA !== rankB) return rankA - rankB
    return a.semester - b.semester || a.order - b.order
  })
}

function fitsBudget(minutes: number, budget: TimeBudget): boolean {
  // Uma folga de 5 minutos evita descartar um bloco de 12 min num orcamento de 10.
  return minutes <= budget + 5
}

export async function getNextStep(
  userId: string,
  budget?: TimeBudget,
): Promise<Suggestion | null> {
  const suggestions = await buildSuggestions(userId, budget ?? null)
  return suggestions[0] ?? null
}

/**
 * Lista curta usada pelo modo "tenho X minutos".
 * No maximo 4 opcoes: o objetivo e decidir rapido, nao escolher entre tudo.
 */
export async function getSuggestions(
  userId: string,
  budget: TimeBudget,
  limit = 4,
): Promise<Suggestion[]> {
  const suggestions = await buildSuggestions(userId, budget)
  return suggestions.slice(0, limit)
}

async function buildSuggestions(userId: string, budget: TimeBudget | null): Promise<Suggestion[]> {
  const profile = await db.userProfile.findUnique({ where: { userId } })
  const modules = moduleOrderFor(profile?.trackId)
  const out: Suggestion[] = []

  const progressRows = await db.progress.findMany({
    where: { userId, nodeType: { in: ['lesson', 'checkpoint'] } },
    select: { nodeId: true, status: true, resumeBlock: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
  })
  const byNode = new Map(progressRows.map((row) => [row.nodeId, row]))

  // 1. Conteudo interrompido -------------------------------------------------
  for (const row of progressRows) {
    if (row.status !== 'in_progress') continue
    const location = findItemIn(modules, row.nodeId)
    if (!location) continue
    const minutes = remainingMinutes(location.item, row.resumeBlock)
    if (budget && !fitsBudget(minutes, budget)) continue
    out.push({
      kind: location.item.type,
      id: location.item.id,
      title: location.item.title,
      reason: 'Você parou no meio.',
      href: `/estudar/${location.module.id}/${location.item.id}`,
      minutes,
      action: 'Retomar',
      moduleTitle: location.module.title,
    })
    break
  }

  // 2. Demanda em andamento --------------------------------------------------
  const openDemand = await db.demandSubmission.findFirst({
    where: { userId, status: { in: ['analisando', 'implementando', 'revisando'] } },
    orderBy: { updatedAt: 'desc' },
  })
  if (openDemand) {
    const demand = getDemand(openDemand.demandId)
    if (demand) {
      const minutes = Math.round(demand.estimatedMinutes / 2)
      if (!budget || fitsBudget(minutes, budget)) {
        out.push({
          kind: 'demand',
          id: demand.id,
          title: demand.title,
          reason: `Demanda em andamento (${statusLabel(openDemand.status)}).`,
          href: `/demandas/${demand.id}`,
          minutes,
          action: 'Continuar',
        })
      }
    }
  }

  // 3. Projeto em andamento --------------------------------------------------
  const openProject = await db.projectProgress.findFirst({
    where: { userId, publishedAt: null },
    orderBy: { updatedAt: 'desc' },
  })
  if (openProject) {
    const project = getProject(openProject.projectId)
    const step = project?.steps.find((s) => s.order === openProject.currentStep) ?? project?.steps[0]
    if (project && step) {
      if (!budget || fitsBudget(step.estimatedMinutes, budget)) {
        out.push({
          kind: 'project',
          id: project.id,
          title: `${project.title} — etapa ${step.order}: ${step.title}`,
          reason: 'Projeto em andamento.',
          href: `/projetos/${project.id}`,
          minutes: step.estimatedMinutes,
          action: 'Continuar',
        })
      }
    }
  }

  // 4. Exercicio pendente ----------------------------------------------------
  const failedAttempt = await db.exerciseAttempt.findFirst({
    where: { userId, passed: false },
    orderBy: { createdAt: 'desc' },
  })
  if (failedAttempt) {
    const found = findExercise(failedAttempt.exerciseId)
    if (found) {
      const minutes = found.exercise.estimatedMinutes
      if (!budget || fitsBudget(minutes, budget)) {
        out.push({
          kind: 'exercise',
          id: found.exercise.id,
          title: found.exercise.title,
          reason: 'Exercício que ainda não passou nos testes.',
          href: `/estudar/${found.moduleId}/${found.lessonId}#exercicio`,
          minutes,
          action: 'Tentar de novo',
        })
      }
    }
  }

  // 5. Revisao ---------------------------------------------------------------
  const reviewError = await db.errorRecord.findFirst({
    where: {
      userId,
      OR: [{ reviewedAt: null }, { reviewedAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } }],
    },
    orderBy: [{ reviewCount: 'asc' }, { createdAt: 'desc' }],
  })
  if (reviewError) {
    out.push({
      kind: 'review-error',
      id: reviewError.id,
      title: reviewError.title,
      reason: 'Erro que você registrou e ainda não revisou.',
      href: `/erros/${reviewError.id}`,
      minutes: 5,
      action: 'Revisar',
    })
  }

  // 6. Proximo conteudo ------------------------------------------------------
  for (const modulo of modules) {
    const next = modulo.items.find((item) => !byNode.has(item.id))
    if (!next) continue
    if (budget && !fitsBudget(next.estimatedMinutes, budget)) continue
    out.push({
      kind: next.type,
      id: next.id,
      title: next.title,
      reason: hasAnyProgress(modulo.items, byNode) ? 'Próximo item do módulo.' : 'Começo de um módulo novo.',
      href: `/estudar/${modulo.id}/${next.id}`,
      minutes: next.estimatedMinutes,
      action: hasAnyProgress(modulo.items, byNode) ? 'Continuar' : 'Começar',
      moduleTitle: modulo.title,
    })
    break
  }

  // Complemento para orcamentos curtos: um desafio rapido, se sobrar espaco.
  if (budget === 10 && out.length < 3) {
    const quick = getChallenges()
      .filter((challenge) => challenge.estimatedMinutes <= 15)
      .find(() => true)
    if (quick) {
      out.push({
        kind: 'challenge',
        id: quick.id,
        title: quick.title,
        reason: 'Desafio curto.',
        href: `/desafios/${quick.id}`,
        minutes: quick.estimatedMinutes,
        action: 'Abrir',
      })
    }
  }

  return out
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    analisando: 'analisando',
    implementando: 'implementando',
    revisando: 'revisando',
    concluida: 'concluída',
    abandonada: 'parada',
  }
  return labels[status] ?? status
}

function hasAnyProgress(items: { id: string }[], byNode: Map<string, unknown>): boolean {
  return items.some((item) => byNode.has(item.id))
}

function findItemIn(modules: ReturnType<typeof getModules>, itemId: string) {
  for (const modulo of modules) {
    const item = modulo.items.find((candidate) => candidate.id === itemId)
    if (item) return { module: modulo, item }
  }
  return null
}

/** Estimativa do que falta, com base no bloco onde a pessoa parou. */
function remainingMinutes(item: { type: string; estimatedMinutes: number }, resumeBlock: number): number {
  if (resumeBlock <= 0) return item.estimatedMinutes
  // Sem saber o total de blocos aqui, usa uma reducao conservadora.
  return Math.max(3, Math.round(item.estimatedMinutes * 0.6))
}

// --- Revisao ----------------------------------------------------------------

export type ReviewItem = {
  kind: 'error' | 'topic' | 'note' | 'exercise'
  id: string
  title: string
  detail: string
  href: string
  minutes: number
}

/**
 * Sistema de revisao (spec 65). Nao e repeticao artificial: o material vem do
 * que a pessoa realmente errou, registrou ou deixou pela metade.
 */
export async function getReviewItems(userId: string, limit = 6): Promise<ReviewItem[]> {
  const [errors, weakAttempts, notes] = await Promise.all([
    db.errorRecord.findMany({
      where: { userId },
      orderBy: [{ reviewCount: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    }),
    db.assessmentAttempt.findMany({
      where: { userId, status: 'finished' },
      orderBy: { finishedAt: 'desc' },
      take: 5,
    }),
    db.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 3 }),
  ])

  const items: ReviewItem[] = []

  for (const error of errors) {
    items.push({
      kind: 'error',
      id: error.id,
      title: error.title,
      detail: error.learning || error.solution || 'Sem aprendizado registrado ainda.',
      href: `/erros/${error.id}`,
      minutes: 5,
    })
  }

  const topics = new Map<string, string>()
  for (const attempt of weakAttempts) {
    for (const topic of parseStringArray(attempt.reviewTopics)) {
      if (!topics.has(topic)) topics.set(topic, attempt.assessmentId)
    }
  }
  for (const [topic, assessmentId] of topics) {
    items.push({
      kind: 'topic',
      id: `${assessmentId}:${topic}`,
      title: topic,
      detail: 'Apareceu como ponto a revisar na sua última avaliação.',
      href: `/progresso#avaliacoes`,
      minutes: 10,
    })
  }

  for (const note of notes) {
    items.push({
      kind: 'note',
      id: note.id,
      title: note.title,
      detail: 'Sua anotação.',
      href: `/anotacoes/${note.id}`,
      minutes: 3,
    })
  }

  return items.slice(0, limit)
}
