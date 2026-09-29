import { db } from './db'
import { dayKey, lastDayKeys } from './dates'
import { toJson } from './json'

/**
 * Progresso, atividade e eventos.
 *
 * Principios do produto que estao codificados aqui:
 * - progresso e acumulativo e nunca volta pra tras;
 * - nao existe streak nem contagem de dias perdidos: a metrica de constancia e
 *   "dias ativos nos ultimos 7";
 * - parar no meio e um estado legitimo (`in_progress` com `resumeBlock`),
 *   nao um fracasso.
 */

export type NodeType =
  | 'lesson'
  | 'checkpoint'
  | 'exercise'
  | 'assessment'
  | 'demand'
  | 'project'
  | 'project-step'
  | 'challenge'

export type ActivityCounter =
  | 'lessonsCompleted'
  | 'exercisesAttempted'
  | 'demandsWorked'
  | 'assessmentsTaken'
  | 'errorsLogged'
  | 'notesWritten'
  | 'aiCalls'

export type EventType =
  | 'content_started'
  | 'content_completed'
  | 'content_abandoned'
  | 'exercise_attempted'
  | 'demand_started'
  | 'demand_completed'
  | 'error_logged'
  | 'note_written'
  | 'ai_used'
  | 'assessment_finished'

/** Marca o inicio (ou a retomada) de um conteudo. Idempotente. */
export async function startProgress(params: {
  userId: string
  nodeType: NodeType
  nodeId: string
  moduleId?: string | null
}) {
  const { userId, nodeType, nodeId, moduleId = null } = params

  const progress = await db.progress.upsert({
    where: { userId_nodeType_nodeId: { userId, nodeType, nodeId } },
    create: { userId, nodeType, nodeId, moduleId, status: 'in_progress' },
    // Reabrir algo ja concluido nao rebaixa o status: progresso nao volta pra tras.
    update: { lastSeenAt: new Date(), moduleId },
  })

  return progress
}

/**
 * Salva onde a pessoa parou e quanto tempo passou. Chamado ao sair da tela.
 *
 * `occurredAt` existe por causa da fila offline: um evento guardado ontem nao
 * pode mover o ponto de parada para tras quando subir depois de a pessoa ter
 * avancado em outro aparelho. O tempo, esse, sempre soma — ele aconteceu.
 */
export async function touchProgress(params: {
  userId: string
  nodeType: NodeType
  nodeId: string
  moduleId?: string | null
  resumeBlock?: number
  addSeconds?: number
  occurredAt?: Date | null
}) {
  const { userId, nodeType, nodeId, moduleId = null, resumeBlock, addSeconds = 0, occurredAt = null } = params
  const seconds = clampSeconds(addSeconds)

  const atual = await db.progress.findUnique({
    where: { userId_nodeType_nodeId: { userId, nodeType, nodeId } },
    select: { lastSeenAt: true },
  })

  // Evento mais antigo que o ultimo acesso: o tempo entra, o ponto de parada nao.
  const desatualizado =
    occurredAt !== null && atual !== null && occurredAt.getTime() < atual.lastSeenAt.getTime()
  const blocoAplicavel = desatualizado ? undefined : resumeBlock

  const progress = await db.progress.upsert({
    where: { userId_nodeType_nodeId: { userId, nodeType, nodeId } },
    create: {
      userId,
      nodeType,
      nodeId,
      moduleId,
      status: 'in_progress',
      resumeBlock: blocoAplicavel ?? 0,
      secondsSpent: seconds,
    },
    update: {
      lastSeenAt: new Date(),
      ...(blocoAplicavel !== undefined ? { resumeBlock: blocoAplicavel } : {}),
      ...(seconds > 0 ? { secondsSpent: { increment: seconds } } : {}),
    },
  })

  if (seconds > 0) {
    await bumpActivity(userId, {}, Math.round(seconds / 60))
  }

  return progress
}

export async function completeProgress(params: {
  userId: string
  nodeType: NodeType
  nodeId: string
  moduleId?: string | null
  addSeconds?: number
}) {
  const { userId, nodeType, nodeId, moduleId = null, addSeconds = 0 } = params
  const seconds = clampSeconds(addSeconds)
  const now = new Date()

  const existing = await db.progress.findUnique({
    where: { userId_nodeType_nodeId: { userId, nodeType, nodeId } },
  })

  const progress = await db.progress.upsert({
    where: { userId_nodeType_nodeId: { userId, nodeType, nodeId } },
    create: {
      userId,
      nodeType,
      nodeId,
      moduleId,
      status: 'completed',
      completedAt: now,
      secondsSpent: seconds,
    },
    update: {
      status: 'completed',
      // Mantem a primeira data de conclusao: refazer nao reescreve a historia.
      completedAt: existing?.completedAt ?? now,
      lastSeenAt: now,
      ...(seconds > 0 ? { secondsSpent: { increment: seconds } } : {}),
    },
  })

  const firstTime = !existing?.completedAt
  if (firstTime && (nodeType === 'lesson' || nodeType === 'checkpoint')) {
    await bumpActivity(userId, { lessonsCompleted: 1 }, Math.round(seconds / 60))
  } else if (seconds > 0) {
    await bumpActivity(userId, {}, Math.round(seconds / 60))
  }

  if (firstTime) {
    await logEvent({ userId, type: 'content_completed', nodeType, nodeId, meta: { moduleId } })
  }

  return progress
}

function clampSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  // Teto de 2 horas por chamada: aba esquecida aberta nao vira "tempo estudado".
  return Math.min(Math.round(value), 2 * 60 * 60)
}

