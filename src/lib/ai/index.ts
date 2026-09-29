import { db } from '../db'
import { logEvent } from '../progress'
import { callAnthropic } from './anthropic'
import { buildPrompt, type AiRequestInput } from './features'
import { recordAiRequest, releaseAiCall, reserveAiCall } from './limits'
import { validateGeneratedDemand } from './generated-demand'

export { getAiStatus } from './limits'
export { aiRequestSchema, featureLabels, type AiFeature } from './features'

/**
 * Orquestrador das chamadas de IA.
 *
 * Sequencia fixa:
 *   reserva (limite diario) -> prompt -> chamada com timeout -> registro.
 *
 * Nenhuma chamada acontece sem reserva, e toda chamada termina em registro,
 * inclusive quando falha. Assim o consumo e sempre visivel e limitado.
 */

export type AiOutcome =
  | {
      ok: true
      feature: string
      text: string
      /** Presente em gerar-demanda: a demanda validada e salva. */
      demandId?: string
      generated: boolean
      usage: { inputTokens: number; outputTokens: number; latencyMs: number }
      remaining: number
    }
  | { ok: false; erro: string; status: number }

export async function runAi(userId: string, request: AiRequestInput): Promise<AiOutcome> {
  const reservation = await reserveAiCall(userId)

  if (!reservation.ok) {
    await recordAiRequest({
      userId,
      feature: request.feature,
      model: 'nenhum',
      status: reservation.reason === 'limite' ? 'limite' : 'sem-chave',
      moduleId: request.context.moduleId ?? null,
      nodeType: request.context.nodeType ?? null,
      nodeId: request.context.nodeId ?? null,
    })
    return { ok: false, erro: reservation.message, status: reservation.status }
  }

  const { config } = reservation
  const plan = buildPrompt(request)

  const result = await callAnthropic({
    apiKey: config.apiKey!,
    model: config.model,
    system: plan.system,
    messages: plan.messages,
    maxTokens: plan.maxTokens,
    temperature: plan.temperature,
  })

  if (!result.ok) {
    // Falha de rede ou timeout nao consumiu resposta: devolve a reserva.
    if (result.kind === 'rede' || result.kind === 'timeout') {
      await releaseAiCall(userId)
    }

    await recordAiRequest({
      userId,
      feature: request.feature,
      model: config.model,
      status: result.kind === 'timeout' ? 'timeout' : 'erro',
      latencyMs: result.latencyMs,
      errorCode: result.code,
      moduleId: request.context.moduleId ?? null,
      nodeType: request.context.nodeType ?? null,
      nodeId: request.context.nodeId ?? null,
    })

    return { ok: false, erro: result.message, status: result.kind === 'autenticacao' ? 502 : 503 }
  }

  await recordAiRequest({
    userId,
    feature: request.feature,
    model: config.model,
    status: 'ok',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
    moduleId: request.context.moduleId ?? null,
    nodeType: request.context.nodeType ?? null,
    nodeId: request.context.nodeId ?? null,
  })

  await logEvent({
    userId,
    type: 'ai_used',
    nodeType: request.context.nodeType ?? null,
    nodeId: request.context.nodeId ?? null,
    meta: { feature: request.feature },
  })

  const usage = {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    latencyMs: result.latencyMs,
  }
  const remaining = Math.max(0, config.dailyLimit - reservation.usedToday)

  if (plan.expectJson) {
    // Conteudo gerado passa por validacao antes de virar demanda (spec 61).
    const validated = validateGeneratedDemand(result.text, request)
    if (!validated.ok) {
      return {
        ok: false,
        erro: `A demanda gerada não passou na validação (${validated.reason}). Tente pedir de novo, com mais detalhes.`,
        status: 422,
      }
    }

    const saved = await db.demand.create({
      data: {
        id: validated.demand.id,
        title: validated.demand.title,
        type: validated.demand.type,
        difficulty: validated.demand.difficulty,
        minutes: validated.demand.estimatedMinutes,
        summary: validated.demand.summary,
        stack: JSON.stringify(validated.demand.stack),
        moduleIds: JSON.stringify(validated.demand.moduleIds),
        contextQuality: validated.demand.contextQuality,
        generated: true,
        ownerId: userId,
        payload: JSON.stringify(validated.demand),
      },
    })

    return {
      ok: true,
      feature: request.feature,
      text: result.text,
      demandId: saved.id,
      generated: true,
      usage,
      remaining,
    }
  }

  return { ok: true, feature: request.feature, text: result.text, generated: false, usage, remaining }
}
