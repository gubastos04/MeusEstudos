import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { findGlossaryTerm, findItem, getModule } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { getProgressMap, progressOf } from '@/lib/progress'
import { Blocos } from '@/components/blocos'
import { Exercicio } from '@/components/exercicio'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { GlossarioInline, type TermoResumido } from '@/components/glossario-inline'
import { RegistroEstudo } from '@/components/registro-estudo'
import { RespostaTenteAgora } from '@/components/resposta-tente-agora'
import { renderizarInline } from '@/components/texto-inline'
import { AtalhosDeRegistro } from '@/components/atalhos-registro'
import { Cartao, Nota, Selo } from '@/components/ui'

type Props = { params: Promise<{ modulo: string; item: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await params
  const encontrado = findItem(item)
  return { title: encontrado?.item.title ?? 'Conteúdo' }
}

export default async function PaginaItem({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { modulo: moduloId, item: itemId } = await params

  const modulo = getModule(moduloId)
  const localizacao = findItem(itemId)

  // O item tem de pertencer ao modulo da URL: evita link inconsistente.
  if (!modulo || !localizacao || localizacao.module.id !== modulo.id) notFound()

  const { item, previous, next } = localizacao

  const [progresso, statusIa, tentativa, perfil, respostaTenteAgora] = await Promise.all([
    getProgressMap(usuario.id),
    statusIaParaCliente(usuario.id),
    item.type === 'lesson' && item.exercise
      ? db.exerciseAttempt.findFirst({
          where: { userId: usuario.id, exerciseId: item.exercise.id },
          orderBy: { createdAt: 'desc' },
          select: { code: true },
        })
      : Promise.resolve(null),
    db.userProfile.findUnique({ where: { userId: usuario.id }, select: { codeFontSize: true } }),
    // O que a pessoa escreveu no "Tente agora" desta aula, para ela voltar e
    // continuar em vez de recomeçar.
    item.type === 'lesson' && item.tryNow
      ? db.note.findFirst({
          where: { userId: usuario.id, nodeType: 'tente-agora', nodeId: item.id },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, body: true },
        })
      : Promise.resolve(null),
  ])

  const estado = progressOf(progresso, item.type, item.id)
  const concluido = estado?.status === 'completed'

  const termos: TermoResumido[] =
    item.type === 'lesson'
      ? item.glossary
          .map((referencia) => findGlossaryTerm(referencia))
          .filter((termo): termo is NonNullable<typeof termo> => termo !== null)
          .map((termo) => ({
            id: termo.id,
            term: termo.term,
            short: termo.short,
            explanation: termo.explanation,
            example: termo.example ?? null,
            whereItAppears: termo.whereItAppears,
          }))
      : []

  const contextoIa = {
    moduleId: modulo.id,
    moduleTitle: modulo.title,
    nodeType: item.type,
    nodeId: item.id,
    nodeTitle: item.title,
    language: item.type === 'lesson' ? item.exercise?.language : undefined,
    stack: modulo.stack,
  }

  return (
    <article className="space-y-6">
      <div className="space-y-3">
        <Link href={`/estudar/${modulo.id}`} className="text-ink-muted hover:text-ink text-sm">
          ← {modulo.title}
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo>{item.estimatedMinutes} min</Selo>
          {item.type === 'checkpoint' ? <Selo>ponto de parada</Selo> : null}
          {concluido ? <Selo tom="ok">concluído</Selo> : null}
          {estado?.status === 'in_progress' ? <Selo tom="accent">retomado</Selo> : null}
        </div>

        <h1 className="text-2xl">{item.title}</h1>
      </div>

      {item.type === 'lesson' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Cartao className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">Por que isso existe</p>
              <p className="text-ink text-sm leading-relaxed">{renderizarInline(item.why)}</p>
            </Cartao>
            <Cartao className="space-y-1">
              <p className="text-ink-faint text-xs uppercase tracking-wide">O que você vai fazer</p>
              <p className="text-ink text-sm leading-relaxed">{renderizarInline(item.goal)}</p>
            </Cartao>
          </div>

          <div className="leitura space-y-4">
            {item.blocks.map((bloco, indice) => (
              <div key={indice} data-bloco={indice}>
                <Blocos blocos={[bloco]} />
              </div>
            ))}
          </div>

          {item.tryNow ? (
            <section className="border-accent/30 bg-accent-soft space-y-2 rounded-lg border p-4">
              <p className="text-accent-ink text-xs font-medium uppercase tracking-wide">Tente agora</p>
              <p className="text-ink text-sm leading-relaxed whitespace-pre-line">
                {renderizarInline(item.tryNow.instructions)}
              </p>
              {item.tryNow.expected ? (
                <p className="text-ink-muted text-sm">
                  <span className="text-ink-faint">Resultado esperado: </span>
                  {renderizarInline(item.tryNow.expected)}
                </p>
              ) : null}

              <RespostaTenteAgora
                moduloId={modulo.id}
                itemId={item.id}
                tituloDoItem={item.title}
                inicial={
                  respostaTenteAgora
                    ? { id: respostaTenteAgora.id, corpo: respostaTenteAgora.body }
                    : null
                }
              />
            </section>
          ) : null}

          {item.ifStuck.length > 0 ? (
            <details className="border-line bg-surface-raised rounded-lg border">
              <summary className="text-ink min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
                Se travar
              </summary>
              <ul className="text-ink-muted list-disc space-y-1.5 px-4 pb-4 pl-9 text-sm">
                {item.ifStuck.map((dica, indice) => (
                  <li key={indice} className="leading-relaxed">
                    {renderizarInline(dica)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {item.commonErrors.length > 0 ? (
            <section className="space-y-2">
              <h2 className="text-lg">Erro comum</h2>
              <ul className="space-y-2">
                {item.commonErrors.map((erro, indice) => (
                  <li key={indice}>
                    <Cartao className="space-y-2">
                      <p className="text-danger-ink font-mono text-sm break-words">{erro.error}</p>
                      <div className="space-y-1 text-sm">
                        <p className="text-ink-muted">
                          <span className="text-ink-faint">Por que: </span>
                          {renderizarInline(erro.why)}
                        </p>
                        <p className="text-ink">
                          <span className="text-ink-faint">Como resolver: </span>
                          {renderizarInline(erro.fix)}
                        </p>
                      </div>
                    </Cartao>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {item.exercise ? (
            <Exercicio
              exercicio={item.exercise}
              moduloId={modulo.id}
              aulaId={item.id}
              codigoSalvo={tentativa?.code ?? null}
              tamanhoFonte={perfil?.codeFontSize ?? 14}
            />
          ) : null}

          <GlossarioInline termos={termos} />
        </>
      ) : (
        <>
          <div className="leitura space-y-4">
            <p className="text-ink leading-relaxed">{renderizarInline(item.summary)}</p>

            <section className="space-y-2">
              <h2 className="text-lg">O que você viu até aqui</h2>
              <ul className="text-ink marker:text-ink-faint list-disc space-y-1.5 pl-5">
                {item.learned.map((aprendido, indice) => (
                  <li key={indice} className="leading-relaxed">
                    {renderizarInline(aprendido)}
                  </li>
                ))}
              </ul>
            </section>

            {item.nextUp ? <Nota titulo="O que vem agora">{renderizarInline(item.nextUp)}</Nota> : null}
          </div>
        </>
      )}

      <FerramentasIa
        status={statusIa}
        contexto={contextoIa}
        ferramentas={['explicar', 'pergunta', 'debugger', 'corretor']}
      />

      <AtalhosDeRegistro
        contexto={{
          moduloId: modulo.id,
          nodeType: item.type,
          nodeId: item.id,
          titulo: item.title,
        }}
      />

      <RegistroEstudo
        tipo={item.type}
        id={item.id}
        moduloId={modulo.id}
        concluido={concluido}
        proximoHref={next ? `/estudar/${modulo.id}/${next.id}` : null}
        proximoTitulo={next?.title ?? null}
        moduloHref={`/estudar/${modulo.id}`}
      />

      <nav aria-label="Navegação do módulo" className="flex items-center justify-between gap-3 text-sm">
        {previous ? (
          <Link href={`/estudar/${modulo.id}/${previous.id}`} className="text-ink-muted hover:text-ink">
            ← {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/estudar/${modulo.id}/${next.id}`} className="text-ink-muted hover:text-ink text-right">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
