import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { getProjects } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { formatMinutes } from '@/lib/dates'
import { parseStringArray } from '@/lib/json'
import { Nota, Progresso, Selo, Titulo } from '@/components/ui'

export const metadata: Metadata = { title: 'Projetos' }

export default async function PaginaProjetos() {
  const usuario = await requireOnboardedUser()

  const projetos = getProjects()
  const progressos = await db.projectProgress.findMany({ where: { userId: usuario.id } })
  const porProjeto = new Map(progressos.map((progresso) => [progresso.projectId, progresso]))

  return (
    <div className="space-y-6">
      <Titulo sub="Sistemas que poderiam existir numa empresa. Cada um evolui por etapas, com entregável próprio.">
        Projetos
      </Titulo>

      <Nota>
        Projeto não termina numa sessão. A ideia é justamente sentir a evolução de um software real:
        requisitos, banco, autenticação, testes, logs, segurança, deploy e documentação.
      </Nota>

      <ul className="space-y-3">
        {projetos.map((projeto) => {
          const progresso = porProjeto.get(projeto.id)
          const concluidas = progresso ? parseStringArray(progresso.doneSteps).length : 0
          const minutos = projeto.steps.reduce((soma, etapa) => soma + etapa.estimatedMinutes, 0)

          return (
            <li key={projeto.id}>
              <Link
                href={`/projetos/${projeto.id}`}
                className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-4 transition"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Selo>{projeto.difficulty}</Selo>
                  <Selo>{projeto.steps.length} etapas</Selo>
                  <Selo>{formatMinutes(minutos)}</Selo>
                  {progresso?.publishedAt ? <Selo tom="ok">publicado</Selo> : null}
                  {progresso && !progresso.publishedAt ? <Selo tom="accent">em andamento</Selo> : null}
                </div>

                <h2 className="text-ink mt-2 text-base font-semibold">{projeto.title}</h2>
                <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{projeto.summary}</p>

                <p className="text-ink-faint mt-2 text-xs">{projeto.stack.join(' · ')}</p>

                {progresso ? (
                  <div className="mt-3 space-y-1">
                    <Progresso
                      valor={(concluidas / projeto.steps.length) * 100}
                      mostrarNumero={false}
                    />
                    <p className="text-ink-faint text-xs">
                      {concluidas} de {projeto.steps.length} etapas concluídas
                    </p>
                  </div>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
