import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { getModule } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { getDemandForUser } from '@/lib/demands'
import { parseBooleanArray } from '@/lib/json'
import { BlocoCodigo, BlocoTerminal } from '@/components/bloco-codigo'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { TrabalhoDemanda } from '@/components/trabalho-demanda'
import { renderizarInline } from '@/components/texto-inline'
import { Aviso, Cartao, Definicoes, Nota, Selo, Titulo } from '@/components/ui'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: `Demanda ${id}` }
}

export default async function PaginaDemanda({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  const demanda = await getDemandForUser(usuario.id, id)
  if (!demanda) notFound()

  const [submissao, statusIa] = await Promise.all([
    db.demandSubmission.findUnique({
      where: { userId_demandId: { userId: usuario.id, demandId: demanda.id } },
    }),
    statusIaParaCliente(usuario.id),
  ])

  const modulos = demanda.moduleIds
    .map((moduleId) => getModule(moduleId))
    .filter((modulo): modulo is NonNullable<typeof modulo> => modulo !== null)

  const inicial = submissao
    ? {
        status: submissao.status,
        entendimento: submissao.understanding,
        plano: submissao.plan,
        solucao: submissao.solution,
        notasDeTeste: submissao.testNotes,
        repositorio: submissao.repoUrl ?? '',
        branch: submissao.branchName ?? '',
        tituloPr: submissao.prTitle ?? '',
        corpoPr: submissao.prBody ?? '',
        aceite: normalizarAceite(parseBooleanArray(submissao.acceptance), demanda.acceptance.length),
        autoRevisao: submissao.selfReview,
      }
    : null

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/demandas" className="text-ink-muted hover:text-ink text-sm">
          ← Demandas
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom="accent">{demanda.type}</Selo>
          <Selo>{demanda.difficulty}</Selo>
          <Selo>prioridade {demanda.priority}</Selo>
          <Selo>~{demanda.estimatedMinutes} min</Selo>
          {demanda.contextQuality === 'incompleto' ? <Selo tom="warn">contexto incompleto</Selo> : null}
        </div>

        <Titulo sub={demanda.summary}>{demanda.title}</Titulo>
      </div>

      {demanda.origin === 'gerada' ? (
        <Aviso titulo="Demanda gerada automaticamente">
          Esta demanda foi criada por IA a partir do seu pedido e passou pela validação de formato da
          plataforma. O conteúdo não foi revisado por uma pessoa: trate como rascunho de ticket.
        </Aviso>
      ) : null}

      {demanda.contextQuality === 'incompleto' ? (
        <Nota titulo="Este pedido não vem pronto">
          Como no trabalho real, o problema não está definido. Antes de implementar, descubra o que está
          acontecendo: o material de investigação está mais abaixo.
        </Nota>
      ) : null}

      <Cartao as="section" className="space-y-4">
        <Definicoes
          itens={[
            { termo: 'Pedido por', valor: demanda.requester },
            { termo: 'Stack', valor: demanda.stack.join(', ') },
            ...(modulos.length > 0
              ? [
                  {
                    termo: 'Ajuda em',
                    valor: (
                      <span className="flex flex-wrap gap-2">
                        {modulos.map((modulo) => (
                          <Link
                            key={modulo.id}
                            href={`/estudar/${modulo.id}`}
                            className="text-accent-ink underline underline-offset-2"
                          >
                            {modulo.title}
                          </Link>
                        ))}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <div className="space-y-2">
          <p className="text-ink-faint text-xs uppercase tracking-wide">Contexto</p>
          <p className="text-ink text-sm leading-relaxed whitespace-pre-line">
            {renderizarInline(demanda.context)}
          </p>
        </div>

        <div className="border-accent/30 bg-accent-soft space-y-1 rounded border p-3">
          <p className="text-accent-ink text-xs font-medium uppercase tracking-wide">Solicitação</p>
          <p className="text-ink text-sm leading-relaxed">{renderizarInline(demanda.request)}</p>
        </div>
      </Cartao>

      {demanda.system ? (
        <section className="space-y-3">
          <h2 className="text-lg">O sistema</h2>
          {demanda.system.description ? (
            <p className="text-ink text-sm leading-relaxed">{renderizarInline(demanda.system.description)}</p>
          ) : null}

          {demanda.system.files.map((arquivo) => (
            <div key={arquivo.path} className="space-y-1.5">
              <p className="text-ink font-mono text-sm break-words">{arquivo.path}</p>
              {arquivo.note ? <p className="text-ink-muted text-sm">{arquivo.note}</p> : null}
              {arquivo.code ? (
                <BlocoCodigo codigo={arquivo.code} linguagem={arquivo.language ?? 'text'} />
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {demanda.investigation ? (
        <section className="space-y-3">
          <h2 className="text-lg">Material de investigação</h2>
          {demanda.investigation.intro ? (
            <p className="text-ink text-sm leading-relaxed">{renderizarInline(demanda.investigation.intro)}</p>
          ) : null}

          {demanda.investigation.logs.length > 0 ? (
            <BlocoTerminal linhas={demanda.investigation.logs} legenda="Trechos de log" />
          ) : null}

          {demanda.investigation.metrics.length > 0 ? (
            <Cartao className="space-y-2">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Números</p>
              <Definicoes
                itens={demanda.investigation.metrics.map((metrica) => ({
                  termo: metrica.label,
                  valor: <span className="tabular-nums">{metrica.value}</span>,
                }))}
              />
            </Cartao>
          ) : null}

          {demanda.investigation.queries.map((consulta) => (
            <div key={consulta.label} className="space-y-1.5">
              <p className="text-ink text-sm font-medium">{consulta.label}</p>
              <BlocoCodigo codigo={consulta.sql} linguagem="sql" />
            </div>
          ))}

          {demanda.investigation.notes.length > 0 ? (
            <Cartao className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Observações</p>
              <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
                {demanda.investigation.notes.map((nota) => (
                  <li key={nota} className="leading-relaxed">
                    {renderizarInline(nota)}
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {demanda.expectedBehavior.length > 0 ? (
          <Cartao className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Comportamento esperado</p>
            <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
              {demanda.expectedBehavior.map((item) => (
                <li key={item} className="leading-relaxed">
                  {renderizarInline(item)}
                </li>
              ))}
            </ul>
          </Cartao>
        ) : null}

        {demanda.constraints.length > 0 ? (
          <Cartao className="space-y-1">
            <p className="text-ink-faint text-xs uppercase tracking-wide">Restrições</p>
            <ul className="text-ink list-disc space-y-1 pl-5 text-sm">
              {demanda.constraints.map((item) => (
                <li key={item} className="leading-relaxed">
                  {renderizarInline(item)}
                </li>
              ))}
            </ul>
          </Cartao>
        ) : null}
      </section>

      {demanda.hints.length > 0 ? (
        <details className="border-line bg-surface-raised rounded-lg border">
          <summary className="text-ink min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
            Dicas ({demanda.hints.length}) — use só se travar
          </summary>
          <ol className="text-ink-muted list-decimal space-y-2 px-4 pb-4 pl-9 text-sm">
            {demanda.hints.map((dica, indice) => (
              <li key={indice} className="leading-relaxed">
                {renderizarInline(dica)}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg">Seu trabalho</h2>
        <TrabalhoDemanda
          demandaId={demanda.id}
          criterios={demanda.acceptance}
          checklistRevisao={demanda.reviewChecklist}
          inicial={inicial}
        />
      </section>

      <FerramentasIa
        status={statusIa}
        contexto={{
          nodeType: 'demand',
          nodeId: demanda.id,
          nodeTitle: demanda.title,
          stack: demanda.stack,
        }}
        ferramentas={['pergunta', 'debugger', 'corretor', 'code-review']}
        codigoAtual={submissao?.solution ?? ''}
      />
    </div>
  )
}

/** Mantém o tamanho da lista de aceite igual ao do conteúdo, mesmo após edição do JSON. */
function normalizarAceite(salvos: boolean[], total: number): boolean[] {
  return Array.from({ length: total }, (_, indice) => salvos[indice] ?? false)
}
