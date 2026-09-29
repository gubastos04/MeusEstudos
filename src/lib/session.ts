import { cookies } from 'next/headers'

import { db } from './db'
import { env } from './env'
import { hashToken, newSessionToken } from './crypto'

export const SESSION_COOKIE = 'sessao'
const SESSION_DAYS = 30
// Quando faltar menos de 25 dias para expirar, a sessao e renovada em silencio.
const REFRESH_AFTER_MS = 5 * 24 * 60 * 60 * 1000

export type SessionUser = {
  id: string
  email: string
  name: string
  onboardedAt: Date | null
  theme: string
}

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const token = newSessionToken()

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: expiryFromNow(),
      userAgent: userAgent?.slice(0, 250) ?? null,
    },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().isProd,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })

  return token
}

/**
 * Le a sessao do cookie e devolve o usuario.
 * Nao lanca excecao: sessao invalida, expirada ou revogada devolve null.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true } } },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  if (session.user.deletedAt) return null

  const sinceLastUse = Date.now() - session.lastUsedAt.getTime()
  if (sinceLastUse > REFRESH_AFTER_MS) {
    // Sessao ativa: estende a validade. Falha aqui nao impede o acesso.
    await db.session
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date(), expiresAt: expiryFromNow() },
      })
      .catch(() => undefined)
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    onboardedAt: session.user.profile?.onboardedAt ?? null,
    theme: session.user.profile?.theme ?? 'system',
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  if (token) {
    await db.session
      .updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined)
  }

  store.delete(SESSION_COOKIE)
}

/** Encerra todas as sessoes do usuario (troca de senha, "sair de todos os dispositivos"). */
export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptToken ? { NOT: { tokenHash: hashToken(exceptToken) } } : {}),
    },
    data: { revokedAt: new Date() },
  })
  return result.count
}

/** Limpeza de sessoes expiradas. Chamada no login para nao precisar de cron. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.session
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined)
}
