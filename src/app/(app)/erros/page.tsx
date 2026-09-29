import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { relativeTime } from '@/lib/dates'
import { NovoErro } from '@/components/lista-erros'
import { Nota, Selo, Titulo, Vazio } from '@/components/ui'

export const metadata: Metadata = { title: 'Meus erros' }

export default async function PaginaErros() {
  const usuario = await requireOnboardedUser()

  const erros = await db.errorRecord.findMany({
    where: { userId: usuario.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  const semRevisar = erros.filter((erro) => erro.reviewedAt === null).length

  return (
    <div className="space-y-6">
      <Titulo sub="O erro que você registra hoje é a revisão de daqui a duas semanas.">Meus erros</Titulo>

      <NovoErro />

      {erros.length === 0 ? (
        <Vazio
          titulo="Nenhum erro registrado ainda"
          descricao="Quando algo quebrar e você resolver, registre: o erro, a causa, a solução e o que aprendeu. É o material mais útil de revisão que existe."
        />
      ) : (
        <>
          {semRevisar > 0 ? (
            <Nota>
              {semRevisar} {semRevisar === 1 ? 'registro ainda não foi revisitado' : 'registros ainda não foram revisitados'}.
              Revisar leva uns cinco minutos.
            </Nota>
          ) : null}

          <ul className="space-y-2">
            {erros.map((erro) => (
              <li key={erro.id}>
                <Link
                  href={`/erros/${erro.id}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-4 transition"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {erro.technology ? <Selo>{erro.technology}</Selo> : null}
                    <Selo tom={erro.resolved ? 'ok' : 'warn'}>
                      {erro.resolved ? 'resolvido' : 'em aberto'}
                    </Selo>
                    {erro.reviewedAt ? (
                      <Selo>revisado {erro.reviewCount}x</Selo>
                    ) : (
                      <Selo>sem revisão</Selo>
                    )}
                  </div>

                  <h2 className="text-ink mt-2 text-base font-semibold">{erro.title}</h2>

                  {erro.learning ? (
                    <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{erro.learning}</p>
                  ) : erro.cause ? (
                    <p className="text-ink-muted mt-0.5 text-sm leading-relaxed">{erro.cause}</p>
                  ) : null}

                  <p className="text-ink-faint mt-2 text-xs">{relativeTime(erro.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
