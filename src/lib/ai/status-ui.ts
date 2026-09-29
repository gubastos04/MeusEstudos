import { getAiStatus } from './limits'

/**
 * Status da IA no formato que a interface consome.
 *
 * Existe para garantir, por construcao, que nenhuma pagina passe acidentalmente
 * a chave ao cliente: este objeto so tem contadores e mensagem.
 */
export async function statusIaParaCliente(userId: string) {
  const status = await getAiStatus(userId)

  return {
    configurada: status.configured,
    habilitada: status.enabled,
    limiteDiario: status.dailyLimit,
    usadasHoje: status.usedToday,
    restantes: status.remaining,
    mensagem: status.message,
  }
}
