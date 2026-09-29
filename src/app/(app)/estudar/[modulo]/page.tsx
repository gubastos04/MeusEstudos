import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { getModule } from '@/lib/content/loader'
import { formatMinutes } from '@/lib/dates'
import { getProgressMap, progressOf } from '@/lib/progress'
import { BaixarModulo } from '@/components/baixar-modulo'
import { BotaoLink, Cartao, Nota, Progresso, Selo, Titulo, juntar } from '@/components/ui'

type Props = { params: Promise<{ modulo: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modulo } = await params
  const encontrado = getModule(modulo)
  return { title: encontrado?.title ?? 'Módulo' }
}

export default async function PaginaModulo({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { modulo: moduloId } = await params
  const modulo = getModule(moduloId)

  if (!modulo) notFound()

  const progresso = await getProgressMap(usuario.id)

  const concluidos = modulo.items.filter(
    (item) => progressOf(progresso, item.type, item.id)?.status === 'completed',
  ).length

  const proximo =
    modulo.items.find((item) => progressOf(progresso, item.type, item.id)?.status === 'in_progress') ??
    modulo.items.find((item) => !progressOf(progresso, item.type, item.id))

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/estudar" className="text-ink-muted hover:text-ink text-sm">
          ← Estudar
        </Link>

        <Titulo sub={modulo.summary}>{modulo.title}</Titulo>

        <div className="flex flex-wrap gap-1.5">
          <Selo>{modulo.semester}º semestre</Selo>
          <Selo>{formatMinutes(modulo.totalMinutes)}</Selo>
          {modulo.stack.map((tecnologia) => (
            <Selo key={tecnologia}>{tecnologia}</Selo>
          ))}
        </div>

        <Nota titulo="O que você consegue fazer depois deste módulo">{modulo.outcome}</Nota>

        <Progresso
          valor={modulo.items.length === 0 ? 0 : (concluidos / modulo.items.length) * 100}
          rotulo={`${concluidos} de ${modulo.items.length} concluídos`}
        />

        {proximo ? (
          <BotaoLink href={`/estudar/${modulo.id}/${proximo.id}`} variante="primario">
            {progressOf(progresso, proximo.type, proximo.id) ? 'Retomar' : 'Começar'}: {proximo.title}
          </BotaoLink>
        ) : (
          <Nota>Você concluiu todos os itens deste módulo. Refazer qualquer um não apaga nada.</Nota>
        )}
      </div>

      <BaixarModulo moduloId={modulo.id} titulo={modulo.title} />

      <section className="space-y-2">
        <h2 className="text-lg">Conteúdo</h2>
        <ol className="space-y-2">
          {modulo.items.map((item, indice) => {
            const estado = progressOf(progresso, item.type, item.id)
            const concluido = estado?.status === 'completed'
            const emAndamento = estado?.status === 'in_progress'

            return (
              <li key={item.id}>
                <Link
                  href={`/estudar/${modulo.id}/${item.id}`}
                  className={juntar(
                    'border-line bg-surface-raised hover:border-line-strong flex items-start gap-3 rounded-lg border p-3 transition',
                    concluido && 'opacity-80',
                  )}
                >
                  <span
                    className={juntar(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                      concluido
                        ? 'border-ok/40 bg-ok-soft text-ok-ink'
                        : emAndamento
                          ? 'border-accent/40 bg-accent-soft text-accent-ink'
                          : 'border-line text-ink-faint',
                    )}
                    aria-hidden="true"
                  >
                    {concluido ? '✓' : indice + 1}
                  </span>

                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-ink text-sm font-medium">{item.title}</span>
                      {item.type === 'checkpoint' ? <Selo>ponto de parada</Selo> : null}
                      {item.type === 'lesson' && item.exercise ? <Selo tom="accent">exercício</Selo> : null}
                    </span>
                    <span className="text-ink-muted block text-xs">
                      {item.estimatedMinutes} min
                      {concluido ? ' · concluído' : emAndamento ? ' · em andamento' : ''}
                    </span>
                    {item.type === 'lesson' ? (
                      <span className="text-ink-muted block text-sm leading-relaxed">{item.why}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </section>

      {modulo.assessments.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Avaliações</h2>
          <p className="text-ink-muted text-sm">
            Aparecem ao final de um conjunto de conteúdos. Não valem nota e podem ser refeitas.
          </p>

          <ul className="space-y-2">
            {modulo.assessments.map((avaliacao) => (
              <li key={avaliacao.id}>
                <Cartao as="article" className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Selo tom={avaliacao.format === 'pratica' ? 'accent' : 'neutro'}>
                      {avaliacao.format === 'pratica' ? 'prática' : 'alternativa'}
                    </Selo>
                    <Selo>{avaliacao.estimatedMinutes} min</Selo>
                    <Selo>
                      {avaliacao.questions.length}{' '}
                      {avaliacao.format === 'pratica' ? 'tarefas' : 'questões'}
                    </Selo>
                  </div>

                  <h3 className="text-ink text-base font-semibold">{avaliacao.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{avaliacao.summary}</p>

                  <p className="text-ink-faint text-xs">Avalia: {avaliacao.topics.join(', ')}</p>

                  <BotaoLink href={`/avaliacoes/${avaliacao.id}`} variante="secundario" tamanho="sm">
                    Abrir avaliação
                  </BotaoLink>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
