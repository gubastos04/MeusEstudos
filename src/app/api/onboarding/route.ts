import { handler, ok } from '@/lib/api'
import { db } from '@/lib/db'
import { getTrack } from '@/lib/content/loader'
import { toJson } from '@/lib/json'
import { respostaOnboardingSchema, sugerirTrilha } from '@/lib/onboarding'
import { bumpActivity } from '@/lib/progress'

export const POST = handler({ schema: respostaOnboardingSchema }, async ({ user, body }) => {
  // Trilha informada e validada contra o conteudo real; invalida cai na sugestao.
  const trilhaValida = body.trackId && getTrack(body.trackId) ? body.trackId : null
  const trackId =
    trilhaValida ??
    sugerirTrilha({
      hasProgrammedBefore: body.hasProgrammedBefore,
      usedGit: body.usedGit,
      usedDatabase: body.usedDatabase,
      goal: body.goal,
    }).trackId

  await db.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      hasProgrammedBefore: body.hasProgrammedBefore,
      knownLanguages: toJson(body.knownLanguages),
      usedGit: body.usedGit,
      usedDatabase: body.usedDatabase,
      typicalMinutes: body.typicalMinutes,
      goal: body.goal ?? null,
      trackId,
      onboardedAt: new Date(),
    },
    update: {
      hasProgrammedBefore: body.hasProgrammedBefore,
      knownLanguages: toJson(body.knownLanguages),
      usedGit: body.usedGit,
      usedDatabase: body.usedDatabase,
      typicalMinutes: body.typicalMinutes,
      goal: body.goal ?? null,
      trackId,
      onboardedAt: new Date(),
    },
  })

  await bumpActivity(user.id, {})

  return ok({ trackId })
})
