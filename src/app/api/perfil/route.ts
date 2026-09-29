import { z } from 'zod'

import { fail, handler, ok } from '@/lib/api'
import { nameSchema, passwordSchema } from '@/lib/auth'
import { getTrack } from '@/lib/content/loader'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { db } from '@/lib/db'
import { revokeAllSessions } from '@/lib/session'

/**
 * Perfil e preferencias.
 *
 * Trocar a senha encerra as outras sessoes: e o comportamento esperado quando
 * alguem troca a senha justamente por suspeitar de acesso indevido.
 */

const schema = z.object({
  nome: nameSchema.optional(),
  tema: z.enum(['system', 'light', 'dark']).optional(),
  tamanhoFonteCodigo: z.number().int().min(11).max(20).optional(),
  minutosTipicos: z.union([z.literal(10), z.literal(20), z.literal(45)]).optional(),
  trilhaId: z.string().max(80).optional(),
  github: z.string().max(80).optional(),
  linkedin: z.string().max(200).optional(),
  reduzirMovimento: z.boolean().optional(),
  senhaAtual: z.string().max(200).optional(),
  novaSenha: passwordSchema.optional(),
})

export const PATCH = handler({ schema }, async ({ user, body }) => {
  if (body.novaSenha) {
    if (!body.senhaAtual) {
      return fail('Informe a senha atual para trocar a senha.', 422, { campo: 'senhaAtual' })
    }

    const registro = await db.user.findUnique({ where: { id: user.id } })
    if (!registro) return fail('Conta não encontrada.', 404)

    const confere = await verifyPassword(body.senhaAtual, registro.passwordHash)
    if (!confere) {
      return fail('Senha atual incorreta.', 403, { campo: 'senhaAtual' })
    }

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.novaSenha) },
    })

    // Encerra as demais sessoes; a atual continua valida.
    await revokeAllSessions(user.id)
  }

  if (body.nome) {
    await db.user.update({ where: { id: user.id }, data: { name: body.nome } })
  }

  const trilhaValida = body.trilhaId && getTrack(body.trilhaId) ? body.trilhaId : undefined

  if (
    body.tema !== undefined ||
    body.tamanhoFonteCodigo !== undefined ||
    body.minutosTipicos !== undefined ||
    trilhaValida !== undefined ||
    body.linkedin !== undefined ||
    body.reduzirMovimento !== undefined
  ) {
    await db.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...(body.tema !== undefined ? { theme: body.tema } : {}),
        ...(body.tamanhoFonteCodigo !== undefined ? { codeFontSize: body.tamanhoFonteCodigo } : {}),
        ...(body.minutosTipicos !== undefined ? { typicalMinutes: body.minutosTipicos } : {}),
        ...(trilhaValida !== undefined ? { trackId: trilhaValida } : {}),
        ...(body.linkedin !== undefined ? { linkedinUrl: body.linkedin || null } : {}),
        ...(body.reduzirMovimento !== undefined ? { reduceMotion: body.reduzirMovimento } : {}),
      },
      update: {
        ...(body.tema !== undefined ? { theme: body.tema } : {}),
        ...(body.tamanhoFonteCodigo !== undefined ? { codeFontSize: body.tamanhoFonteCodigo } : {}),
        ...(body.minutosTipicos !== undefined ? { typicalMinutes: body.minutosTipicos } : {}),
        ...(trilhaValida !== undefined ? { trackId: trilhaValida } : {}),
        ...(body.linkedin !== undefined ? { linkedinUrl: body.linkedin || null } : {}),
        ...(body.reduzirMovimento !== undefined ? { reduceMotion: body.reduzirMovimento } : {}),
      },
    })
  }

  if (body.github !== undefined) {
    const usuarioGithub = body.github.trim()

    if (usuarioGithub.length === 0) {
      await db.gitHubProfile.deleteMany({ where: { userId: user.id } })
    } else {
      await db.gitHubProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          username: usuarioGithub,
          profileUrl: `https://github.com/${usuarioGithub}`,
        },
        update: { username: usuarioGithub, profileUrl: `https://github.com/${usuarioGithub}` },
      })
    }
  }

  return ok({ atualizado: true })
})
