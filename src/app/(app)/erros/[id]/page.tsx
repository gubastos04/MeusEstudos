import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireOnboardedUser } from '@/lib/auth'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { db } from '@/lib/db'
import { formatDateTime, relativeTime } from '@/lib/dates'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { RevisarErro } from '@/components/revisar-erro'
import { Selo, Titulo } from '@/components/ui'

export const metadata: Metadata = { title: 'Erro registrado' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaErro({ params }: Props) {
  const usuario = await requireOnboardedUser()
  const { id } = await params

  // O filtro por userId e o que garante o isolamento: um id de outra pessoa
  // simplesmente nao e encontrado.
  const registro = await db.errorRecord.findFirst({ where: { id, userId: usuario.id } })
  if (!registro) notFound()

  const statusIa = await statusIaParaCliente(usuario.id)

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/erros" className="text-ink-muted hover:text-ink text-sm">
          ← Meus erros
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          {registro.technology ? <Selo>{registro.technology}</Selo> : null}
          <Selo tom={registro.resolved ? 'ok' : 'warn'}>
            {registro.resolved ? 'resolvido' : 'em aberto'}
          </Selo>
          <Selo>registrado {relativeTime(registro.createdAt)}</Selo>
          {registro.reviewedAt ? (
            <Selo>última revisão {formatDateTime(registro.reviewedAt)}</Selo>
          ) : null}
        </div>

        <Titulo>{registro.title}</Titulo>
      </div>

      <RevisarErro
        registro={{
          id: registro.id,
          titulo: registro.title,
          contexto: registro.context,
          causa: registro.cause,
          solucao: registro.solution,
          aprendizado: registro.learning,
          codigo: registro.code,
          linguagem: registro.language,
          tecnologia: registro.technology,
          resolvido: registro.resolved,
          revisadoEm: registro.reviewedAt ? registro.reviewedAt.toISOString() : null,
        }}
      />

      <FerramentasIa
        status={statusIa}
        contexto={{
          nodeType: 'error',
          nodeId: registro.id,
          nodeTitle: registro.title,
          language: registro.language,
        }}
        ferramentas={['debugger', 'explicar', 'pergunta']}
        codigoAtual={registro.code}
        titulo="Entender melhor este erro"
      />
    </div>
  )
}
