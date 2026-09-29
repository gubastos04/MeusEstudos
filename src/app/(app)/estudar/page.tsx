import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { getModulesBySemester, getTrack } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { formatMinutes } from '@/lib/dates'
import { getModuleProgress } from '@/lib/progress'
import { Nota, Progresso, Selo, Titulo } from '@/components/ui'

export const metadata: Metadata = { title: 'Estudar' }

export default async function PaginaEstudar() {
  const usuario = await requireOnboardedUser()
  const porSemestre = getModulesBySemester()
  const todos = porSemestre.flatMap((grupo) => grupo.modules)

  const [progresso, perfil] = await Promise.all([
    getModuleProgress(usuario.id, todos),
    db.userProfile.findUnique({ where: { userId: usuario.id } }),
  ])

  const trilha = perfil?.trackId ? getTrack(perfil.trackId) : null
  const naTrilha = new Set(trilha?.moduleIds ?? [])

  return (
    <div className="space-y-8">
      <Titulo sub="Vinte módulos, do zero ao que aparece no trabalho. A ordem é sugestão, não regra.">
        Estudar
      </Titulo>

      {trilha ? (
        <Nota titulo={`Seu caminho: ${trilha.title}`}>
          {trilha.summary} Os módulos do caminho aparecem marcados. Você pode estudar qualquer um, em qualquer ordem.
        </Nota>
      ) : null}

      {porSemestre.map((grupo) => (
        <section key={grupo.semester} className="space-y-3">
          <h2 className="text-ink-faint text-xs font-medium uppercase tracking-wide">
            {grupo.semester}º semestre
          </h2>

          <ul className="grid gap-3 sm:grid-cols-2">
            {grupo.modules.map((modulo) => {
              const resumo = progresso.get(modulo.id)
              const concluido = resumo?.completed ?? 0
              const total = resumo?.total ?? modulo.items.length

              return (
                <li key={modulo.id}>
                  <Link
                    href={`/estudar/${modulo.id}`}
                    className="border-line bg-surface-raised hover:border-line-strong flex h-full flex-col gap-3 rounded-lg border p-4 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {naTrilha.has(modulo.id) ? <Selo tom="accent">no seu caminho</Selo> : null}
                        <Selo>{formatMinutes(modulo.totalMinutes)}</Selo>
                        <Selo>
                          {total} {total === 1 ? 'item' : 'itens'}
                        </Selo>
                      </div>
                      <h3 className="text-ink text-base font-semibold">{modulo.title}</h3>
                      <p className="text-ink-muted text-sm leading-relaxed">{modulo.summary}</p>
                    </div>

                    <div className="mt-auto space-y-1">
                      <Progresso valor={resumo?.percent ?? 0} />
                      <p className="text-ink-faint text-xs">
                        {concluido} de {total} concluídos
                        {resumo && resumo.inProgress > 0 ? ` · ${resumo.inProgress} em andamento` : ''}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
