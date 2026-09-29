import { db } from './db'

/**
 * Rate limiting por janela fixa, persistido no banco.
 *
 * Fica no banco (e nao em memoria) porque em serverless cada instancia teria
 * seu proprio contador, o que tornaria o limite inutil.
 */

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + windowSeconds * 1000)

  try {
    const existing = await db.rateLimit.findUnique({ where: { id: key } })

    if (!existing || existing.windowEnd.getTime() <= now.getTime()) {
      await db.rateLimit.upsert({
        where: { id: key },
        create: { id: key, count: 1, windowEnd },
        update: { count: 1, windowEnd },
      })
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 }
    }

    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.windowEnd.getTime() - now.getTime()) / 1000)),
      }
    }

    const updated = await db.rateLimit.update({
      where: { id: key },
      data: { count: { increment: 1 } },
    })

    return {
      allowed: true,
      remaining: Math.max(0, limit - updated.count),
      retryAfterSeconds: 0,
    }
  } catch {
    // Indisponibilidade do controle de limite nao pode bloquear o app inteiro.
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 }
  }
}

/** Identificador aproximado do cliente. Usado apenas para limitar tentativas. */
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const real = request.headers.get('x-real-ip')?.trim()
  const ip = forwarded || real || 'local'
  return `${prefix}:${ip}`
}

/** Remove janelas antigas. Chamado esporadicamente pelas rotas de auth. */
export async function pruneRateLimits(): Promise<void> {
  await db.rateLimit
    .deleteMany({ where: { windowEnd: { lt: new Date(Date.now() - 60 * 60 * 1000) } } })
    .catch(() => undefined)
}