/** Incrementa os contadores do dia. Cria a linha do dia se ainda nao existir. */
export async function bumpActivity(
  userId: string,
  counters: Partial<Record<ActivityCounter, number>>,
  minutes = 0,
): Promise<void> {
  const day = dayKey()
  const increments: Record<string, { increment: number }> = {}

  for (const [key, value] of Object.entries(counters)) {
    if (value && value > 0) increments[key] = { increment: value }
  }
  if (minutes > 0) increments.minutes = { increment: minutes }

  if (Object.keys(increments).length === 0) {
    // Ainda registra presenca no dia: a metrica e "dias ativos", nao "minutos".
    await db.activity.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} })
    return
  }

  const create: Record<string, unknown> = { userId, day }
  for (const [key, value] of Object.entries(counters)) {
    if (value && value > 0) create[key] = value
  }
  if (minutes > 0) create.minutes = minutes

  await db.activity.upsert({
    where: { userId_day: { userId, day } },
    create: create as never,
    update: increments as never,
  })
}

export async function logEvent(params: {
  userId: string
  type: EventType
  nodeType?: string | null
  nodeId?: string | null
  meta?: Record<string, unknown>
}): Promise<void> {
  // Analytics nao pode quebrar o fluxo do usuario.
  await db.event
    .create({
      data: {
        userId: params.userId,
        type: params.type,
        nodeType: params.nodeType ?? null,
        nodeId: params.nodeId ?? null,
        meta: params.meta ? toJson(params.meta) : null,
      },
    })
    .catch(() => undefined)
}

// --- Leitura -----------------------------------------------------------------

export type ProgressMap = Map<string, { status: string; resumeBlock: number; completedAt: Date | null }>

/** Mapa "nodeType:nodeId" -> progresso, para marcar listas sem N+1 consultas. */
export async function getProgressMap(userId: string, nodeType?: NodeType): Promise<ProgressMap> {
  const rows = await db.progress.findMany({
    where: { userId, ...(nodeType ? { nodeType } : {}) },
    select: { nodeType: true, nodeId: true, status: true, resumeBlock: true, completedAt: true },
  })

  const map: ProgressMap = new Map()
  for (const row of rows) {
    map.set(`${row.nodeType}:${row.nodeId}`, {
      status: row.status,
      resumeBlock: row.resumeBlock,
      completedAt: row.completedAt,
    })
  }
  return map
}

export function progressOf(map: ProgressMap, nodeType: NodeType, nodeId: string) {
  return map.get(`${nodeType}:${nodeId}`) ?? null
}

export async function getActiveDaysInLast7(userId: string): Promise<{ active: number; days: { day: string; active: boolean }[] }> {
  const keys = lastDayKeys(7)
  const rows = await db.activity.findMany({
    where: { userId, day: { in: keys } },
    select: { day: true, minutes: true, lessonsCompleted: true, exercisesAttempted: true },
  })

  const activeDays = new Set(rows.map((row) => row.day))
  return {
    active: activeDays.size,
    days: keys.map((day) => ({ day, active: activeDays.has(day) })),
  }
}

export type ModuleProgressSummary = {
  moduleId: string
  total: number
  completed: number
  inProgress: number
  percent: number
}

export async function getModuleProgress(
  userId: string,
  modules: { id: string; items: { id: string }[] }[],
): Promise<Map<string, ModuleProgressSummary>> {
  const rows = await db.progress.findMany({
    where: { userId, nodeType: { in: ['lesson', 'checkpoint'] } },
    select: { nodeId: true, status: true },
  })

  const byNode = new Map(rows.map((row) => [row.nodeId, row.status]))
  const summary = new Map<string, ModuleProgressSummary>()

  for (const modulo of modules) {
    let completed = 0
    let inProgress = 0
    for (const item of modulo.items) {
      const status = byNode.get(item.id)
      if (status === 'completed') completed += 1
      else if (status === 'in_progress') inProgress += 1
    }
    const total = modulo.items.length
    summary.set(modulo.id, {
      moduleId: modulo.id,
      total,
      completed,
      inProgress,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    })
  }

  return summary
}

/** Ultimo conteudo aberto e nao concluido. Base do "continue de onde parou". */
export async function getLastUnfinished(userId: string) {
  return db.progress.findFirst({
    where: { userId, status: 'in_progress', nodeType: { in: ['lesson', 'checkpoint'] } },
    orderBy: { lastSeenAt: 'desc' },
  })
}

export async function getTotals(userId: string) {
  const [lessons, exercises, demands, projects, publishedProjects, errors, notes, assessments, minutes] =
    await Promise.all([
      db.progress.count({ where: { userId, nodeType: { in: ['lesson', 'checkpoint'] }, status: 'completed' } }),
      db.exerciseAttempt.findMany({ where: { userId }, select: { exerciseId: true }, distinct: ['exerciseId'] }),
      db.demandSubmission.count({ where: { userId, status: 'concluida' } }),
      db.projectProgress.count({ where: { userId } }),
      db.projectProgress.count({ where: { userId, publishedAt: { not: null } } }),
      db.errorRecord.count({ where: { userId } }),
      db.note.count({ where: { userId } }),
      db.assessmentAttempt.count({ where: { userId, status: 'finished' } }),
      db.activity.aggregate({ where: { userId }, _sum: { minutes: true } }),
    ])

  return {
    lessonsCompleted: lessons,
    exercisesDone: exercises.length,
    demandsCompleted: demands,
    projectsStarted: projects,
    projectsPublished: publishedProjects,
    errorsLogged: errors,
    notes,
    assessmentsTaken: assessments,
    minutesStudied: minutes._sum.minutes ?? 0,
  }
}
