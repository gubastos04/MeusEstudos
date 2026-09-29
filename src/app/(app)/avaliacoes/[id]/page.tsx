import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { avaliacaoPublica } from '@/lib/avaliacoes'
import { getAssessment, getModule } from '@/lib/content/loader'
import { db } from '@/lib/db'
import { formatDateTime } from '@/lib/dates'
import { parseStringArray } from '@/lib/json'
import { Avaliacao } from '@/components/avaliacao'
import { Cartao, Nota, Selo, Titulo } from '@/components/ui'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: getAssessment(id)?.title ?? 'Avaliação' }
}

export default async function PaginaAvaliacao({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  const avaliacao = getAssessment(id)
  if (!avaliacao) notFound()

  const modulo = getModule(avaliacao.moduleId)

  const [tentativas, perfil] = await Promise.all([
    db.assessmentAttempt.findMany({
      where: { userId: usuario.id, assessmentId: avaliacao.id },
      orderBy: { attemptNumber: 'desc' },
      take: 10,
    }),
    db.userProfile.findUnique({ where: { userId: usuario.id }, select: { codeFontSize: true } }),
  ])

  // A versao publica remove o gabarito antes de qualquer coisa chegar ao cliente.
  const publica = avaliacaoPublica(avaliacao)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {modulo ? (
          <Link href={`/estudar/${modulo.id}`} className="text-ink-muted hover:text-ink text-sm">
            ← {modulo.title}
          </Link>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom={avaliacao.format === 'pratica' ? 'accent' : 'neutro'}>
            {avaliacao.format === 'pratica' ? 'prática' : 'alternativa'}
          </Selo>
          <Selo>{avaliacao.estimatedMinutes} min</Selo>
          <Selo>
            {avaliacao.questions.length} {avaliacao.format === 'pratica' ? 'tarefas' : 'questões'}
          </Selo>
        </div>

        <Titulo sub={avaliacao.summary}>{avaliacao.title}</Titulo>

        <p className="text-ink-muted text-sm">
          <span className="text-ink-faint">Avalia: </span>
          {avaliacao.topics.join(', ')}
        </p>
      </div>

      <Avaliacao
        avaliacaoId={avaliacao.id}
        formato={avaliacao.format}
        questoes={publica.questions}
        tamanhoFonte={perfil?.codeFontSize ?? 14}
      />

      {tentativas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Suas tentativas</h2>
          <p className="text-ink-muted text-sm">
            Nada é apagado. O histórico serve para você ver a evolução, não para receber nota.
          </p>

          <ul className="space-y-2">
            {tentativas.map((tentativa) => {
              const revisar = parseStringArray(tentativa.reviewTopics)
              const fortes = parseStringArray(tentativa.strongTopics)

              return (
                <li key={tentativa.id}>
                  <Cartao className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-ink text-sm font-medium">Tentativa {tentativa.attemptNumber}</p>
                      <p className="text-ink-muted text-sm tabular-nums">
                        {tentativa.status === 'finished'
                          ? `${tentativa.correctItems} de ${tentativa.totalItems}`
                          : 'em andamento'}
                      </p>
                    </div>

                    <p className="text-ink-faint text-xs">
                      {tentativa.finishedAt
                        ? formatDateTime(tentativa.finishedAt)
                        : formatDateTime(tentativa.startedAt)}
                    </p>

                    {fortes.length > 0 ? (
                      <p className="text-ink-muted text-xs">
                        <span className="text-ink-faint">Demonstrou: </span>
                        {fortes.join(', ')}
                      </p>
                    ) : null}

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
        </section>
      ) : (
        <Nota>
          Avaliação não vale nota e pode ser refeita quantas vezes você quiser. O histórico fica aqui depois
          da primeira tentativa.
        </Nota>
      )}
    </div>
  )
}
