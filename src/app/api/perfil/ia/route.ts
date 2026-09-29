import { z } from 'zod'

import { handler, ok } from '@/lib/api'
import { getAiStatus } from '@/lib/ai/limits'
import { encryptSecret, keyHint } from '@/lib/crypto'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Configuracao de IA por usuario.
 *
 * A chave e criptografada com AES-256-GCM antes de tocar o banco e NUNCA volta
 * por nenhuma rota: o que a interface recebe e apenas a dica (4 ultimos
 * caracteres), o modelo, o limite e o consumo.
 */

const schema = z.object({
  chave: z.string().max(200).optional(),
  removerChave: z.boolean().optional(),
  modelo: z.string().min(3).max(60).optional(),
  limiteDiario: z.number().int().min(0).max(500).optional(),
  habilitada: z.boolean().optional(),
})

export const PATCH = handler({ schema }, async ({ user, body }) => {
  const dados: Record<string, unknown> = {}

  if (body.removerChave) {
    dados.encryptedApiKey = null
    dados.keyHint = null
  } else if (body.chave !== undefined) {
    const chave = body.chave.trim()

    if (chave.length === 0) {
      dados.encryptedApiKey = null
      dados.keyHint = null
    } else {
      // A chave e guardada cifrada; o texto puro nunca fica em repouso.
      dados.encryptedApiKey = encryptSecret(chave)
      dados.keyHint = keyHint(chave)
    }
  }

  if (body.modelo !== undefined) dados.model = body.modelo
  if (body.limiteDiario !== undefined) dados.dailyLimit = body.limiteDiario
  if (body.habilitada !== undefined) dados.enabled = body.habilitada

  await db.userAIConfig.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      model: env().IA_MODELO,
      dailyLimit: env().IA_LIMITE_DIARIO,
      ...dados,
    } as never,
    update: dados as never,
  })

  const status = await getAiStatus(user.id)

  return ok({
    configurada: status.configured,
    habilitada: status.enabled,
    origem: status.source,
    modelo: status.model,
    limiteDiario: status.dailyLimit,
    usadasHoje: status.usedToday,
    restantes: status.remaining,
    dicaChave: status.keyHint,
  })
})
