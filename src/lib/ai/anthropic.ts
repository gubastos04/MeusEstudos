import { env } from '../env'

/**
 * Cliente da API da Anthropic.
 *
 * Implementado com fetch, sem SDK: sao duas chamadas simples e isso evita mais
 * uma dependencia para manter atualizada.
 *
 * Este modulo SO pode ser importado por codigo de servidor. A chave nunca e
 * enviada ao navegador, nao vai para localStorage, cookie nem HTML.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export type AnthropicSuccess = {
  ok: true
  text: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  stopReason: string | null
}

export type AnthropicFailure = {
  ok: false
  kind: 'timeout' | 'rede' | 'autenticacao' | 'limite-api' | 'servidor' | 'resposta-invalida'
  /** Mensagem para a pessoa, em portugues, sem jargao de HTTP. */
  message: string
  code: string | null
  latencyMs: number
}

export type AnthropicResult = AnthropicSuccess | AnthropicFailure

type CallParams = {
  apiKey: string
  model: string
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
  temperature?: number
}

export async function callAnthropic(params: CallParams): Promise<AnthropicResult> {
  const settings = env()
  const started = Date.now()
  const maxTokens = Math.min(params.maxTokens ?? settings.IA_MAX_TOKENS, settings.IA_MAX_TOKENS)

  // Uma unica retentativa, apenas para falhas transitorias. Nunca em loop:
  // chamada repetida sem teto e o caminho mais rapido para uma fatura grande.
  const attempts = 2

  let last: AnthropicFailure = {
    ok: false,
    kind: 'rede',
    message: 'Não foi possível falar com a IA. Tente novamente.',
    code: null,
    latencyMs: 0,
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), settings.IA_TIMEOUT_MS)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: params.model,
          max_tokens: maxTokens,
          temperature: params.temperature ?? 0.3,
          system: params.system,
          messages: params.messages,
        }),
      })

      clearTimeout(timer)
      const latencyMs = Date.now() - started

      if (response.ok) {
        const data = (await response.json()) as {
          content?: { type: string; text?: string }[]
          usage?: { input_tokens?: number; output_tokens?: number }
          stop_reason?: string | null
        }

        const text = (data.content ?? [])
          .filter((block) => block.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text as string)
          .join('\n')
          .trim()

        if (!text) {
          return {
            ok: false,
            kind: 'resposta-invalida',
            message: 'A IA respondeu sem conteúdo. Tente reformular.',
            code: null,
            latencyMs,
          }
        }

        return {
          ok: true,
          text,
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          stopReason: data.stop_reason ?? null,
          latencyMs,
        }
      }

      const failure = await describeFailure(response, latencyMs)
      last = failure

      const retryable = response.status === 429 || response.status === 529 || response.status >= 500
      if (!retryable || attempt === attempts) return failure

      await delay(attempt * 800)
    } catch (error) {
      clearTimeout(timer)
      const latencyMs = Date.now() - started
      const aborted = error instanceof Error && error.name === 'AbortError'

      last = aborted
        ? {
            ok: false,
            kind: 'timeout',
            message: 'A IA demorou demais para responder. Tente novamente.',
            code: 'timeout',
            latencyMs,
          }
        : {
            ok: false,
            kind: 'rede',
            message: 'Não foi possível falar com a IA. Verifique a conexão.',
            code: null,
            latencyMs,
          }

      if (aborted || attempt === attempts) return last
      await delay(attempt * 800)
    }
  }

  return last
}

async function describeFailure(response: Response, latencyMs: number): Promise<AnthropicFailure> {
  let code: string | null = null
  try {
    const body = (await response.json()) as { error?: { type?: string; message?: string } }
    code = body.error?.type ?? null
  } catch {
    code = null
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      kind: 'autenticacao',
      message: 'A chave de IA foi recusada. Verifique a configuração.',
      code,
      latencyMs,
    }
  }

  if (response.status === 429) {
    return {
      ok: false,
      kind: 'limite-api',
      message: 'A IA está recebendo pedidos demais agora. Tente em alguns minutos.',
      code,
      latencyMs,
    }
  }

  return {
    ok: false,
    kind: 'servidor',
    message: 'A IA está indisponível agora. Tente novamente mais tarde.',
    code: code ?? String(response.status),
    latencyMs,
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
