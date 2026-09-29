import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { getAssessment, getModules, getProjects } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { formatDate, formatMinutes } from '@/lib/dates'
import { parseStringArray } from '@/lib/json'
import { getActiveDaysInLast7, getModuleProgress, getTotals } from '@/lib/progress'
import { getReviewItems } from '@/lib/next-step'
import { Cartao, Metrica, Nota, Progresso, Selo, Titulo, Vazio, juntar } from '@/components/ui'

export const metadata: Metadata = { title: 'Progresso' }

export default async function PaginaProgresso() {
  const usuario = await requireOnboardedUser()
  const modulos = getModules()

  const [totais, atividade, progressoModulos, tentativas, projetos, revisao, tecnologias] =
    await Promise.all([
      getTotals(usuario.id),
      getActiveDaysInLast7(usuario.id),
      getModuleProgress(usuario.id, modulos),
      db.assessmentAttempt.findMany({
        where: { userId: usuario.id, status: 'finished' },
        orderBy: { finishedAt: 'desc' },
        take: 12,
      }),
      db.projectProgress.findMany({ where: { userId: usuario.id } }),
      getReviewItems(usuario.id, 5),
      tecnologiasPraticadas(usuario.id),
    ])

  const iniciados = modulos.filter((modulo) => (progressoModulos.get(modulo.id)?.completed ?? 0) > 0)
  const todosProjetos = getProjects()

  return (
    <div className="space-y-8">
      <Titulo sub="Números para informar, não para premiar. Nada aqui é comparado com outras pessoas.">
        Progresso
      </Titulo>

      <section className="space-y-3">
        <Cartao className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metrica rotulo="Conteúdos" valor={totais.lessonsCompleted} detalhe="concluídos" />
          <Metrica rotulo="Exercícios" valor={totais.exercisesDone} detalhe="feitos" />
          <Metrica rotulo="Demandas" valor={totais.demandsCompleted} detalhe="concluídas" />
          <Metrica rotulo="Tempo" valor={formatMinutes(totais.minutesStudied)} detalhe="aproximado" />
        </Cartao>

        <Cartao className="space-y-2">
          <p className="text-ink text-sm font-medium">Atividade</p>
          <p className="text-ink-muted text-sm">
            {atividade.active} {atividade.active === 1 ? 'dia ativo' : 'dias ativos'} nos últimos 7.
          </p>
          <ul className="flex gap-1.5">
            {atividade.days.map((dia) => (
              <li key={dia.day} className="flex-1">
                <div
                  className={juntar(
                    'h-8 rounded border',
                    dia.active ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-sunken',
                  )}
                />
                <span className="sr-only">
                  {dia.day}: {dia.active ? 'estudou' : 'sem registro'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ink-faint text-xs">
            Um dia sem estudar não apaga nada. Não existe sequência para perder.
          </p>
        </Cartao>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Formação</h2>

        {iniciados.length === 0 ? (
          <Nota>Quando você concluir o primeiro conteúdo, o progresso por módulo aparece aqui.</Nota>
        ) : (
          <ul className="space-y-3">
            {iniciados.map((modulo) => {
              const resumo = progressoModulos.get(modulo.id)
              return (
                <li key={modulo.id}>
                  <Link href={`/estudar/${modulo.id}`} className="block space-y-1.5">
                    <Progresso valor={resumo?.percent ?? 0} rotulo={modulo.title} />
                    <p className="text-ink-faint text-xs">
                      {resumo?.completed ?? 0} de {resumo?.total ?? 0} itens
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Tecnologias praticadas</h2>
        {tecnologias.length === 0 ? (
          <Nota>Aparecem aqui conforme você conclui conteúdos e exercícios.</Nota>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tecnologias.map((tecnologia) => (
              <Selo key={tecnologia.nome}>
                {tecnologia.nome} · {tecnologia.total}
              </Selo>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">Projetos</h2>
        {projetos.length === 0 ? (
          <Vazio
            titulo="Nenhum projeto iniciado"
            descricao="Projetos são o que vira portfólio. Cada um evolui por etapas."
          />
        ) : (
          <ul className="space-y-2">
            {projetos.map((progresso) => {
              const projeto = todosProjetos.find((item) => item.id === progresso.projectId)
              const concluidas = parseStringArray(progresso.doneSteps).length
              const total = projeto?.steps.length ?? 0

              return (
                <li key={progresso.id}>
                  <Link
                    href={`/projetos/${progresso.projectId}`}
                    className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-3 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-ink text-sm font-medium">{projeto?.title ?? progresso.projectId}</p>
                      {progresso.publishedAt ? <Selo tom="ok">publicado</Selo> : <Selo>em andamento</Selo>}
                    </div>
                    <p className="text-ink-faint mt-1 text-xs">
                      {concluidas} de {total} etapas
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section id="avaliacoes" className="space-y-3">
        <h2 className="text-lg">Avaliações</h2>

        {tentativas.length === 0 ? (
          <Nota>
            Avaliações aparecem ao final de um conjunto de conteúdos. Elas não valem nota e podem ser
            refeitas.
          </Nota>
        ) : (
          <ul className="space-y-2">
            {tentativas.map((tentativa) => {
              const avaliacao = getAssessment(tentativa.assessmentId)
              const revisar = parseStringArray(tentativa.reviewTopics)

              return (
                <li key={tentativa.id}>
                  <Cartao className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/avaliacoes/${tentativa.assessmentId}`}
                        className="text-ink text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {avaliacao?.title ?? tentativa.assessmentId}
                      </Link>
                      <span className="text-ink-muted text-sm tabular-nums">
                        {tentativa.correctItems} de {tentativa.totalItems}
                      </span>
                    </div>

                    <p className="text-ink-faint text-xs">
                      tentativa {tentativa.attemptNumber} · {formatDate(tentativa.finishedAt)}
                    </p>

                    {revisar.length > 0 ? (
                      <p className="text-ink-muted text-xs">
                        <span className="text-ink-faint">Vale revisar: </span>
                        {revisar.join(', ')}
                      </p>
                    ) : null}
                  </Cartao>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg">O que vale revisar agora</h2>
        <p className="text-ink-muted text-sm">
          Vem do que você errou, registrou ou deixou pela metade. Não é repetição automática.
        </p>

        {revisao.length === 0 ? (
          <Nota>Nada acumulado para revisar. Isso também é informação.</Nota>
        ) : (
          <ul className="space-y-2">
            {revisao.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="border-line bg-surface-raised hover:border-line-strong flex items-start justify-between gap-3 rounded-lg border p-3 transition"
                >
                  <span className="min-w-0">
                    <span className="text-ink block text-sm font-medium">{item.title}</span>
                    <span className="text-ink-muted block text-xs">{item.detail}</span>
                  </span>
                  <span className="text-ink-faint shrink-0 text-xs tabular-nums">~{item.minutes} min</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/**
 * Tecnologias praticadas: contadas a partir dos exercicios realmente tentados,
 * e nao do que o curriculo promete cobrir.
 */
async function tecnologiasPraticadas(userId: string) {
  const tentativas = await db.exerciseAttempt.findMany({
    where: { userId },
    select: { language: true, exerciseId: true },
    distinct: ['exerciseId'],
  })

  const contagem = new Map<string, number>()
  for (const tentativa of tentativas) {
    if (tentativa.language === 'text') continue
    contagem.set(tentativa.language, (contagem.get(tentativa.language) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total)
}
