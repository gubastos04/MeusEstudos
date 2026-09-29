import { cache } from 'react'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from './db'
import { env } from './env'
import { hashPassword, verifyPassword } from './crypto'
import { createSession, pruneExpiredSessions, readSession, type SessionUser } from './session'

/**
 * Cadastro, login e recuperacao do usuario da requisicao.
 *
 * Toda autorizacao acontece no servidor. Nenhuma rota de dados confia em
 * identificador vindo do cliente: o userId sai sempre da sessao.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Informe um email valido.')
  .max(160, 'Email muito longo.')
  .email('Informe um email valido.')

export const passwordSchema = z
  .string()
  .min(10, 'A senha precisa de pelo menos 10 caracteres.')
  .max(200, 'Senha muito longa.')

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Informe seu nome.')
  .max(80, 'Nome muito longo.')

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
})

export type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string }

export async function registerUser(
  input: z.infer<typeof registerSchema>,
  userAgent?: string | null,
): Promise<AuthResult> {
  if (!env().PERMITIR_CADASTRO) {
    return { ok: false, error: 'Os cadastros estao fechados nesta instalacao.' }
  }

  const existing = await db.user.findUnique({ where: { email: input.email } })
  if (existing) {
    return { ok: false, error: 'Ja existe uma conta com este email.' }
  }

  const passwordHash = await hashPassword(input.password)

  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      profile: { create: {} },
      aiConfig: { create: { dailyLimit: env().IA_LIMITE_DIARIO, model: env().IA_MODELO } },
    },
    include: { profile: true },
  })

  await createSession(user.id, userAgent)

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardedAt: null,
      theme: user.profile?.theme ?? 'system',
    },
  }
}

export async function loginUser(
  input: z.infer<typeof loginSchema>,
  userAgent?: string | null,
): Promise<AuthResult> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    include: { profile: true },
  })

  // Mensagem identica para email inexistente e senha errada: nao revela se o
  // email esta cadastrado. O hash falso mantem o tempo de resposta parecido.
  const genericError = 'Email ou senha incorretos.'

  if (!user || user.deletedAt) {
    await verifyPassword(input.password, 'scrypt$65536$8$1$YWJjZA$ZmFrZQ')
    return { ok: false, error: genericError }
  }

  const valid = await verifyPassword(input.password, user.passwordHash)
  if (!valid) {
    return { ok: false, error: genericError }
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await createSession(user.id, userAgent)
  void pruneExpiredSessions()

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      onboardedAt: user.profile?.onboardedAt ?? null,
      theme: user.profile?.theme ?? 'system',
    },
  }
}

/**
 * Usuario da requisicao atual. `cache` garante uma unica consulta por render,
 * mesmo que varios componentes chamem.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => readSession())

/** Para paginas: manda para o login quando nao ha sessao. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser()
  if (!user) redirect('/entrar')
  return user
}

/** Para paginas internas: exige tambem que o onboarding tenha sido concluido. */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.onboardedAt) redirect('/comecar')
  return user
}
