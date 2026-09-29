import type { Metadata } from 'next'

import { requireOnboardedUser } from '@/lib/auth'
import { getAiStatus } from '@/lib/ai/limits'
import { getTracks } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { getTotals } from '@/lib/progress'
import { PainelPerfil } from '@/components/painel-perfil'
import { Cartao, Metrica, Titulo } from '@/components/ui'

export const metadata: Metadata = { title: 'Perfil' }

export default async function PaginaPerfil() {
  const usuario = await requireOnboardedUser()

  const [perfil, github, statusIa, totais] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: usuario.id } }),
    db.gitHubProfile.findUnique({ where: { userId: usuario.id } }),
    getAiStatus(usuario.id),
    getTotals(usuario.id),
  ])

  const trilhas = getTracks().map((trilha) => ({
    id: trilha.id,
    title: trilha.title,
    summary: trilha.summary,
  }))

  return (
    <div className="space-y-6">
      <Titulo sub={usuario.email}>{usuario.name}</Titulo>

      <Cartao className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metrica rotulo="Conteúdos" valor={totais.lessonsCompleted} />
        <Metrica rotulo="Exercícios" valor={totais.exercisesDone} />
        <Metrica rotulo="Anotações" valor={totais.notes} />
        <Metrica rotulo="Erros" valor={totais.errorsLogged} />
      </Cartao>

      <PainelPerfil
        nome={usuario.name}
        email={usuario.email}
        tema={perfil?.theme ?? 'system'}
        tamanhoFonteCodigo={perfil?.codeFontSize ?? 14}
        minutosTipicos={perfil?.typicalMinutes ?? 20}
        trilhaId={perfil?.trackId ?? null}
        trilhas={trilhas}
        github={github?.username ?? ''}
        linkedin={perfil?.linkedinUrl ?? ''}
        ia={{
          configurada: statusIa.configured,
          habilitada: statusIa.enabled,
          origem: statusIa.source === 'usuario' ? 'sua chave' : 'chave do servidor',
          modelo: statusIa.model,
          limiteDiario: statusIa.dailyLimit,
          usadasHoje: statusIa.usedToday,
          dicaChave: statusIa.source === 'usuario' ? statusIa.keyHint : null,
        }}
      />
    </div>
  )
}
