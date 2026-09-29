import type { Metadata } from 'next'
import Link from 'next/link'

import { requireOnboardedUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { relativeTime } from '@/lib/dates'
import { parseStringArray } from '@/lib/json'
import { NovaAnotacao } from '@/components/editor-anotacao'
import { Selo, Titulo, Vazio } from '@/components/ui'

export const metadata: Metadata = { title: 'Anotações' }

export default async function PaginaAnotacoes() {
  const usuario = await requireOnboardedUser()

  const anotacoes = await db.note.findMany({
    where: { userId: usuario.id },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 100,
  })

  return (
    <div className="space-y-6">
      <Titulo sub="Ficam no servidor, então acompanham você entre celular e computador.">Anotações</Titulo>

      <NovaAnotacao />

      {anotacoes.length === 0 ? (
        <Vazio
          titulo="Nenhuma anotação ainda"
          descricao="Anote com suas palavras o que você não quer procurar de novo. Copiar não fixa; escrever, sim."
        />
      ) : (
        <ul className="space-y-2">
          {anotacoes.map((anotacao) => {
            const tags = parseStringArray(anotacao.tags)

            return (
              <li key={anotacao.id}>
                <Link
                  href={`/anotacoes/${anotacao.id}`}
                  className="border-line bg-surface-raised hover:border-line-strong block rounded-lg border p-4 transition"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {anotacao.pinned ? <Selo tom="accent">fixada</Selo> : null}
                    {tags.map((tag) => (
                      <Selo key={tag}>{tag}</Selo>
                    ))}
                  </div>

                  <h2 className="text-ink mt-2 text-base font-semibold">{anotacao.title}</h2>

                  {anotacao.body ? (
                    <p className="text-ink-muted mt-0.5 line-clamp-2 text-sm leading-relaxed">
                      {anotacao.body}
                    </p>
                  ) : null}

                  <p className="text-ink-faint mt-2 text-xs">{relativeTime(anotacao.updatedAt)}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
