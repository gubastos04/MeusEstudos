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

/**
 * Intervalo minimo entre duas revisoes do mesmo erro, por numero de revisoes
 * ja feitas: 1, 3, 7 e 21 dias, e 21 daí em diante.
 *
 * Antes havia um intervalo fixo de 14 dias no proximo passo e nenhum na lista
 * de revisao, o que dava dois problemas opostos: um erro registrado hoje podia
 * voltar hoje, e um assunto consolidado ha dois meses nao voltava nunca.
 *
 * Isto informa, nao premia: nao ha pontuacao, sequencia nem cobranca por
 * revisao atrasada. So a ordem em que o material volta.
 */
const DIAS_ENTRE_REVISOES = [1, 3, 7, 21]

export function prontoParaRevisar(
  erro: { reviewedAt: Date | null; reviewCount: number },
  agora: Date = new Date(),
): boolean {
  if (!erro.reviewedAt) return true

  const dias = DIAS_ENTRE_REVISOES[Math.min(erro.reviewCount, DIAS_ENTRE_REVISOES.length - 1)] ?? 21
  const proxima = erro.reviewedAt.getTime() + dias * 24 * 60 * 60 * 1000

  return agora.getTime() >= proxima
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

  /**
   * Trabalho comecado e parado ha muito tempo.
   *
   * Demanda e projeto tem prioridade 2 e 3, acima de exercicio e revisao, e os
   * projetos levam de 9 a 23 horas. Quem travava na etapa 6 de 11 recebia
   * "continue o projeto" como unica recomendacao por semanas, sem nada mais
   * conseguir aparecer — o pior modo de falha do sistema.
   *
   * Parar e legitimo (regra 4), entao isto nao cobra nem marca em vermelho:
   * so deixa de prender o topo. O item continua na lista, no fim, com a data.
   */
  const adiados: Suggestion[] = []
  const PARADO_APOS_DIAS = 10
  const paradoDesde = (data: Date) => Date.now() - data.getTime() > PARADO_APOS_DIAS * 24 * 60 * 60 * 1000
  const emDiaDe = (data: Date) =>
    data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

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
        const parada = paradoDesde(openDemand.updatedAt)
        ;(parada ? adiados : out).push({
          kind: 'demand',
          id: demand.id,
          title: demand.title,
          reason: parada
            ? `Sem avanço desde ${emDiaDe(openDemand.updatedAt)}. Continua aqui quando você quiser.`
            : `Demanda em andamento (${statusLabel(openDemand.status)}).`,
          href: `/demandas/${demand.id}`,
          minutes,
          action: parada ? 'Retomar' : 'Continuar',
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
        const parado = paradoDesde(openProject.updatedAt)
        ;(parado ? adiados : out).push({
          kind: 'project',
          id: project.id,
          title: `${project.title} — etapa ${step.order}: ${step.title}`,
          reason: parado
            ? `Na etapa ${step.order} desde ${emDiaDe(openProject.updatedAt)}. Continua aqui quando você quiser.`
            : 'Projeto em andamento.',
          href: `/projetos/${project.id}`,
          minutes: step.estimatedMinutes,
          action: parado ? 'Retomar' : 'Continuar',
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
  // Busca candidatos e aplica o intervalo crescente em memoria: ele depende do
  // reviewCount de cada linha, o que nao cabe num `where` do Prisma.
  const candidatos = await db.errorRecord.findMany({
    where: { userId },
    orderBy: [{ reviewCount: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  })
  const reviewError = candidatos.find((erro) => prontoParaRevisar(erro)) ?? null
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

  // O que esta parado fica no fim: continua acessivel, sem bloquear o resto.
  out.push(...adiados)

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
      // Pega folga porque o intervalo e aplicado depois, em memoria.
      take: limit * 4,
    }),
    db.assessmentAttempt.findMany({
      where: { userId, status: 'finished' },
      orderBy: { finishedAt: 'desc' },
      take: 5,
    }),
    db.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 3 }),
  ])

  const items: ReviewItem[] = []

  for (const error of errors.filter((erro) => prontoParaRevisar(erro)).slice(0, limit)) {
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
  // Revisar fazendo, e nao relendo: quando existe desafio que exercita o
  // topico, a revisao aponta para ele. A ligacao vem do campo `topics` do
  // proprio desafio, entao ela envelhece junto com o conteudo, nao com o codigo.
  const desafiosPorTopico = new Map<string, { id: string; title: string; estimatedMinutes: number }>()
  for (const challenge of getChallenges()) {
    for (const topic of challenge.topics) {
      if (!desafiosPorTopico.has(topic)) desafiosPorTopico.set(topic, challenge)
    }
  }

  for (const [topic, assessmentId] of topics) {
    const desafio = desafiosPorTopico.get(topic)

    items.push({
      kind: 'topic',
      id: `${assessmentId}:${topic}`,
      title: topic,
      detail: desafio
        ? `Ponto a revisar na sua última avaliação. O desafio "${desafio.title}" exercita isso.`
        : 'Apareceu como ponto a revisar na sua última avaliação.',
      href: desafio ? `/desafios/${desafio.id}` : `/progresso#avaliacoes`,
      minutes: desafio ? desafio.estimatedMinutes : 10,
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
