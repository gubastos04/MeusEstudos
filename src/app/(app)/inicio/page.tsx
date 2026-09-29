import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { getDemand, getProject } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { formatMinutes, relativeTime } from '@/lib/dates'
import { getNextStep } from '@/lib/next-step'
import { getActiveDaysInLast7, getTotals } from '@/lib/progress'
import { TenhoTempo } from '@/components/tenho-tempo'
import { BotaoLink, Cartao, Metrica, Nota, Selo, Vazio, juntar } from '@/components/ui'

export const metadata: Metadata = { title: 'Início' }

export default async function PaginaInicio() {
  const usuario = await requireOnboardedUser()

  const [proximoPasso, atividade, totais, perfil, ultimoErro, ultimaNota, ultimaDemanda, ultimoProjeto] =
    await Promise.all([
      getNextStep(usuario.id),
      getActiveDaysInLast7(usuario.id),
      getTotals(usuario.id),
      db.userProfile.findUnique({ where: { userId: usuario.id } }),
      db.errorRecord.findFirst({ where: { userId: usuario.id }, orderBy: { createdAt: 'desc' } }),
      db.note.findFirst({ where: { userId: usuario.id }, orderBy: { updatedAt: 'desc' } }),
      db.demandSubmission.findFirst({ where: { userId: usuario.id }, orderBy: { updatedAt: 'desc' } }),
      db.projectProgress.findFirst({ where: { userId: usuario.id }, orderBy: { updatedAt: 'desc' } }),
    ])

  const primeiroNome = usuario.name.split(' ')[0] ?? usuario.name

  // Titulos legiveis: o banco guarda o id do conteudo, o titulo vem de /content.
  const tituloDemanda = ultimaDemanda ? (getDemand(ultimaDemanda.demandId)?.title ?? 'Demanda gerada por IA') : null
  const tituloProjeto = ultimoProjeto ? (getProject(ultimoProjeto.projectId)?.title ?? ultimoProjeto.projectId) : null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl">Olá, {primeiroNome}</h1>
        <p className="text-ink-muted text-sm">
          {atividade.active === 0
            ? 'Comece por onde quiser. O progresso é acumulativo.'
            : `${atividade.active} ${atividade.active === 1 ? 'dia ativo' : 'dias ativos'} nos últimos 7.`}
        </p>
      </div>

      {/* Continue de onde parou: um unico proximo passo, nunca uma lista. */}
      <section aria-labelledby="proximo-passo" className="space-y-2">
        <h2 id="proximo-passo" className="text-ink-faint text-xs font-medium uppercase tracking-wide">
          Continue de onde parou
        </h2>

        {proximoPasso ? (
          <Cartao className="space-y-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Selo tom="accent">{proximoPasso.action}</Selo>
                <Selo>~{proximoPasso.minutes} min</Selo>
                {proximoPasso.moduleTitle ? <Selo>{proximoPasso.moduleTitle}</Selo> : null}
              </div>
              <p className="text-ink text-base font-semibold">{proximoPasso.title}</p>
              <p className="text-ink-muted text-sm">{proximoPasso.reason}</p>
            </div>

            <BotaoLink href={proximoPasso.href} variante="primario">
              {proximoPasso.action}
            </BotaoLink>
          </Cartao>
        ) : (
          <Vazio
            titulo="Nada em andamento"
            descricao="Escolha um módulo para começar. O primeiro bloco leva poucos minutos."
            acao={
              <BotaoLink href="/estudar" variante="primario">
                Ver módulos
              </BotaoLink>
            }
          />
        )}
      </section>

      <TenhoTempo minutosPreferidos={perfil?.typicalMinutes ?? 20} />

      {/* Progresso: metricas informam, nao premiam. */}
      <section aria-labelledby="seu-progresso" className="space-y-3">
        <h2 id="seu-progresso" className="text-ink-faint text-xs font-medium uppercase tracking-wide">
          Progresso
        </h2>

        <Cartao className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metrica rotulo="Conteúdos" valor={totais.lessonsCompleted} detalhe="concluídos" />
          <Metrica rotulo="Exercícios" valor={totais.exercisesDone} detalhe="feitos" />
          <Metrica rotulo="Demandas" valor={totais.demandsCompleted} detalhe="concluídas" />
          <Metrica rotulo="Projetos" valor={totais.projectsStarted} detalhe={`${totais.projectsPublished} publicado(s)`} />
        </Cartao>

        <Cartao className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-ink text-sm font-medium">Últimos 7 dias</p>
            <p className="text-ink-muted text-sm tabular-nums">
              {atividade.active} de 7 dias ativos
            </p>
          </div>

          {/* Sem streak e sem contador de dias perdidos: dia sem estudo e neutro. */}
          <ul className="flex gap-1.5">
            {atividade.days.map((dia) => (
              <li key={dia.day} className="flex-1">
                <div
                  className={juntar(
                    'h-8 rounded border',
                    dia.active ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-sunken',
                  )}
                  title={`${dia.day}${dia.active ? ' · estudou' : ''}`}
                />
                <span className="sr-only">
                  {dia.day}: {dia.active ? 'estudou' : 'sem registro'}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-ink-faint text-xs">
            O número que importa não é a sequência perfeita. É o total que não volta pra trás.
          </p>
        </Cartao>

        <div className="grid gap-3 sm:grid-cols-3">
          <Cartao>
            <Metrica rotulo="Tempo estudado" valor={formatMinutes(totais.minutesStudied)} detalhe="aproximado" />
          </Cartao>
          <Cartao>
            <Metrica rotulo="Erros registrados" valor={totais.errorsLogged} detalhe="viram revisão" />
          </Cartao>
          <Cartao>
            <Metrica rotulo="Avaliações feitas" valor={totais.assessmentsTaken} detalhe="sem nota, sem ranking" />
          </Cartao>
        </div>
      </section>

      {/* Ultimos registros */}
      <section aria-labelledby="ultimos-registros" className="space-y-2">
        <h2 id="ultimos-registros" className="text-ink-faint text-xs font-medium uppercase tracking-wide">
          Últimos registros
        </h2>

        {!ultimoErro && !ultimaNota && !ultimaDemanda && !ultimoProjeto ? (
          <Nota>
            Quando você registrar um erro, uma anotação, uma demanda ou um projeto, eles aparecem aqui.
          </Nota>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ultimoErro ? (
              <li>
                <Link
                  href={`/erros/${ultimoErro.id}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-3 transition"
                >
                  <p className="text-ink-faint text-xs uppercase tracking-wide">Último erro</p>
                  <p className="text-ink mt-0.5 text-sm font-medium">{ultimoErro.title}</p>
                  <p className="text-ink-muted text-xs">{relativeTime(ultimoErro.createdAt)}</p>
                </Link>
              </li>
            ) : null}

            {ultimaNota ? (
              <li>
                <Link
                  href={`/anotacoes/${ultimaNota.id}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-3 transition"
                >
                  <p className="text-ink-faint text-xs uppercase tracking-wide">Última anotação</p>
                  <p className="text-ink mt-0.5 text-sm font-medium">{ultimaNota.title}</p>
                  <p className="text-ink-muted text-xs">{relativeTime(ultimaNota.updatedAt)}</p>
                </Link>
              </li>
            ) : null}

            {ultimaDemanda ? (
              <li>
                <Link
                  href={`/demandas/${ultimaDemanda.demandId}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-3 transition"
                >
                  <p className="text-ink-faint text-xs uppercase tracking-wide">Última demanda</p>
                  <p className="text-ink mt-0.5 text-sm font-medium">{tituloDemanda}</p>
                  <p className="text-ink-muted text-xs">
                    {ultimaDemanda.status} · {relativeTime(ultimaDemanda.updatedAt)}
                  </p>
                </Link>
              </li>
            ) : null}

            {ultimoProjeto ? (
              <li>
                <Link
                  href={`/projetos/${ultimoProjeto.projectId}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-3 transition"
                >
                  <p className="text-ink-faint text-xs uppercase tracking-wide">Último projeto</p>
                  <p className="text-ink mt-0.5 text-sm font-medium">{tituloProjeto}</p>
                  <p className="text-ink-muted text-xs">
                    etapa {ultimoProjeto.currentStep} · {relativeTime(ultimoProjeto.updatedAt)}
                  </p>
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  )
}
