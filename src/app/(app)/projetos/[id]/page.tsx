import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { getModule, getProject } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { parseRecord, parseStringArray } from '@/lib/json'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { TrabalhoProjeto } from '@/components/trabalho-projeto'
import { renderizarInline } from '@/components/texto-inline'
import { Cartao, Nota, Selo, Titulo } from '@/components/ui'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: getProject(id)?.title ?? 'Projeto' }
}

export default async function PaginaProjeto({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  const projeto = getProject(id)
  if (!projeto) notFound()

  const [progresso, statusIa] = await Promise.all([
    db.projectProgress.findUnique({
      where: { userId_projectId: { userId: usuario.id, projectId: projeto.id } },
    }),
    statusIaParaCliente(usuario.id),
  ])

  const modulosRelacionados = [...new Set(projeto.steps.flatMap((etapa) => etapa.moduleIds))]
    .map((moduleId) => getModule(moduleId))
    .filter((modulo): modulo is NonNullable<typeof modulo> => modulo !== null)

  const inicial = progresso
    ? {
        etapaAtual: progresso.currentStep,
        concluidas: parseStringArray(progresso.doneSteps),
        checklist: parseRecord(progresso.checklist),
        repositorio: progresso.repoUrl ?? '',
        deploy: progresso.deployUrl ?? '',
        notas: progresso.notes,
        problema: progresso.problem,
        decisoes: progresso.decisions,
        dificuldades: progresso.difficulties,
        aprendizados: progresso.learnings,
        publicado: progresso.publishedAt !== null,
      }
    : null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/projetos" className="text-ink-muted hover:text-ink text-sm">
          ← Projetos
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo>{projeto.difficulty}</Selo>
          <Selo>{projeto.steps.length} etapas</Selo>
          {progresso?.publishedAt ? <Selo tom="ok">publicado</Selo> : null}
        </div>

        <Titulo sub={projeto.summary}>{projeto.title}</Titulo>
      </div>

      <Cartao as="section" className="space-y-3">
        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Problema que resolve</p>
          <p className="text-ink text-sm leading-relaxed">{renderizarInline(projeto.problem)}</p>
        </div>

        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Funcionalidades</p>
          <ul className="text-ink grid gap-1 pl-5 text-sm sm:grid-cols-2">
            {projeto.features.map((funcionalidade) => (
              <li key={funcionalidade} className="list-disc leading-relaxed">
                {funcionalidade}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {projeto.stack.map((tecnologia) => (
              <Selo key={tecnologia}>{tecnologia}</Selo>
            ))}
          </div>
        </div>

        {projeto.architectureNotes ? (
          <Nota titulo="Arquitetura">{renderizarInline(projeto.architectureNotes)}</Nota>
        ) : null}

        {modulosRelacionados.length > 0 ? (
          <div className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Conteúdo que ajuda</p>
            <div className="flex flex-wrap gap-2">
              {modulosRelacionados.map((modulo) => (
                <Link
                  key={modulo.id}
                  href={`/estudar/${modulo.id}`}
                  className="text-accent-ink text-sm underline underline-offset-2"
                >
                  {modulo.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Cartao>

      <section className="space-y-3">
        <h2 className="text-lg">Etapas</h2>
        <TrabalhoProjeto
          projetoId={projeto.id}
          etapas={projeto.steps}
          checklistQualidade={projeto.portfolio.qualityChecklist}
          rascunhoLinkedin={projeto.portfolio.linkedinDraft}
          roteiroReadme={projeto.portfolio.readmeOutline}
          inicial={inicial}
        />
      </section>

      <FerramentasIa
        status={statusIa}
        contexto={{
          nodeType: 'project',
          nodeId: projeto.id,
          nodeTitle: projeto.title,
          stack: projeto.stack,
        }}
        ferramentas={['pergunta', 'code-review', 'debugger']}
      />
    </div>
  )
}
