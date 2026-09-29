import { db } from '../db'
import { env } from '../env'
import { decryptSecret } from '../crypto'

/**
 * Resolucao da configuracao de IA.
 *
 * A IA e opcional e desligada por padrao. Sem chave valida:
 * - o app funciona igual;
 * - os botoes de IA continuam visiveis;
 * - clicar mostra um aviso curto e nenhuma chamada e feita.
 *
 * Precedencia: chave do usuario > chave do servidor.
 * A chave nunca sai do servidor, em nenhuma resposta de API.
 */

export type AiUnavailableReason = 'sem-chave' | 'desligada' | 'limite'

export type AiConfig = {
  configured: boolean
  source: 'usuario' | 'servidor' | 'nenhuma'
  model: string
  dailyLimit: number
  enabled: boolean
  /** Presente apenas dentro do servidor. Nunca serializar. */
  apiKey: string | null
  keyHint: string | null
}

export async function resolveAiConfig(userId: string): Promise<AiConfig> {
  const settings = env()
  const row = await db.userAIConfig.findUnique({ where: { userId } })

  const model = row?.model || settings.IA_MODELO
  const dailyLimit = row?.dailyLimit ?? settings.IA_LIMITE_DIARIO
  const enabled = row?.enabled ?? true

  if (row?.encryptedApiKey) {
    const apiKey = decryptSecret(row.encryptedApiKey)
    if (apiKey) {
      return {
        configured: true,
        source: 'usuario',
        model,
        dailyLimit,
        enabled,
        apiKey,
        keyHint: row.keyHint ?? null,
      }
    }
    // Chave ilegivel: APP_SECRET mudou. Nao e erro do usuario, mas precisa reconfigurar.
    console.warn('[ia] chave do usuario nao pode ser descriptografada; peca para salvar de novo')
  }

  if (settings.serverAiConfigured) {
    return {
      configured: true,
      source: 'servidor',
      model,
      dailyLimit,
      enabled,
      apiKey: settings.ANTHROPIC_API_KEY,
      keyHint: settings.ANTHROPIC_API_KEY.slice(-4),
    }
  }

  return {
    configured: false,
    source: 'nenhuma',
    model,
    dailyLimit,
    enabled,
    apiKey: null,
    keyHint: null,
  }
}

/** Versao segura para enviar ao cliente: sem a chave. */
export type AiStatus = {
  configured: boolean
  enabled: boolean
  source: 'usuario' | 'servidor' | 'nenhuma'
  model: string
  dailyLimit: number
  usedToday: number
  remaining: number
  keyHint: string | null
  /** Mensagem pronta para a interface quando nao e possivel usar. */
  message: string | null
}

export function messageFor(reason: AiUnavailableReason, limit?: number): string {
  switch (reason) {
    case 'sem-chave':
      return 'A IA não está configurada neste ambiente.'
    case 'desligada':
      return 'A IA está desligada nas suas configurações.'
    case 'limite':
      return `Você chegou ao limite de ${limit ?? 0} chamadas de IA hoje. O limite volta amanhã.`
  }
}
