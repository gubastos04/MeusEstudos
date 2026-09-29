import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { getChallenge } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { getProgressMap, progressOf } from '@/lib/progress'
import { Desafio } from '@/components/desafio'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { renderizarInline } from '@/components/texto-inline'
import { Cartao, Selo, Titulo } from '@/components/ui'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: getChallenge(id)?.title ?? 'Desafio' }
}

export default async function PaginaDesafio({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  const desafio = getChallenge(id)
  if (!desafio) notFound()

  const [progresso, statusIa, perfil] = await Promise.all([
    getProgressMap(usuario.id, 'challenge'),
    statusIaParaCliente(usuario.id),
    db.userProfile.findUnique({ where: { userId: usuario.id }, select: { codeFontSize: true } }),
  ])

  const resolvido = progressOf(progresso, 'challenge', desafio.id)?.status === 'completed'

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/desafios" className="text-ink-muted hover:text-ink text-sm">
          ← Desafios
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom="accent">{desafio.category}</Selo>
          <Selo>{desafio.difficulty}</Selo>
          <Selo>~{desafio.estimatedMinutes} min</Selo>
          {resolvido ? <Selo tom="ok">resolvido</Selo> : null}
        </div>

        <Titulo>{desafio.title}</Titulo>
      </div>

      <Cartao as="section" className="space-y-3">
        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Contexto</p>
          <p className="text-ink text-sm leading-relaxed whitespace-pre-line">
            {renderizarInline(desafio.context)}
          </p>
        </div>

        <div className="border-accent/30 bg-accent-soft space-y-1 rounded border p-3">
          <p className="text-accent-ink text-xs font-medium uppercase tracking-wide">Objetivo</p>
          <p className="text-ink text-sm leading-relaxed">{renderizarInline(desafio.objective)}</p>
        </div>

        {desafio.constraints.length > 0 ? (
          <div className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Restrições</p>
            <ul className="text-ink list-disc space-y-0.5 pl-5 text-sm">
              {desafio.constraints.map((restricao) => (
                <li key={restricao} className="leading-relaxed">
                  {renderizarInline(restricao)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Critérios de aceitação</p>
          <ul className="text-ink list-disc space-y-0.5 pl-5 text-sm">
            {desafio.acceptance.map((criterio) => (
              <li key={criterio} className="leading-relaxed">
                {renderizarInline(criterio)}
              </li>
            ))}
          </ul>
        </div>
      </Cartao>

      <Desafio
        desafioId={desafio.id}
        linguagem={desafio.language}
        inicial={desafio.starter}
        testes={desafio.tests}
        verificacoes={desafio.checks}
        dicas={desafio.hints}
        solucao={desafio.solution}
        notasDaSolucao={desafio.solutionNotes}
        concluido={resolvido}
        tamanhoFonte={perfil?.codeFontSize ?? 14}
      />

      <FerramentasIa
        status={statusIa}
        contexto={{
          nodeType: 'challenge',
          nodeId: desafio.id,
          nodeTitle: desafio.title,
          language: desafio.language,
          stack: desafio.stack,
        }}
        ferramentas={['explicar', 'pergunta', 'corretor']}
      />
    </div>
  )
}
