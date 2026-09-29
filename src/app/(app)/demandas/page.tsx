import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { statusIaParaCliente } from '@/lib/ai/status-ui'
import { relativeTime } from '@/lib/dates'
import { db } from '@/lib/db'
import { getDemandsForUser } from '@/lib/demands'
import { FerramentasIa } from '@/components/ferramentas-ia'
import { Nota, Selo, Titulo, Vazio, juntar } from '@/components/ui'

export const metadata: Metadata = { title: 'Demandas' }

const rotuloStatus: Record<string, string> = {
  analisando: 'analisando',
  implementando: 'implementando',
  revisando: 'revisando',
  concluida: 'concluída',
  abandonada: 'parada',
}

export default async function PaginaDemandas() {
  const usuario = await requireOnboardedUser()

  const [demandas, submissoes, statusIa] = await Promise.all([
    getDemandsForUser(usuario.id),
    db.demandSubmission.findMany({ where: { userId: usuario.id } }),
    statusIaParaCliente(usuario.id),
  ])

  const porDemanda = new Map(submissoes.map((submissao) => [submissao.demandId, submissao]))

  const emAndamento = demandas.filter((demanda) => {
    const status = porDemanda.get(demanda.id)?.status
    return status === 'analisando' || status === 'implementando' || status === 'revisando'
  })

  const disponiveis = demandas.filter((demanda) => !porDemanda.has(demanda.id))
  const encerradas = demandas.filter((demanda) => {
    const status = porDemanda.get(demanda.id)?.status
    return status === 'concluida' || status === 'abandonada'
  })

  return (
    <div className="space-y-6">
      <Titulo sub="Pedidos como eles chegam num time: às vezes claros, às vezes não. Você investiga, resolve e registra.">
        Demandas
      </Titulo>

      <Nota>
        Demanda não é exercício de aula. Ela tem contexto de negócio, critérios de aceite e restrições — e
        parte delas não entrega o problema pronto.
      </Nota>

      {emAndamento.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Em andamento</h2>
          <ul className="space-y-2">
            {emAndamento.map((demanda) => (
              <li key={demanda.id}>
                <CartaoDemanda
                  demanda={demanda}
                  status={porDemanda.get(demanda.id)?.status ?? null}
                  atualizadoEm={porDemanda.get(demanda.id)?.updatedAt ?? null}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg">Disponíveis</h2>

        {disponiveis.length === 0 ? (
          <Vazio
            titulo="Nenhuma demanda nova"
            descricao="Você já pegou todas as demandas do currículo. Pode refazer qualquer uma, ou gerar uma nova com a IA."
          />
        ) : (
          <ul className="space-y-2">
            {disponiveis.map((demanda) => (
              <li key={demanda.id}>
                <CartaoDemanda demanda={demanda} status={null} atualizadoEm={null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {encerradas.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg">Encerradas</h2>
          <ul className="space-y-2">
            {encerradas.map((demanda) => (
              <li key={demanda.id}>
                <CartaoDemanda
                  demanda={demanda}
                  status={porDemanda.get(demanda.id)?.status ?? null}
                  atualizadoEm={porDemanda.get(demanda.id)?.updatedAt ?? null}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <FerramentasIa
        status={statusIa}
        contexto={{}}
        ferramentas={['gerar-demanda']}
        titulo="Quer uma demanda sob medida?"
      />
    </div>
  )
}

function CartaoDemanda({
  demanda,
  status,
  atualizadoEm,
}: {
  demanda: Awaited<ReturnType<typeof getDemandsForUser>>[number]
  status: string | null
  atualizadoEm: Date | null
}) {
  const encerrada = status === 'concluida' || status === 'abandonada'

  return (
    <Link
      href={`/demandas/${demanda.id}`}
      className={juntar(
        'border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-4 transition',
        encerrada && 'opacity-80',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom="accent">{demanda.type}</Selo>
        <Selo>{demanda.difficulty}</Selo>
        <Selo>~{demanda.estimatedMinutes} min</Selo>
        {demanda.contextQuality === 'incompleto' ? <Selo tom="warn">contexto incompleto</Selo> : null}
        {demanda.origin === 'gerada' ? <Selo tom="warn">gerada por IA</Selo> : null}
        {status ? <Selo tom={status === 'concluida' ? 'ok' : 'neutro'}>{rotuloStatus[status]}</Selo> : null}
      </div>

      <h3 className="text-ink mt-2 text-base font-semibold">{demanda.title}</h3>
      <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{demanda.summary}</p>

      <p className="text-ink-faint mt-2 text-xs">
        Pedido por {demanda.requester} · {demanda.stack.join(', ')}
        {atualizadoEm ? ` · mexida ${relativeTime(atualizadoEm)}` : ''}
      </p>
    </Link>
  )
}
