import { db } from '../db'
import { dayKey } from '../dates'
import { bumpActivity } from '../progress'
import { messageFor, resolveAiConfig, type AiConfig, type AiStatus, type AiUnavailableReason } from './config'

/**
 * Controle de custo da IA.
 *
 * Garantias:
 * - limite diario por usuario, verificado ANTES de qualquer chamada;
 * - o contador e incrementado no momento da reserva, nao no fim: uma chamada que
 *   falha no meio ja consumiu recurso e nao pode abrir brecha para repeticao
 *   infinita;
 * - todo consumo fica registrado (AIUsage agregado + AIRequest por chamada).
 */

export async function getAiStatus(userId: string): Promise<AiStatus> {
  const config = await resolveAiConfig(userId)
  const usedToday = await getUsedToday(userId)
  const remaining = Math.max(0, config.dailyLimit - usedToday)

  let message: string | null = null
  if (!config.configured) message = messageFor('sem-chave')
  else if (!config.enabled) message = messageFor('desligada')
  else if (remaining === 0) message = messageFor('limite', config.dailyLimit)

  return {
    configured: config.configured,
    enabled: config.enabled,
    source: config.source,
    model: config.model,
    dailyLimit: config.dailyLimit,
    usedToday,
    remaining,
    keyHint: config.keyHint,
    message,
  }
}

export async function getUsedToday(userId: string): Promise<number> {
  const row = await db.aIUsage.findUnique({ where: { userId_day: { userId, day: dayKey() } } })
  return row?.calls ?? 0
}

export type Reservation =
  | { ok: true; config: AiConfig; usedToday: number }
  | { ok: false; reason: AiUnavailableReason; message: string; status: number }

/**
 * Reserva uma chamada. Devolve a configuracao com a chave apenas quando
 * a chamada pode acontecer de fato.
 */
export async function reserveAiCall(userId: string): Promise<Reservation> {
  const config = await resolveAiConfig(userId)

  if (!config.configured) {
    return { ok: false, reason: 'sem-chave', message: messageFor('sem-chave'), status: 503 }
  }
  if (!config.enabled) {
    return { ok: false, reason: 'desligada', message: messageFor('desligada'), status: 409 }
  }

  const day = dayKey()
  const usage = await db.aIUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, calls: 1 },
    update: { calls: { increment: 1 } },
  })

  if (usage.calls > config.dailyLimit) {
    // Devolve a reserva: nao consumiu chamada de verdade.
    await db.aIUsage.update({
      where: { userId_day: { userId, day } },
      data: { calls: { decrement: 1 } },
    })
    return {
      ok: false,
      reason: 'limite',
      message: messageFor('limite', config.dailyLimit),
      status: 429,
    }
  }

  return { ok: true, config, usedToday: usage.calls }
}

/** Registra o resultado da chamada. Nunca guarda o conteudo do prompt. */
export async function recordAiRequest(params: {
  userId: string
  feature: string
  model: string
  status: 'ok' | 'erro' | 'limite' | 'timeout' | 'sem-chave'
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
  errorCode?: string | null
  moduleId?: string | null
  nodeType?: string | null
  nodeId?: string | null
}): Promise<void> {
  const {
    userId,
    feature,
    model,
    status,
    inputTokens = 0,
    outputTokens = 0,
    latencyMs = 0,
    errorCode = null,
    moduleId = null,
    nodeType = null,
    nodeId = null,
  } = params

  await db.aIRequest
    .create({
      data: {
        userId,
        feature,
        model,
        status,
        inputTokens,
        outputTokens,
        latencyMs,
        errorCode,
        moduleId,
        nodeType,
        nodeId,
      },
    })
    .catch(() => undefined)

  if (inputTokens > 0 || outputTokens > 0) {
    await db.aIUsage
      .update({
        where: { userId_day: { userId, day: dayKey() } },
        data: {
          inputTokens: { increment: inputTokens },
          outputTokens: { increment: outputTokens },
        },
      })
      .catch(() => undefined)
  }

  if (status === 'ok') {
    await bumpActivity(userId, { aiCalls: 1 })
  }
}

/** Devolve a reserva quando a chamada nem chegou a acontecer (ex.: erro de rede). */
export async function releaseAiCall(userId: string): Promise<void> {
  await db.aIUsage
    .updateMany({
      where: { userId, day: dayKey(), calls: { gt: 0 } },
      data: { calls: { decrement: 1 } },
    })
    .catch(() => undefined)
}
