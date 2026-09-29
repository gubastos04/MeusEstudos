import { randomBytes } from 'node:crypto'

import { hashPassword, hashToken } from './crypto'
import { db } from './db'
import { emailDeRedefinicao, enviarEmail } from './email'
import { env } from './env'
import { revokeAllSessions } from './session'

/**
 * Redefinicao de senha.
 *
 * Decisoes de seguranca:
 * - o token cru so existe no link; o banco guarda apenas o SHA-256;
 * - vale 60 minutos e so pode ser usado uma vez;
 * - pedir um token novo invalida os anteriores daquela conta;
 * - a resposta e sempre a mesma, exista ou nao a conta — caso contrario o
 *   formulario viraria um verificador de quem tem cadastro;
 * - ao redefinir, TODAS as sessoes sao encerradas: quem pede redefinicao
 *   normalmente desconfia de acesso indevido.
 */

const MINUTOS_DE_VALIDADE = 60

/** Mensagem única do pedido: não revela se o email existe. */
export const MENSAGEM_PEDIDO =
  'Se existir uma conta com esse email, enviamos um link para redefinir a senha. O link vale por 60 minutos.'

export type ResultadoPedido = {
  /** Sempre true para quem pede. O detalhe fica no log e no campo abaixo. */
  enviado: boolean
  /** Apenas para log e teste: diz o que realmente aconteceu. */
  detalhe: 'enviado' | 'conta-inexistente' | 'falha-no-envio' | 'sem-transporte'
}

export async function pedirRedefinicao(email: string): Promise<ResultadoPedido> {
  const usuario = await db.user.findUnique({ where: { email } })

  if (!usuario || usuario.deletedAt) {
    // Nenhum token é criado, e a resposta ao cliente é a mesma de sucesso.
    return { enviado: true, detalhe: 'conta-inexistente' }
  }

  // Um pedido novo invalida os anteriores: dois links válidos ao mesmo tempo
  // só ampliam a janela de ataque.
  await db.passwordReset.updateMany({
    where: { userId: usuario.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = randomBytes(32).toString('base64url')

  await db.passwordReset.create({
    data: {
      userId: usuario.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + MINUTOS_DE_VALIDADE * 60 * 1000),
    },
  })

  const base = env().APP_URL || 'http://localhost:3000'
  const link = `${base.replace(/\/$/, '')}/redefinir-senha?token=${token}`

  const email_ = emailDeRedefinicao(usuario.name, link, MINUTOS_DE_VALIDADE)
  const envio = await enviarEmail({ ...email_, para: usuario.email })

  if (!envio.ok) {
    return {
      enviado: true,
      detalhe: envio.motivo === 'transporte não configurado' ? 'sem-transporte' : 'falha-no-envio',
    }
  }

  void limparExpirados()

  return { enviado: true, detalhe: 'enviado' }
}

export type ResultadoRedefinicao =
  | { ok: true; userId: string }
  | { ok: false; erro: string }

export async function redefinirSenha(token: string, novaSenha: string): Promise<ResultadoRedefinicao> {
  const registro = await db.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })

  // Mesma mensagem para token inexistente, usado e vencido: quem tem um token
  // inválido não precisa saber em qual dos casos caiu.
  const invalido = { ok: false as const, erro: 'Este link não vale mais. Peça um novo.' }

  if (!registro) return invalido
  if (registro.usedAt) return invalido
  if (registro.expiresAt.getTime() < Date.now()) return invalido
  if (registro.user.deletedAt) return invalido

  await db.$transaction([
    db.passwordReset.update({
      where: { id: registro.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: registro.userId },
      data: { passwordHash: await hashPassword(novaSenha) },
    }),
  ])

  // Fora da transação de propósito: a senha já mudou e a revogação não pode
  // desfazer isso se falhar.
  await revokeAllSessions(registro.userId)

  return { ok: true, userId: registro.userId }
}

/** O token existe, não foi usado e não venceu? Usado só para orientar a tela. */
export async function tokenUtilizavel(token: string): Promise<boolean> {
  if (!token) return false

  const registro = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } })

  if (!registro) return false
  if (registro.usedAt) return false
  return registro.expiresAt.getTime() >= Date.now()
}

/** Remove pedidos vencidos há mais de um dia. Chamado depois de cada pedido. */
export async function limparExpirados(): Promise<void> {
  await db.passwordReset
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => undefined)
}
